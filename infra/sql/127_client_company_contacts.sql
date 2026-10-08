-- Company contacts are office-owned, separate from the company identity.
create table if not exists client_company_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id),
  client_id uuid not null references clients(id),
  name text not null check(length(trim(name)) between 1 and 160),
  role_label text,
  phone text,
  email text,
  is_primary boolean not null default false,
  row_version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_company_contacts_client
  on client_company_contacts(org_id,client_id,created_at) where archived_at is null;
create unique index if not exists idx_company_contacts_primary
  on client_company_contacts(org_id,client_id) where is_primary and archived_at is null;
