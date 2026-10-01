-- Preserve the offices selected when a parcel/freight network member is
-- invited. Acceptance of the primary Clerk invitation provisions the same
-- user in every selected office with the requested local role.
-- Safe and idempotent after 124_parcel_multi_office_network.sql.

create table if not exists organization_network_invitation_offices (
  invitation_id uuid not null references organization_invitations(id) on delete cascade,
  group_id uuid not null references organization_groups(id) on delete cascade,
  org_id text not null references organizations(id) on delete cascade,
  role_code text not null
    check (role_code in ('MANAGER','OPERATOR','WAREHOUSE','SUPPORT','FINANCE')),
  created_at timestamptz not null default now(),
  primary key (invitation_id, org_id)
);

create index if not exists idx_network_invitation_offices_group
  on organization_network_invitation_offices(group_id, created_at desc);

comment on table organization_network_invitation_offices is
  'Offices and local role to provision after a parcel/freight network invitation is accepted.';
