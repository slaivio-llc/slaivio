-- Secure multi-office and multi-country operations for parcel/freight groups.
-- An organization is an operational office. A group connects offices without
-- removing their local data ownership or role-based permissions.
-- Safe and idempotent after 123_parcel_network_office_visibility.sql.

create table if not exists organization_network_memberships (
  group_id uuid not null references organization_groups(id) on delete cascade,
  clerk_user_id text not null,
  network_role text not null default 'MEMBER'
    check (network_role in ('OWNER','DIRECTOR','AUDITOR','MEMBER')),
  access_scope text not null default 'ASSIGNED_OFFICES'
    check (access_scope in ('ALL_OFFICES','ASSIGNED_OFFICES')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','SUSPENDED')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, clerk_user_id)
);

create index if not exists idx_network_memberships_user
  on organization_network_memberships(clerk_user_id, status, group_id);

create table if not exists organization_network_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references organization_groups(id) on delete cascade,
  org_id text references organizations(id) on delete set null,
  event_type text not null,
  actor_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_network_events_group
  on organization_network_events(group_id, created_at desc);

create table if not exists organization_network_clients (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references organization_groups(id) on delete cascade,
  normalized_phone text not null,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, normalized_phone)
);

alter table clients
  add column if not exists network_client_id uuid
    references organization_network_clients(id) on delete set null;

create index if not exists idx_clients_network_identity
  on clients(network_client_id, org_id)
  where network_client_id is not null and deleted_at is null;

insert into organization_network_clients(group_id, normalized_phone, display_name, email)
select distinct on (organization.group_id, client.normalized_phone)
  organization.group_id, client.normalized_phone,
  coalesce(client.display_name,client.name,client.company_name,client.phone),client.email
from clients client
join organizations organization on organization.id=client.org_id
where organization.group_id is not null
  and client.deleted_at is null
  and nullif(client.normalized_phone,'') is not null
order by organization.group_id,client.normalized_phone,client.updated_at desc
on conflict(group_id,normalized_phone) do update
set display_name=coalesce(excluded.display_name,organization_network_clients.display_name),
    email=coalesce(excluded.email,organization_network_clients.email),updated_at=now();

update clients client
set network_client_id=identity.id
from organizations organization
join organization_network_clients identity
  on identity.group_id=organization.group_id
where organization.id=client.org_id
  and identity.normalized_phone=client.normalized_phone
  and client.network_client_id is null;

alter table cargo_departures
  add column if not exists destination_org_id text references organizations(id);

create index if not exists idx_departures_destination_office
  on cargo_departures(destination_org_id, scheduled_at desc, status)
  where destination_org_id is not null;

update cargo_departures departure
set destination_org_id = route.destination_org_id
from shipping_services service
join shipping_routes route
  on route.id = service.route_id and route.org_id = service.org_id
where departure.shipping_service_id = service.id
  and departure.org_id = service.org_id
  and departure.destination_org_id is null
  and route.destination_org_id is not null;

-- Existing owners and managers receive network-wide visibility only when
-- their office is already attached to a group. Local office memberships keep
-- controlling every mutation and financial permission.
insert into organization_network_memberships(
  group_id, clerk_user_id, network_role, access_scope, created_by
)
select distinct organization.group_id, membership.clerk_user_id,
  case when membership.role_code = 'OWNER' then 'OWNER' else 'DIRECTOR' end,
  'ALL_OFFICES', 'migration-124'
from organization_memberships membership
join organizations organization on organization.id = membership.org_id
where organization.group_id is not null
  and membership.status = 'ACTIVE'
  and membership.role_code in ('OWNER','MANAGER')
on conflict (group_id, clerk_user_id) do update
set network_role = excluded.network_role,
    access_scope = excluded.access_scope,
    status = 'ACTIVE',
    updated_at = now();

insert into permissions(permission_code, description) values
  ('network.read', 'Consulter les bureaux autorisés du réseau'),
  ('network.overview', 'Consulter la vue consolidée du réseau'),
  ('network.offices.manage', 'Créer et administrer les bureaux du réseau'),
  ('network.members.manage', 'Administrer les accès multi-bureaux')
on conflict(permission_code) do update set description = excluded.description;

insert into role_permissions(role_id, permission_id)
select role.id, permission.id
from organization_roles role
join permissions permission on permission.permission_code = any(array[
  'network.read','network.overview','network.offices.manage','network.members.manage'
])
where role.role_code = 'OWNER'
on conflict do nothing;

insert into role_permissions(role_id, permission_id)
select role.id, permission.id
from organization_roles role
join permissions permission on permission.permission_code = any(array[
  'network.read','network.overview'
])
where role.role_code = 'MANAGER'
on conflict do nothing;

comment on table organization_network_memberships is
  'Group-level access. Local organization memberships continue to define permissions inside each office.';
comment on column cargo_departures.destination_org_id is
  'Destination office allowed to follow the departure and prepare its inbound reception.';
comment on column clients.network_client_id is
  'Canonical customer identity shared by offices of the same organization group; operational client records remain office-owned.';
