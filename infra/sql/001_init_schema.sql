create extension if not exists pgcrypto;

-- =====================================================
-- ORGANIZATIONS
-- =====================================================

create table if not exists organizations (
    id text primary key,
    name text not null,
    country text,
    city text,
    created_at timestamptz not null default now()
);

insert into organizations (
    id,
    name,
    country,
    city
)
values (
    'demo_agency',
    'SLAIVO Demo Agency',
    'RDC',
    'Kinshasa'
)
on conflict (id) do nothing;

-- =====================================================
-- CLIENTS
-- =====================================================

create table if not exists clients (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),

    phone text not null,
    name text,
    email text,

    country text,
    preferred_language text default 'FR',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_clients_org_phone
on clients(org_id, phone);

-- =====================================================
-- DOSSIERS
-- =====================================================

create table if not exists dossiers (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),
    client_id uuid not null references clients(id),

    case_type text default 'UNKNOWN',

    status_global text default 'LEAD',
    intake_status text default 'PARTIAL',
    validation_status text default 'PENDING',

    primary_channel text default 'whatsapp',

    -- shipping fields
    origin_country text,
    origin_city text,

    destination_country text,
    destination_city text,

    goods_type text,

    estimated_weight_kg numeric,
    estimated_volume_cbm numeric,

    shipping_mode text,

    tracking_id text,

    -- pricing
    quoted_total numeric,
    quoted_currency text,
    pricing_status text,

    final_total numeric,
    final_currency text,

    payment_status text,

    -- intake
    client_full_name text,

    -- supplier payment
    supplier_payment_amount numeric,
    supplier_payment_currency text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_dossiers_org_client
on dossiers(org_id, client_id);

-- =====================================================
-- RAW MESSAGES
-- =====================================================

create table if not exists messages_raw (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    client_id uuid references clients(id),
    dossier_id uuid references dossiers(id),

    sender_phone text,
    message_text text,

    raw_payload jsonb not null,

    created_at timestamptz not null default now()
);

-- =====================================================
-- DOSSIER EVENTS
-- =====================================================

create table if not exists dossier_events (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),
    dossier_id uuid references dossiers(id),

    event_type text not null,
    payload jsonb,

    created_at timestamptz not null default now()
);

create index if not exists idx_dossier_events_dossier
on dossier_events(dossier_id);

-- =====================================================
-- NOTIFICATION OUTBOX
-- =====================================================

create table if not exists notification_outbox (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    client_id uuid references clients(id),
    dossier_id uuid references dossiers(id),

    channel text default 'whatsapp',

    recipient_phone text not null,

    notification_type text not null,

    message text not null,

    provider text,
    provider_message_id text,

    status text default 'PENDING',

    error_message text,

    created_at timestamptz not null default now(),
    sent_at timestamptz,
    failed_at timestamptz
);

create index if not exists idx_notification_pending
on notification_outbox(status, created_at);

-- =====================================================
-- FOLLOWUP TASKS
-- =====================================================

create table if not exists followup_tasks (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    client_id uuid references clients(id),
    dossier_id uuid references dossiers(id),

    shipment_id uuid,

    followup_type text not null,

    message text not null,

    due_at timestamptz not null,

    status text default 'PENDING',

    created_at timestamptz not null default now(),

    executed_at timestamptz,
    cancelled_at timestamptz,

    error_message text
);

create index if not exists idx_followup_pending
on followup_tasks(status, due_at);

-- =====================================================
-- SHIPMENTS
-- =====================================================

create table if not exists shipments (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    dossier_id uuid not null references dossiers(id),
    client_id uuid not null references clients(id),

    tracking_id text unique not null,

    status text default 'CREATED',

    origin_country text,
    origin_city text,

    destination_country text,
    destination_city text,

    goods_type text,

    weight_kg numeric,
    volume_cbm numeric,

    shipping_mode text,

    fees_total numeric,
    fees_paid numeric default 0,
    currency text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_shipments_tracking
on shipments(tracking_id);

-- =====================================================
-- OFFICES
-- =====================================================

create table if not exists agency_offices (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    country text not null,
    city text not null,

    address text not null,

    office_type text default 'OFFICE',

    phone text,
    whatsapp text,

    opening_hours text,
    pickup_instructions text,

    is_active boolean default true,

    created_at timestamptz not null default now()
);

-- =====================================================
-- PRICING RULES
-- =====================================================

create table if not exists pricing_rules (
    id uuid primary key default gen_random_uuid(),

    org_id text not null references organizations(id),

    origin_country text,
    destination_country text,

    goods_type text,

    rule_type text not null,

    min_value numeric,
    max_value numeric,

    price numeric not null,

    currency text not null default 'USD',

    priority integer default 0,

    is_active boolean default true,

    created_at timestamptz not null default now()
);

create index if not exists idx_pricing_lookup
on pricing_rules(
    org_id,
    origin_country,
    destination_country
);
