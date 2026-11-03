-- Apply after 168 and before the matching API/dashboard. Opt-in only.
-- A submitted form creates a CRM client/expectation, never a physical parcel.
begin;
alter table ai_settings add column if not exists customer_intake_enabled boolean not null default false;
alter table warehouses add column if not exists customer_dropoff_enabled boolean not null default false;
alter table warehouses add column if not exists customer_dropoff_recipient text;
alter table warehouses add column if not exists customer_dropoff_phone text;
alter table warehouses add column if not exists customer_dropoff_instructions text;

create table if not exists customer_intake_requests (
 id uuid primary key default gen_random_uuid(), org_id text not null references organizations(id),
 reference text not null, source_phone text not null, client_id uuid not null references clients(id),
 expectation_id uuid not null references package_expectations(id),
 offering_id uuid not null references service_route_offerings(id),
 declared_profile jsonb not null, receipt jsonb not null,
 created_at timestamptz not null default now(), unique(org_id,reference)
);
create index if not exists customer_intake_by_sender on customer_intake_requests(org_id,source_phone,created_at desc);
create table if not exists customer_intake_links (
 id uuid primary key default gen_random_uuid(), org_id text not null references organizations(id),
 source_phone text not null, source_message_id uuid not null references messages(id),
 token_hash text not null unique, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '72 hours', revoked_at timestamptz,
 request_id uuid references customer_intake_requests(id)
);
create index if not exists customer_intake_link_limits on customer_intake_links(org_id,source_phone,created_at desc);
alter table customer_intake_requests enable row level security;
alter table customer_intake_links enable row level security;
revoke all on customer_intake_requests,customer_intake_links from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
  revoke all on customer_intake_requests,customer_intake_links from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  revoke all on customer_intake_requests,customer_intake_links from authenticated;
 end if;
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant select,insert,update,delete on customer_intake_requests,customer_intake_links to service_role;
 end if;
end $$;
commit;
