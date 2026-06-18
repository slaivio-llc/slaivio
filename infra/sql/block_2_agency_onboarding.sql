-- BLOC 2 - AGENCY ONBOARDING PRODUCTION
-- Real agency setup after signup.
-- SLAIVIO uses organizations.id as text, so org_id is text here.

create extension if not exists pgcrypto;

create table if not exists agency_onboarding (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    status text not null default 'IN_PROGRESS',
    -- IN_PROGRESS, COMPLETED, BLOCKED
    current_step text not null default 'AGENCY_PROFILE',
    completed_steps jsonb not null default '[]'::jsonb,
    missing_steps jsonb not null default '[]'::jsonb,
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id)
);

create table if not exists agency_profile (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    legal_name text,
    brand_name text,
    country text,
    city text,
    address text,
    phone text,
    email text,
    website text,
    default_language text,
    default_currency text,
    business_type text,
    -- CARGO_AGENCY, FREIGHT_FORWARDER, SOURCING_AGENT, HYBRID
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id)
);

create table if not exists onboarding_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    user_id text,
    event_name text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_org_status
on agency_onboarding(org_id, status);

create index if not exists idx_onboarding_events_org_created
on onboarding_events(org_id, created_at desc);
