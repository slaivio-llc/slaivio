-- =====================================================
-- CLIENTS MODULE
-- Production-ready additive schema for cargo agencies.
-- =====================================================

alter table clients
    alter column phone drop not null;

alter table clients
    add column if not exists display_name text,
    add column if not exists whatsapp_phone text,
    add column if not exists city text,
    add column if not exists address text,
    add column if not exists customer_type text not null default 'individual',
    add column if not exists lifecycle_status text not null default 'lead',
    add column if not exists source text not null default 'manual',
    add column if not exists notes text,
    add column if not exists tags jsonb not null default '[]'::jsonb,
    add column if not exists company_name text,
    add column if not exists tax_id text,
    add column if not exists preferred_currency text,
    add column if not exists credit_enabled boolean not null default false,
    add column if not exists credit_limit numeric not null default 0,
    add column if not exists current_balance numeric not null default 0,
    add column if not exists total_spent numeric not null default 0,
    add column if not exists last_activity_at timestamptz,
    add column if not exists created_by text,
    add column if not exists updated_by text,
    add column if not exists deleted_at timestamptz;

update clients
set display_name = coalesce(display_name, name, phone, email),
    whatsapp_phone = coalesce(whatsapp_phone, phone),
    lifecycle_status = coalesce(lifecycle_status, 'lead'),
    customer_type = coalesce(customer_type, 'individual'),
    source = coalesce(source, 'manual')
where display_name is null
   or whatsapp_phone is null
   or lifecycle_status is null
   or customer_type is null
   or source is null;

create index if not exists idx_clients_org_status
on clients(org_id, lifecycle_status)
where deleted_at is null;

create index if not exists idx_clients_org_type
on clients(org_id, customer_type)
where deleted_at is null;

create index if not exists idx_clients_org_created
on clients(org_id, created_at desc)
where deleted_at is null;

create index if not exists idx_clients_org_last_activity
on clients(org_id, last_activity_at desc nulls last)
where deleted_at is null;
