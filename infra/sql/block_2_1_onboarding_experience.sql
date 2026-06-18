-- BLOC 2.1 - ONBOARDING EXPERIENCE LAYER
-- World-class onboarding journey for SLAIVIO Cargo OS.
-- SLAIVIO uses organizations.id as text, so org_id is text here.

create extension if not exists pgcrypto;

create table if not exists onboarding_journeys (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    journey_version text not null default 'v1',
    status text not null default 'ACTIVE',
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    unique(org_id, journey_version)
);

create table if not exists onboarding_steps (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    journey_id uuid not null references onboarding_journeys(id),
    step_key text not null,
    step_name text not null,
    step_order integer not null,
    required boolean not null default true,
    status text not null default 'PENDING',
    started_at timestamptz,
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(org_id, journey_id, step_key)
);

create table if not exists onboarding_step_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    journey_id uuid references onboarding_journeys(id),
    step_key text,
    user_id text,
    event_name text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists onboarding_templates (
    id uuid primary key default gen_random_uuid(),
    template_key text not null unique,
    template_name text not null,
    description text,
    metadata jsonb not null default '{}'::jsonb,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_onboarding_steps_org_status
on onboarding_steps(org_id, status);

create index if not exists idx_onboarding_step_events_org_created
on onboarding_step_events(org_id, created_at desc);
