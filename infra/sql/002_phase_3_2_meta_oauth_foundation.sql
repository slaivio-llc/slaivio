-- Phase 3.2 foundation: Meta OAuth connection storage.
-- This migration is idempotent so it can also align manually-created tables.
-- Railway also needs META_REDIRECT_URI and META_OAUTH_FRONTEND_REDIRECT_URI.

create table if not exists organization_whatsapp_accounts (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    provider text not null default 'META',
    business_id text,
    waba_id text not null,
    account_name text,
    access_token text,
    connection_status text not null default 'CONNECTED',
    webhook_subscription_status text not null default 'PENDING',
    webhook_subscribed_at timestamptz,
    webhook_last_checked_at timestamptz,
    webhook_error_message text,
    webhook_raw_response jsonb,
    quality_rating text,
    messaging_limit_tier text,
    is_default boolean not null default false,
    raw_payload jsonb,
    connected_at timestamptz,
    last_sync_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, waba_id)
);

create table if not exists organization_whatsapp_numbers (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    whatsapp_account_id uuid references organization_whatsapp_accounts(id),
    provider text not null default 'META',
    business_id text,
    waba_id text,
    phone_number_id text not null,
    display_phone_number text,
    verified_name text,
    number_role text not null default 'SUPPORT',
    country_code text,
    default_language text default 'fr',
    default_timezone text default 'Africa/Kinshasa',
    connection_status text not null default 'CONNECTED',
    quality_rating text,
    messaging_limit_tier text,
    is_default boolean not null default false,
    is_active boolean not null default true,
    access_token text,
    connected_at timestamptz,
    last_sync_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, phone_number_id)
);

alter table organization_whatsapp_numbers
add column if not exists access_token text;

create unique index if not exists uniq_org_waba
on organization_whatsapp_accounts(org_id, waba_id);

create unique index if not exists uniq_org_phone_number
on organization_whatsapp_numbers(org_id, phone_number_id);
