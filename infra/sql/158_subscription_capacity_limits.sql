-- Apply before deploying the matching API/dashboard. No existing data is removed.
begin;

insert into plan_entitlements(plan_code,entitlement_key,entitlement_type,limit_value)
select plan.code,limits.key,'LIMIT',case plan.code when 'STARTER' then limits.starter
 when 'PRO' then limits.pro else limits.business end
from pricing_plans plan cross join (values
 ('max_monthly_packages',500,2500,15000),('max_users',3,10,40),
 ('max_offices',1,3,10),('max_warehouses',1,3,10),('max_whatsapp_numbers',1,5,15)
) limits(key,starter,pro,business)
where plan.code in ('STARTER','PRO','ENTERPRISE','BUSINESS')
on conflict(plan_code,entitlement_key) do update set limit_value=excluded.limit_value,
 entitlement_type='LIMIT',boolean_value=null;

update pricing_plans p set max_users=e.limit_value from plan_entitlements e
 where e.plan_code=p.code and e.entitlement_key='max_users';
update pricing_plans p set max_whatsapp_numbers=e.limit_value from plan_entitlements e
 where e.plan_code=p.code and e.entitlement_key='max_whatsapp_numbers';

create table if not exists billing_capacity_rollout (
 singleton boolean primary key default true check(singleton), started_at timestamptz not null default now()
);
create table if not exists billing_capacity_transition (
 org_id text primary key references organizations(id),
 enforce_from timestamptz not null
);
-- Existing agencies get notice, not an immediate restriction. Reapplying never resets it.
with first_run as (insert into billing_capacity_rollout(singleton) values(true) on conflict do nothing returning started_at)
insert into billing_capacity_transition(org_id,enforce_from)
 select o.id,r.started_at+interval '30 days' from organizations o cross join first_run r
 on conflict(org_id) do nothing;

create or replace function billing_root(requested_org text) returns text
language sql stable as $$
 with recursive ancestors as (
  select id,parent_org_id,array[id] path from organizations where id=requested_org
  union all select o.id,o.parent_org_id,a.path||o.id from organizations o
   join ancestors a on o.id=a.parent_org_id where not o.id=any(a.path)
 ) select id from ancestors order by cardinality(path) desc limit 1;
$$;

create index if not exists billing_parent_org on organizations(parent_org_id);
create or replace function billing_scope(requested_org text) returns setof text
language sql stable as $$
 with recursive descendants as (
  select id,array[id] path from organizations where id=billing_root(requested_org)
  union all select o.id,d.path||o.id from organizations o join descendants d
   on o.parent_org_id=d.id where not o.id=any(d.path)
 ) select id from descendants;
$$;

create table if not exists billing_parcel_usage (
 package_id uuid primary key, org_id text not null references organizations(id),
 consumed_at timestamptz not null default now()
);
create index if not exists billing_parcel_usage_period on billing_parcel_usage(org_id,consumed_at);
insert into billing_parcel_usage(package_id,org_id,consumed_at)
 select id,org_id,created_at from cargo_packages on conflict(package_id) do nothing;

create or replace function billing_capacity(requested_org text) returns jsonb
language plpgsql volatile as $$
declare root text; plan text; tz text; month_start timestamptz; grace timestamptz;
 orgs text[]; usage jsonb; limits jsonb;
