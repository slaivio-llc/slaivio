-- BLOC 0 - BRAND + LANDING PAGE PRODUCTION
-- Public acquisition layer for SLAIVIO Cargo OS.

create table if not exists landing_metrics (
    id uuid primary key default gen_random_uuid(),
    metric_key text unique not null,
    metric_label text not null,
    metric_value bigint not null default 0,
    display_order integer not null default 100,
    is_active boolean not null default true,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

insert into landing_metrics (
    metric_key,
    metric_label,
    metric_value,
    display_order
)
values
    ('countries_served', 'Countries Served', 0, 10),
    ('agencies_using_slaivio', 'Agencies Using SLAIVIO', 0, 20),
    ('messages_processed', 'Messages Processed', 0, 30),
    ('shipments_managed', 'Shipments Managed', 0, 40)
on conflict (metric_key) do nothing;

create table if not exists landing_testimonials (
    id uuid primary key default gen_random_uuid(),
    agency_name text not null,
    country text not null,
    owner_name text,
    quote text not null,
    is_active boolean not null default false,
    display_order integer not null default 100,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists landing_demo_requests (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    agency_name text,
    phone text,
    country text,
    monthly_shipments text,
    message text,
    status text not null default 'NEW',
    source text not null default 'landing',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_landing_demo_requests_status
on landing_demo_requests(status, created_at desc);

create table if not exists landing_trial_leads (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    agency_name text,
    source text not null default 'landing',
    created_at timestamptz not null default now()
);

create index if not exists idx_landing_trial_leads_email
on landing_trial_leads(email, created_at desc);
