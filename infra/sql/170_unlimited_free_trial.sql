-- Active free trials have no commercial capacity ceilings.
-- Never extend a trial, change paid-plan ceilings or delete existing records.
begin;

create or replace function billing_trial_active(requested_org text) returns boolean
language sql stable as $$
 select exists(select 1 from agency_subscriptions s
  where s.org_id=billing_root(requested_org) and s.status='TRIAL'
   and s.starts_at<=now() and s.trial_ends_at>now());
$$;

create or replace function billing_capacity(requested_org text) returns jsonb
language plpgsql volatile as $$
declare root text; plan text; tz text; month_start timestamptz; grace timestamptz;
 orgs text[]; usage jsonb; limits jsonb; trial boolean; trial_end timestamptz;
begin
 root:=billing_root(requested_org);
 trial:=billing_trial_active(root);
 select trial_ends_at into trial_end from agency_subscriptions where org_id=root;
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
 return jsonb_build_object('account_id',root,'plan_code',plan,'limits',case when trial then (select jsonb_object_agg(key,'null'::jsonb) from jsonb_object_keys(coalesce(limits,'{}')) as keys(key)) else coalesce(limits,'{}') end,
  'plan_limits',coalesce(limits,'{}'),'trial_active',trial,'trial_ends_at',trial_end,
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
 if coalesce((info->>'trial_active')::boolean,false) or (info->>'transition_active')::boolean then return; end if;
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
 select billing_trial_active(requested_org) or exists(select 1 from agency_subscriptions s join pricing_plans p on p.id=s.pricing_plan_id
  where s.org_id=billing_root(requested_org) and p.code in('PRO','ENTERPRISE','BUSINESS'))
 or exists(select 1 from billing_capacity_transition where org_id=billing_root(requested_org) and enforce_from>now());
$$;

commit;