begin
 root:=billing_root(requested_org);
 -- One quota account for every descendant, even a bureau created from another bureau.
 select array_agg(id) into orgs from billing_scope(root) as scope(id);
 select p.code into plan from agency_subscriptions s join pricing_plans p on p.id=s.pricing_plan_id
  where s.org_id=root;
 plan:=coalesce(plan,'STARTER');
 select coalesce(timezone,'UTC') into tz from organization_settings where org_id=root;
 tz:=coalesce(tz,'UTC');
 month_start:=date_trunc('month',now() at time zone tz) at time zone tz;
 select enforce_from into grace from billing_capacity_transition where org_id=root;
 select jsonb_object_agg(entitlement_key,limit_value) into limits from plan_entitlements
  where plan_code=plan and entitlement_key in
   ('max_monthly_packages','max_users','max_offices','max_warehouses','max_whatsapp_numbers');
 select jsonb_build_object(
  'max_monthly_packages',(select count(*) from billing_parcel_usage where org_id=any(orgs) and consumed_at>=month_start),
  'max_users',(select count(distinct clerk_user_id) from organization_memberships where org_id=any(orgs) and status='ACTIVE')+
   (select count(distinct lower(trim(i.email))) from organization_invitations i
    where i.org_id=any(orgs) and (
     (i.status='PENDING' and not exists(select 1 from organization_memberships m
       where m.org_id=any(orgs) and m.status='ACTIVE' and lower(trim(m.member_email))=lower(trim(i.email))))
     or (i.status='ACCEPTED' and not exists(select 1 from organization_memberships m
       where m.org_id=any(orgs) and lower(trim(m.member_email))=lower(trim(i.email))))
    )),
  'max_offices',(select coalesce(sum(greatest(case when coalesce(o.agency_type,'OFFICE')<>'WAREHOUSE' then 1 else 0 end,
    (select count(*) from organization_locations l where l.org_id=o.id and l.location_type='OFFICE' and l.status='ACTIVE'))),0)
    from organizations o where o.id=any(orgs) and o.status='ACTIVE'),
  'max_warehouses',(select coalesce(sum(greatest(case when o.agency_type='WAREHOUSE' then 1 else 0 end,
    (select count(*) from organization_locations l where l.org_id=o.id and l.location_type='WAREHOUSE' and l.status='ACTIVE'),
    (select count(*) from warehouses w where w.org_id=o.id and w.active))),0)
    from organizations o where o.id=any(orgs) and o.status='ACTIVE'),
  'max_whatsapp_numbers',(select count(*) from organization_whatsapp_numbers where org_id=any(orgs) and is_active and provider<>'QR_LINKED_DEVICE')+
   greatest((select count(*) from whatsapp_qr_connections where org_id=any(orgs) and status not in('LOGGED_OUT','REVOKED','FAILED')),
    (select count(*) from organization_whatsapp_numbers where org_id=any(orgs) and is_active and provider='QR_LINKED_DEVICE'))
 ) into usage;
 return jsonb_build_object('account_id',root,'plan_code',plan,'limits',coalesce(limits,'{}'),
  'usage',usage,'enforce_from',grace,'transition_active',coalesce(grace>now(),false),
  'period_start',month_start,'period_ends_at',
   (date_trunc('month',now() at time zone tz)+interval '1 month') at time zone tz,'timezone',tz);
end; $$;

create or replace function billing_assert_capacity(requested_org text,resource text,additional integer default 0)
returns void language plpgsql volatile as $$
declare info jsonb; ceiling integer; used bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('billing-capacity:'||billing_root(requested_org)||':'||resource,0));
 info:=billing_capacity(requested_org);
 if (info->>'transition_active')::boolean then return; end if;
 ceiling:=(info->'limits'->>resource)::integer;
 if ceiling is null then raise exception 'billing_capacity_configuration_missing'; end if;
 used:=(info->'usage'->>resource)::bigint;
 if used+additional>ceiling then
  raise exception using errcode='P0001',message='slaivio_plan_limit_reached',
   detail=jsonb_build_object('code','plan_limit_reached','resource',resource,
    'limit',ceiling,'current',used,'plan_code',info->>'plan_code')::text;
 end if;
end; $$;

create or replace function billing_advanced_automation(requested_org text) returns boolean
language sql stable as $$
 select exists(select 1 from agency_subscriptions s join pricing_plans p on p.id=s.pricing_plan_id
  where s.org_id=billing_root(requested_org) and p.code in('PRO','ENTERPRISE','BUSINESS'))
 or exists(select 1 from billing_capacity_transition where org_id=billing_root(requested_org) and enforce_from>now());
$$;

-- Confirmation of receipt, departure, arrival, payment and delivery documents
-- remain available in every plan. Only repeat reminders/marketing are premium.
create or replace function enforce_billing_automation() returns trigger language plpgsql as $$
begin
 if (new.notification_type like 'NEXT_DEPARTURE:%' or new.notification_type like 'FOLLOWUP:%' or
     new.notification_type ~ '^CUSTOMER:(awaiting_parcel|departure_blocked|pickup_reminder|storage_due):')
    and not billing_advanced_automation(new.org_id) then return null; end if;
 return new;
end; $$;
drop trigger if exists billing_automation_plan on notification_outbox;
create trigger billing_automation_plan before insert on notification_outbox for each row execute function enforce_billing_automation();

