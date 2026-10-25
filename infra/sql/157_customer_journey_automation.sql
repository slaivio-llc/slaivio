-- Durable customer communications. Apply before deploying the worker/API.
begin;
alter table cargo_packages add column if not exists automation_checked_at timestamptz;
alter table cargo_packages add column if not exists automation_last_error text;
alter table cargo_packages add column if not exists automation_reminded_at timestamptz;
alter table pickup_orders add column if not exists storage_paid_amount numeric(14,2) not null default 0;
alter table package_expectations add column if not exists journey_id uuid references parcel_customer_journeys(id);
create unique index if not exists package_expectation_journey_unique on package_expectations(org_id,journey_id) where journey_id is not null;

create table if not exists customer_automation_events (
 id uuid primary key default gen_random_uuid(),org_id text not null references organizations(id),
 event_key text not null,kind text not null,entity_id uuid not null,
 payload jsonb not null default '{}',status text not null default 'PENDING'
 check(status in ('PENDING','DONE','FAILED')),attempts integer not null default 0,
 last_error text,available_at timestamptz not null default now(),created_at timestamptz not null default now(),
 processed_at timestamptz,unique(org_id,event_key)
);
create index if not exists customer_automation_due on customer_automation_events(available_at) where status='PENDING';
create table if not exists parcel_expectations (
 id uuid primary key default gen_random_uuid(),org_id text not null references organizations(id),
 expectation_id uuid not null unique references package_expectations(id),
 client_id uuid not null references clients(id),journey_id uuid references parcel_customer_journeys(id),
 status text not null default 'WAITING' check(status in ('WAITING','RECEIVED','CANCELLED')),
 package_id uuid references cargo_packages(id),reference text,created_at timestamptz not null default now(),
 next_reminder_at timestamptz not null default now()+interval '3 days',reminder_count integer not null default 0,
 closed_at timestamptz,unique(org_id,journey_id)
);
create index if not exists parcel_expectations_due on parcel_expectations(next_reminder_at) where status='WAITING';
create table if not exists package_storage_accounts (
 package_id uuid primary key references cargo_packages(id),org_id text not null references organizations(id),
 ready_at timestamptz not null,grace_days integer not null check(grace_days>=0),
 daily_rate numeric(14,2) not null check(daily_rate>=0),currency text not null,
 tax_rate numeric(7,3) not null default 0 check(tax_rate between 0 and 100),
 timezone text not null default 'UTC',billed_days integer not null default 0 check(billed_days>=0),
 stopped_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists package_storage_invoices (
 org_id text not null references organizations(id),package_id uuid not null references cargo_packages(id),
 through_day integer not null,document_id uuid not null references finance_documents(id),
 primary key(org_id,package_id,through_day),unique(document_id)
);
create table if not exists customer_document_shares (
 id uuid primary key default gen_random_uuid(),org_id text not null references organizations(id),
 pickup_id uuid references pickup_orders(id),package_id uuid references cargo_packages(id),document_id uuid not null references finance_documents(id),
 token_hash text not null unique,html_snapshot text not null,
 document_ids uuid[] not null default '{}',
 expires_at timestamptz not null default now()+interval '365 days',revoked_at timestamptz,
 created_at timestamptz not null default now(),unique(org_id,pickup_id,document_id),unique(org_id,package_id,document_id),
 check(num_nonnulls(pickup_id,package_id)=1)
);

create or replace function capture_customer_journey_event() returns trigger language plpgsql as $$
declare client uuid; expectation uuid; cfg jsonb; grace integer; rate numeric; curr text; tz text;
begin
 if TG_TABLE_NAME='parcel_customer_journeys' then
  if new.stage='CONVERTED' and new.client_id is not null and
     (TG_OP='INSERT' or old.stage is distinct from 'CONVERTED') then
   insert into package_expectations(org_id,client_id,journey_id,supplier_tracking,created_by)
    values(new.org_id,new.client_id,new.id,'ATT-'||new.id,'automation')
    on conflict(org_id,journey_id) where journey_id is not null do nothing;
  end if;
 elsif TG_TABLE_NAME='package_expectations' then
  if TG_OP='INSERT' and new.status='EXPECTED' then
   insert into parcel_expectations(org_id,client_id,journey_id,expectation_id,reference,next_reminder_at)
    values(new.org_id,new.client_id,new.journey_id,new.id,
     coalesce(new.description,case when new.supplier_tracking not like 'ATT-%' then new.supplier_tracking end),
     now()+make_interval(days=>coalesce((select (settings->'customer_automation'->>'awaiting_delay_days')::int
       from organization_settings where org_id=new.org_id),3))) on conflict(expectation_id) do nothing;
  elsif new.status in ('CANCELLED','EXPIRED') then
   update parcel_expectations set status='CANCELLED',closed_at=now() where expectation_id=new.id and status='WAITING';
  elsif new.status='MATCHED' and exists(select 1 from cargo_packages where id=new.matched_package_id and org_id=new.org_id
    and status not in ('CREATED','PENDING_VALIDATION','CONFIRMED','CANCELLED')) then
   update parcel_expectations set status='RECEIVED',package_id=new.matched_package_id,closed_at=now()
    where expectation_id=new.id and status='WAITING';
  end if;
 elsif TG_TABLE_NAME='cargo_packages' then
  if TG_OP='INSERT' or new.status is distinct from old.status then
   if new.status in ('RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','WAREHOUSE_PROCESSING') and not exists(
     select 1 from parcel_expectations where org_id=new.org_id and package_id=new.id) then
    -- Match one oldest waiting consignment, never every expectation of a client.
    perform pg_advisory_xact_lock(hashtextextended('parcel-expectation:'||new.org_id||':'||new.client_id::text,0));
    select e.id into expectation from parcel_expectations e join package_expectations source on source.id=e.expectation_id
      where e.org_id=new.org_id and e.client_id=new.client_id and e.status='WAITING'
       and (source.matched_package_id=new.id or (source.status='EXPECTED' and
        (source.supplier_tracking like 'ATT-%' or lower(source.supplier_tracking)=lower(new.supplier_tracking))))
      order by (source.matched_package_id=new.id) desc nulls last,e.created_at,e.id limit 1 for update of e;
    update parcel_expectations set status='RECEIVED',package_id=new.id,closed_at=now()
      where id=expectation;
    update package_expectations source set status='MATCHED',matched_package_id=new.id,updated_at=now()
     from parcel_expectations e where e.id=expectation and source.id=e.expectation_id;
   end if;
   if new.status='READY_FOR_PICKUP' then
    select coalesce(s.settings->'customer_automation','{}'),coalesce(s.timezone,'UTC') into cfg,tz
     from organization_settings s where s.org_id=new.org_id;
    select grace_days,daily_storage_fee,currency into grace,rate,curr from pickup_settings where org_id=new.org_id;
    insert into package_storage_accounts(package_id,org_id,ready_at,grace_days,daily_rate,currency,timezone,tax_rate)
     values(new.id,new.org_id,now(),coalesce(grace,3),coalesce(rate,0),coalesce(curr,new.currency,'USD'),coalesce(tz,'UTC'),
      coalesce((select default_tax_rate from finance_settings where org_id=new.org_id),0))
     on conflict(package_id) do nothing;
   end if;
   if new.status in ('DELIVERED','CANCELLED','RETURNED') then
    update package_storage_accounts set stopped_at=coalesce(stopped_at,now()) where package_id=new.id;
   end if;
   if new.status='DELIVERED' and not exists(select 1 from pickup_order_items i join pickup_orders p
     on p.id=i.pickup_id and p.org_id=i.org_id where i.org_id=new.org_id and i.package_id=new.id
      and p.status in ('READY','NOTIFIED','CHECKED_IN','VERIFIED')) then
    insert into customer_automation_events(org_id,event_key,kind,entity_id)
     values(new.org_id,'package-delivery:'||new.id,'package_documents_ready',new.id)
     on conflict(org_id,event_key) do nothing;
   end if;
  end if;
 elsif TG_TABLE_NAME='finance_payments' then
  if new.status='CONFIRMED' and (TG_OP='INSERT' or old.status is distinct from new.status) then
   insert into customer_automation_events(org_id,event_key,kind,entity_id,payload)
    select new.org_id,'payment:'||new.id,'payment_confirmed',new.id,
     jsonb_build_object('amount',new.amount,'currency',new.currency,'receipt',new.receipt_number,
       'balance',greatest(d.balance_due-new.amount,0),'document_number',d.document_number)
    from finance_documents d where d.org_id=new.org_id and d.id=new.document_id
    on conflict(org_id,event_key) do nothing;
  end if;
 elsif TG_TABLE_NAME='pickup_orders' then
  if new.status='RELEASED' and (TG_OP='INSERT' or old.status is distinct from 'RELEASED') then
   insert into customer_automation_events(org_id,event_key,kind,entity_id)
    values(new.org_id,'pickup:'||new.id,'documents_ready',new.id) on conflict(org_id,event_key) do nothing;
  end if;
 end if;
 return new;
end; $$;

drop trigger if exists customer_journey_expectation on parcel_customer_journeys;
create trigger customer_journey_expectation after insert or update on parcel_customer_journeys for each row execute function capture_customer_journey_event();
drop trigger if exists customer_expected_parcel on package_expectations;
create trigger customer_expected_parcel after insert or update on package_expectations for each row execute function capture_customer_journey_event();
drop trigger if exists customer_package_lifecycle on cargo_packages;
create trigger customer_package_lifecycle after insert or update on cargo_packages for each row execute function capture_customer_journey_event();
drop trigger if exists customer_payment_confirmation on finance_payments;
create trigger customer_payment_confirmation after insert or update on finance_payments for each row execute function capture_customer_journey_event();
drop trigger if exists customer_pickup_documents on pickup_orders;
create trigger customer_pickup_documents after insert or update on pickup_orders for each row execute function capture_customer_journey_event();

-- Reuse the existing expected-consignment register; no parallel client inventory.
insert into parcel_expectations(org_id,client_id,journey_id,expectation_id,reference)
 select org_id,client_id,journey_id,id,description from package_expectations where status='EXPECTED'
 on conflict(expectation_id) do nothing;
-- Unknown historical destination timestamps must not create retroactive charges.
insert into package_storage_accounts(package_id,org_id,ready_at,grace_days,daily_rate,currency,timezone,tax_rate)
 select p.id,p.org_id,now(),coalesce(s.grace_days,3),coalesce(s.daily_storage_fee,0),coalesce(s.currency,p.currency,'USD'),coalesce(o.timezone,'UTC'),
  coalesce((select default_tax_rate from finance_settings where org_id=p.org_id),0)
 from cargo_packages p left join pickup_settings s on s.org_id=p.org_id
 left join organization_settings o on o.org_id=p.org_id
 where p.status='READY_FOR_PICKUP' and p.deleted_at is null
 on conflict(package_id) do nothing;
-- No retroactive storage billing: migration starts a fresh clock for legacy parcels.
revoke all on customer_automation_events,parcel_expectations,package_storage_accounts,package_storage_invoices,customer_document_shares from public;
alter table customer_automation_events enable row level security;
alter table parcel_expectations enable row level security;
alter table package_storage_accounts enable row level security;
alter table package_storage_invoices enable row level security;
alter table customer_document_shares enable row level security;
commit;
