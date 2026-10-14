-- Explicitly scope organization members to one or more physical offices.
-- Existing memberships retain all-office access until an administrator
-- deliberately switches them to selected-office access.
begin;

alter table organization_memberships
  add column if not exists office_access_scope text not null default 'ALL_OFFICES'
  check (office_access_scope in ('ALL_OFFICES', 'SELECTED_OFFICES'));

create unique index if not exists uq_organization_locations_org_id
  on organization_locations(org_id, id);

create table if not exists organization_membership_offices (
  org_id text not null references organizations(id) on delete cascade,
  membership_id uuid not null references organization_memberships(id) on delete cascade,
  location_id uuid not null,
  granted_by text not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, location_id),
  foreign key (org_id, location_id)
    references organization_locations(org_id, id) on delete cascade
);

create index if not exists idx_membership_offices_location
  on organization_membership_offices(org_id, location_id, membership_id);

insert into permissions(permission_code, description) values
  ('locations.access.manage', 'Affecter les bureaux accessibles aux membres')
on conflict(permission_code) do update set description=excluded.description;

insert into role_permissions(role_id, permission_id)
select role.id, permission.id
from organization_roles role
join permissions permission on permission.permission_code='locations.access.manage'
where role.role_code='OWNER'
on conflict do nothing;

comment on table organization_membership_offices is
  'Explicit office grants for memberships using SELECTED_OFFICES scope.';
comment on column organization_memberships.office_access_scope is
  'ALL_OFFICES preserves existing access; SELECTED_OFFICES is limited to explicit office grants.';

commit;