create or replace function enforce_billing_capacity() returns trigger language plpgsql as $$
declare resource text; old_active boolean; new_active boolean;
begin
 if TG_TABLE_NAME='cargo_packages' then
  insert into billing_parcel_usage(package_id,org_id) values(new.id,new.org_id) on conflict do nothing;
  perform billing_assert_capacity(new.org_id,'max_monthly_packages');
 elsif TG_TABLE_NAME='organizations' then
  if TG_OP='INSERT' and new.parent_org_id is null then return new; end if;
  if new.status<>'ACTIVE' then return new; end if;
  if TG_OP='UPDATE' and old.parent_org_id is not distinct from new.parent_org_id
   and old.status='ACTIVE' and old.agency_type is not distinct from new.agency_type then return new; end if;
  resource:=case when new.agency_type='WAREHOUSE' then 'max_warehouses' else 'max_offices' end;
  perform billing_assert_capacity(new.id,resource);
 elsif TG_TABLE_NAME='organization_memberships' then
  if new.status<>'ACTIVE' then return new; end if;
  if TG_OP='UPDATE' and old.status='ACTIVE' and old.org_id=new.org_id and old.clerk_user_id=new.clerk_user_id then return new; end if;
  perform billing_assert_capacity(new.org_id,'max_users');
 elsif TG_TABLE_NAME='organization_locations' then
  if new.status<>'ACTIVE' or new.location_type not in('OFFICE','WAREHOUSE') then return new; end if;
  if TG_OP='UPDATE' and old.status='ACTIVE' and old.org_id=new.org_id and old.location_type=new.location_type then return new; end if;
  perform billing_assert_capacity(new.org_id,case when new.location_type='WAREHOUSE' then 'max_warehouses' else 'max_offices' end);
 elsif TG_TABLE_NAME='warehouses' then
  if not new.active then return new; end if;
  if TG_OP='UPDATE' and old.active and old.org_id=new.org_id then return new; end if;
  perform billing_assert_capacity(new.org_id,'max_warehouses');
 elsif TG_TABLE_NAME='organization_invitations' then
  if new.status='PENDING' then perform billing_assert_capacity(new.org_id,'max_users'); end if;
 elsif TG_TABLE_NAME='organization_whatsapp_numbers' then
  if not new.is_active then return new; end if;
  if TG_OP='UPDATE' and old.is_active and old.org_id=new.org_id then return new; end if;
  perform billing_assert_capacity(new.org_id,'max_whatsapp_numbers');
 elsif TG_TABLE_NAME='whatsapp_qr_connections' then
  new_active:=new.status not in('LOGGED_OUT','REVOKED','FAILED');
  if not new_active then return new; end if;
  if TG_OP='UPDATE' then
   old_active:=old.status not in('LOGGED_OUT','REVOKED','FAILED');
   if old_active and old.org_id=new.org_id then return new; end if;
  end if;
  perform billing_assert_capacity(new.org_id,'max_whatsapp_numbers');
 end if;
 return new;
end; $$;

drop trigger if exists billing_package_limit on cargo_packages;
create trigger billing_package_limit after insert on cargo_packages for each row execute function enforce_billing_capacity();
drop trigger if exists billing_workspace_limit on organizations;
create trigger billing_workspace_limit after insert or update of parent_org_id,agency_type,status on organizations for each row execute function enforce_billing_capacity();
drop trigger if exists billing_member_limit on organization_memberships;
create trigger billing_member_limit after insert or update of org_id,status,clerk_user_id on organization_memberships for each row execute function enforce_billing_capacity();
drop trigger if exists billing_location_limit on organization_locations;
create trigger billing_location_limit after insert or update of status,location_type,org_id on organization_locations for each row execute function enforce_billing_capacity();
drop trigger if exists billing_warehouse_limit on warehouses;
create trigger billing_warehouse_limit after insert or update of active,org_id on warehouses for each row execute function enforce_billing_capacity();
drop trigger if exists billing_invitation_limit on organization_invitations;
create trigger billing_invitation_limit after insert or update of status,email on organization_invitations for each row execute function enforce_billing_capacity();
drop trigger if exists billing_number_limit on organization_whatsapp_numbers;
create trigger billing_number_limit after insert or update of is_active,org_id on organization_whatsapp_numbers for each row execute function enforce_billing_capacity();
drop trigger if exists billing_qr_limit on whatsapp_qr_connections;
create trigger billing_qr_limit after insert or update of status,org_id on whatsapp_qr_connections for each row execute function enforce_billing_capacity();

revoke all on billing_capacity_rollout,billing_capacity_transition,billing_parcel_usage from public;
alter table billing_capacity_rollout enable row level security;
alter table billing_capacity_transition enable row level security;
alter table billing_parcel_usage enable row level security;
commit;
