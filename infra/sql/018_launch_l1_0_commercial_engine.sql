-- PHASE L1.0 - Commercial Engine
-- Quote Request + Procurement + Restriction Check
-- SLAIVIO uses organizations.id as text, so org_id is text in this migration.

-- =====================================================
-- FOUNDATION CONFIGURATION LAYER USED BY L1
-- =====================================================

create table if not exists configuration_versions (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    config_domain text not null,
    version_number integer not null default 1,
    semantic_version text,
    status text not null default 'ACTIVE',
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, config_domain, version_number)
);

create table if not exists shipping_services (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    service_code text not null,
    service_name text not null,
    origin_country text,
    origin_city text,
    destination_country text,
    destination_city text,
    shipping_mode text,
    eta_min_days integer,
    eta_max_days integer,
    active boolean not null default true,
    priority integer not null default 100,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, service_code)
);

create table if not exists pricing_components (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipping_service_id uuid references shipping_services(id),
    component_code text not null,
    component_name text not null,
    calculation_type text not null,
    -- FIXED, PER_KG, PER_CBM, PERCENTAGE
    amount_minor integer,
    percentage numeric,
    currency_code text not null default 'USD',
    active boolean not null default true,
    priority integer not null default 100,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists advanced_goods_rules (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    goods_name text,
    goods_category text,
    shipping_service_id uuid references shipping_services(id),
    decision text not null default 'MANUAL_REVIEW',
    -- ALLOWED, ALLOWED_WITH_DECLARATION, MANUAL_REVIEW, RESTRICTED, PROHIBITED
    handling_instructions text,
    required_documents jsonb not null default '[]'::jsonb,
    required_declarations jsonb not null default '[]'::jsonb,
    active boolean not null default true,
    priority integer not null default 100,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- =====================================================
-- COMMERCIAL ENGINE TABLES
-- =====================================================

create table if not exists commercial_cases (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    client_id uuid references clients(id),
    dossier_id uuid references dossiers(id),

    source_channel text not null default 'whatsapp',
    case_type text not null,
    -- QUOTE_REQUEST, PROCUREMENT_REQUEST, RESTRICTION_CHECK
    status text not null default 'OPEN',
    -- OPEN, NEEDS_INFO, QUOTED, WAITING_CLIENT, IN_PROGRESS, CLOSED
    priority text not null default 'NORMAL',

    detected_intent text,
    extracted_fields jsonb not null default '{}'::jsonb,
    missing_fields jsonb not null default '[]'::jsonb,

    assigned_team text,
    assigned_manager_id text,

    last_customer_message text,
    last_system_response text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists quote_requests (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    client_id uuid references clients(id),

    origin_country text,
    origin_city text,
    destination_country text,
    destination_city text,
    goods_description text,
    goods_category text,
    weight_kg numeric,
    volume_cbm numeric,
    quantity integer,
    shipping_mode text,
    requested_currency text,
    requested_eta text,

    status text not null default 'PENDING',
    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists quotations (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    quote_request_id uuid references quote_requests(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),

    shipping_service_id uuid references shipping_services(id),
    service_name text,
    shipping_mode text,

    subtotal_minor integer,
    total_minor integer,
    currency_code text,
    eta_min_days integer,
    eta_max_days integer,

    pricing_breakdown jsonb not null default '[]'::jsonb,
    restriction_decision text,
    required_documents jsonb not null default '[]'::jsonb,
    required_declarations jsonb not null default '[]'::jsonb,

    status text not null default 'DRAFT',
    -- DRAFT, SENT, ACCEPTED, EXPIRED, CANCELLED
    valid_until timestamptz,
    sent_at timestamptz,
    accepted_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists procurement_requests (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    client_id uuid references clients(id),

    product_description text not null,
    target_country text,
    destination_country text,
    budget_minor integer,
    currency_code text,
    quantity integer,
    quality_requirements text,

    status text not null default 'NEW',
    -- NEW, SOURCING, SUPPLIER_FOUND, WAITING_CLIENT, CLOSED
    assigned_team text default 'procurement',
    sourcing_notes text,
    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists cargo_restriction_checks (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    client_id uuid references clients(id),

    goods_description text not null,
    goods_category text,
    origin_country text,
    destination_country text,
    shipping_mode text,

    decision text not null,
    handling_instructions text,
    required_documents jsonb not null default '[]'::jsonb,
    required_declarations jsonb not null default '[]'::jsonb,
    escalation_required boolean not null default false,

    raw_rule jsonb,
    created_at timestamptz not null default now()
);

create table if not exists commercial_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    event_type text not null,
    event_title text not null,
    event_payload jsonb not null default '{}'::jsonb,
    actor_type text not null default 'system',
    actor_id text,
    created_at timestamptz not null default now()
);

create table if not exists commercial_tasks (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    task_type text not null,
    title text not null,
    description text,
    priority text not null default 'NORMAL',
    status text not null default 'OPEN',
    assigned_team text,
    assigned_manager_id text,
    due_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists commercial_followups (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    commercial_case_id uuid references commercial_cases(id),
    dossier_id uuid references dossiers(id),
    followup_type text not null,
    status text not null default 'SCHEDULED',
    scheduled_at timestamptz,
    sent_at timestamptz,
    message_template text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists commercial_audit_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text not null references organizations(id),
    entity_type text not null,
    entity_id uuid,
    action text not null,
    actor_id text,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_commercial_cases_org_status
on commercial_cases(org_id, status, created_at desc);

create index if not exists idx_quote_requests_org_status
on quote_requests(org_id, status, created_at desc);

create index if not exists idx_quotations_org_status
on quotations(org_id, status, created_at desc);

create index if not exists idx_procurement_requests_org_status
on procurement_requests(org_id, status, created_at desc);

create index if not exists idx_commercial_tasks_org_status
on commercial_tasks(org_id, status, created_at desc);

-- =====================================================
-- DEMO CONFIGURATION SEED
-- Runtime logic reads these rows; prices and restrictions are not hardcoded in code.
-- =====================================================

insert into configuration_versions (
    org_id,
    config_domain,
    version_number,
    semantic_version,
    status,
    published_at
)
values
    ('demo_agency', 'SHIPPING_SERVICES', 1, '1.0.0', 'ACTIVE', now()),
    ('demo_agency', 'PRICING', 1, '1.0.0', 'ACTIVE', now()),
    ('demo_agency', 'GOODS_RULES', 1, '1.0.0', 'ACTIVE', now())
on conflict (org_id, config_domain, version_number) do nothing;

insert into shipping_services (
    org_id,
    service_code,
    service_name,
    origin_country,
    destination_country,
    destination_city,
    shipping_mode,
    eta_min_days,
    eta_max_days,
    priority
)
values (
    'demo_agency',
    'AIR_EXPRESS_CHINA_KINSHASA',
    'Air Express China to Kinshasa',
    'China',
    'DRC',
    'Kinshasa',
    'AIR',
    5,
    7,
    10
)
on conflict (org_id, service_code) do nothing;

insert into pricing_components (
    org_id,
    shipping_service_id,
    component_code,
    component_name,
    calculation_type,
    amount_minor,
    currency_code,
    priority
)
select
    'demo_agency',
    ss.id,
    seed.component_code,
    seed.component_name,
    seed.calculation_type,
    seed.amount_minor,
    'USD',
    seed.priority
from shipping_services ss
cross join (
    values
        ('TRANSPORT_PER_KG', 'Transport per kg', 'PER_KG', 500, 10),
        ('HANDLING_FIXED', 'Handling fee', 'FIXED', 1000, 20),
        ('DOCUMENTS_FIXED', 'Documentation fee', 'FIXED', 500, 30)
) as seed(component_code, component_name, calculation_type, amount_minor, priority)
where ss.org_id = 'demo_agency'
  and ss.service_code = 'AIR_EXPRESS_CHINA_KINSHASA'
  and not exists (
      select 1
      from pricing_components pc
      where pc.org_id = 'demo_agency'
        and pc.shipping_service_id = ss.id
        and pc.component_code = seed.component_code
  );

insert into advanced_goods_rules (
    org_id,
    goods_name,
    goods_category,
    decision,
    handling_instructions,
    required_documents,
    required_declarations,
    priority
)
values
    (
        'demo_agency',
        'lithium battery',
        'BATTERY',
        'MANUAL_REVIEW',
        'Verifier MSDS, quantite, puissance et conditions airline avant cotation.',
        '["MSDS", "Battery declaration"]'::jsonb,
        '["Dangerous goods declaration"]'::jsonb,
        5
    ),
    (
        'demo_agency',
        'battery',
        'BATTERY',
        'MANUAL_REVIEW',
        'Verifier le type de batterie avant acceptation.',
        '["MSDS"]'::jsonb,
        '["Battery declaration"]'::jsonb,
        10
    ),
    (
        'demo_agency',
        'perfume',
        'LIQUID',
        'ALLOWED_WITH_DECLARATION',
        'Verifier volume, emballage et declaration liquide.',
        '[]'::jsonb,
        '["Liquid declaration"]'::jsonb,
        20
    ),
    (
        'demo_agency',
        'phone',
        'ELECTRONICS',
        'ALLOWED',
        'Verifier facture fournisseur si disponible.',
        '[]'::jsonb,
        '[]'::jsonb,
        50
    )
on conflict do nothing;

-- =====================================================
-- PERMISSIONS
-- =====================================================

insert into permissions (
    permission_code,
    description
)
values
    ('commercial.read', 'Lire les cases commerciales'),
    ('commercial.manage', 'Gerer le workflow commercial'),
    ('commercial.approve', 'Approuver les devis commerciaux'),
    ('commercial.audit', 'Lire les audits commerciaux')
on conflict (permission_code) do nothing;

insert into role_permissions (
    role_id,
    permission_id
)
select
    r.id,
    p.id
from organization_roles r
join permissions p
    on p.permission_code in (
        'commercial.read',
        'commercial.manage',
        'commercial.approve',
        'commercial.audit'
    )
where r.role_code = 'OWNER'
on conflict do nothing;
