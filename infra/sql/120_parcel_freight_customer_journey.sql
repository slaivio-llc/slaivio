-- Parcel/freight customer journey, office network and configurable parcel intake.
-- This migration deliberately reuses the existing routes, services, prices,
-- locations, clients, packages, follow-ups and notification outbox instead of
-- creating a second operational model.
-- Safe and idempotent after 119_pilot_ai_customer_support_prompts.sql.

alter table cargo_packages
  add column if not exists origin_location_id uuid references organization_locations(id),
  add column if not exists destination_location_id uuid references organization_locations(id),
  add column if not exists created_from_conversation text,
  add column if not exists destination_org_id text references organizations(id);

create index if not exists idx_cargo_packages_destination_office
  on cargo_packages(destination_org_id, status, updated_at desc)
  where deleted_at is null;

create table if not exists parcel_operation_settings (
  org_id text primary key references organizations(id) on delete cascade,
  package_number_pattern text not null default 'COL-{YYYY}-{000001}',
  prospect_followup_delay_hours integer not null default 24
    check (prospect_followup_delay_hours between 1 and 720),
  incomplete_profile_followup_hours integer not null default 12
    check (incomplete_profile_followup_hours between 1 and 720),
  notify_next_departure boolean not null default true,
  notify_package_milestones boolean not null default true,
  require_payment_clearance boolean not null default true,
  required_profile_fields text[] not null default array['full_name','country','city','customer_type'],
  updated_by text,
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint ck_parcel_number_pattern_sequence check (
    package_number_pattern like '%{000001}%'
  )
);

insert into parcel_operation_settings(org_id)
select id from organizations where organization_type = 'PARCEL_FREIGHT'
on conflict(org_id) do nothing;

create table if not exists parcel_customer_journeys (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id) on delete cascade,
  conversation_phone text not null,
  client_id uuid references clients(id) on delete set null,
  stage text not null default 'DISCOVERY' check(stage in(
    'DISCOVERY','INTERESTED','QUALIFYING','QUALIFIED','CONVERTED',
    'NOT_INTERESTED','HUMAN_REVIEW','CLOSED'
  )),
  full_name text,
  country text,
  city text,
  customer_type text check(customer_type is null or customer_type in('individual','company')),
  service_interest text,
  route_interest text,
  transport_mode text,
  missing_fields text[] not null default '{}',
  last_intent text,
  qualification_confidence numeric(5,4),
  followup_status text not null default 'NONE' check(followup_status in(
    'NONE','SCHEDULED','SENT','RESPONDED','CANCELLED'
  )),
  next_followup_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  converted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, conversation_phone)
);

create index if not exists idx_parcel_customer_journeys_followup
  on parcel_customer_journeys(org_id, followup_status, next_followup_at)
  where stage not in ('CONVERTED','NOT_INTERESTED','CLOSED');

create table if not exists organization_location_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id) on delete cascade,
  location_id uuid not null references organization_locations(id) on delete cascade,
  label text not null,
  contact_type text not null check(contact_type in('PHONE','WHATSAPP','EMAIL')),
  contact_value text not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(location_id, contact_type, contact_value)
);

create table if not exists service_goods_rates (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id) on delete cascade,
  shipping_service_id uuid not null references shipping_services(id) on delete cascade,
  goods_label text not null,
  goods_category text,
  billing_unit text not null check(billing_unit in('KG','CBM','PACKAGE','FLAT')),
  amount_minor bigint not null check(amount_minor >= 0),
  currency_code text not null,
  express boolean not null default false,
  min_quantity numeric(18,4),
  max_quantity numeric(18,4),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shipping_service_id, goods_label, billing_unit, express, effective_from)
);

create index if not exists idx_service_goods_rates_active
  on service_goods_rates(org_id, shipping_service_id, active, effective_from desc);

-- A configured organisation location is the canonical office/warehouse source.
-- Keep legacy office records available, while allowing routes to target the
-- exact configured location used by operational forms and customer replies.
alter table shipping_routes
  add column if not exists origin_location_id uuid references organization_locations(id),
  add column if not exists destination_location_id uuid references organization_locations(id);

alter table followup_tasks
  add column if not exists conversation_phone text,
  add column if not exists journey_id uuid references parcel_customer_journeys(id) on delete set null;

create index if not exists idx_followups_conversation_phone
  on followup_tasks(org_id, conversation_phone, status, due_at)
  where conversation_phone is not null;

-- PACKAGE is used for public tracking identifiers. Existing client/dossier
-- patterns remain untouched.
insert into document_numbering_settings(org_id, document_type, prefix_format)
select id, 'PACKAGE', 'COL-{YYYY}-{000001}'
from organizations
where organization_type = 'PARCEL_FREIGHT'
on conflict(org_id, document_type) do nothing;

insert into permissions(permission_code, description) values
  ('parcel.settings.read', 'Consulter la configuration colis et fret'),
  ('parcel.settings.manage', 'Configurer bureaux, routes, services et parcours client'),
  ('parcel.prospects.read', 'Consulter les prospects issus de WhatsApp'),
  ('parcel.prospects.manage', 'Qualifier et convertir les prospects WhatsApp')
on conflict(permission_code) do update set description = excluded.description;

insert into role_permissions(role_id, permission_id)
select role.id, permission.id
from organization_roles role
join permissions permission on (
  (role.role_code in ('OWNER','MANAGER') and permission.permission_code like 'parcel.%')
  or (role.role_code in ('SUPPORT','OPERATOR') and permission.permission_code in(
    'parcel.settings.read','parcel.prospects.read','parcel.prospects.manage'
  ))
)
on conflict do nothing;

revoke all on parcel_operation_settings, parcel_customer_journeys,
  organization_location_contacts, service_goods_rates from public;

comment on table parcel_customer_journeys is
  'Stateful WhatsApp qualification journey. The WhatsApp sender phone is authoritative and is never requested again.';
comment on table service_goods_rates is
  'Customer-visible rates per merchandise type and configured transport service; also exposed to grounded AI answers.';
