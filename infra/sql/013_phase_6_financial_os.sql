create table if not exists supported_currencies (
    code text primary key,
    symbol text not null,
    name text not null,
    decimal_places integer not null default 2,
    is_active boolean not null default true,
    created_at timestamptz default now()
);

insert into supported_currencies (
    code,
    symbol,
    name,
    decimal_places
)
values
    ('USD', '$', 'US Dollar', 2),
    ('CDF', 'FC', 'Congolese Franc', 2),
    ('XAF', 'FCFA', 'Central Africa Franc', 0),
    ('XOF', 'FCFA', 'West Africa Franc', 0)
on conflict do nothing;

create table if not exists money_config (
    id uuid primary key default gen_random_uuid(),
    currency_code text references supported_currencies(code),
    minor_unit integer not null,
    created_at timestamptz default now(),
    unique(currency_code)
);

insert into money_config (
    currency_code,
    minor_unit
)
values
    ('USD', 100),
    ('CDF', 100),
    ('XAF', 1),
    ('XOF', 1)
on conflict (currency_code) do nothing;

alter table shipments
add column if not exists payment_status text default 'PENDING_PAYMENT';

alter table shipments
add column if not exists currency_code text default 'USD';

alter table shipments
add column if not exists shipment_price_minor bigint;

alter table shipments
add column if not exists revenue_minor bigint default 0;

alter table shipments
add column if not exists cost_minor bigint default 0;

alter table shipments
add column if not exists profit_minor bigint default 0;

alter table shipments
add column if not exists margin_currency_code text default 'USD';

create table if not exists financial_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    entity_type text not null,
    entity_id text not null,
    event_type text not null,
    amount_minor bigint,
    currency_code text,
    metadata jsonb default '{}',
    created_at timestamptz default now()
);

alter table financial_events
add column if not exists source_type text;

alter table financial_events
add column if not exists source_id text;

alter table financial_events
add column if not exists description text;

alter table financial_events
alter column entity_type drop not null;

alter table financial_events
alter column entity_id drop not null;

create table if not exists financial_audit_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text,
    actor_id text,
    actor_name text,
    action text,
    payload jsonb,
    severity text default 'INFO',
    entity_type text,
    entity_id text,
    ip_address text,
    user_agent text,
    created_at timestamptz default now()
);

alter table financial_audit_logs
add column if not exists severity text default 'INFO';

alter table financial_audit_logs
add column if not exists entity_type text;

alter table financial_audit_logs
add column if not exists entity_id text;

alter table financial_audit_logs
add column if not exists ip_address text;

alter table financial_audit_logs
add column if not exists user_agent text;

alter table financial_audit_logs
add column if not exists before_state jsonb;

alter table financial_audit_logs
add column if not exists after_state jsonb;

create table if not exists payment_methods (
    id uuid primary key default gen_random_uuid(),
    org_id text,
    provider text,
    method_type text,
    display_name text,
    config jsonb default '{}',
    is_active boolean default true,
    created_at timestamptz default now()
);

create table if not exists pricing_plans (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    description text,
    monthly_price_minor bigint not null,
    quarterly_price_minor bigint,
    semiannual_price_minor bigint,
    yearly_price_minor bigint,
    currency_code text not null default 'USD',
    max_users integer,
    max_whatsapp_numbers integer,
    max_monthly_messages integer,
    max_ai_requests integer,
    ai_enabled boolean not null default true,
    broadcasts_enabled boolean not null default true,
    multi_number_enabled boolean not null default false,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into pricing_plans (
    code,
    name,
    description,
    monthly_price_minor,
    quarterly_price_minor,
    semiannual_price_minor,
    yearly_price_minor,
    currency_code,
    max_users,
    max_whatsapp_numbers,
    max_monthly_messages,
    max_ai_requests,
    ai_enabled,
    broadcasts_enabled,
    multi_number_enabled
)
values
    (
        'STARTER',
        'Starter',
        'Pour petite agence cargo qui démarre avec un seul numéro WhatsApp.',
        4900,
        13900,
        25900,
        45900,
        'USD',
        3,
        1,
        5000,
        1000,
        true,
        true,
        false
    ),
    (
        'PRO',
        'Pro',
        'Pour agence cargo active avec équipe, IA et plusieurs opérations.',
        9900,
        27900,
        51900,
        94900,
        'USD',
        10,
        5,
        30000,
        10000,
        true,
        true,
        true
    ),
    (
        'ENTERPRISE',
        'Enterprise',
        'Pour groupe cargo multi-pays, multi-numéros et volume élevé.',
        19900,
        56900,
        109900,
        199900,
        'USD',
        999,
        999,
        999999,
        999999,
        true,
        true,
        true
    )
on conflict (code) do nothing;

create table if not exists agency_subscriptions (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    pricing_plan_id uuid references pricing_plans(id),
    status text not null default 'TRIAL',
    billing_cycle text not null default 'MONTHLY',
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    trial_ends_at timestamptz,
    grace_until timestamptz,
    auto_renew boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id)
);

create table if not exists billing_invoices (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    subscription_id uuid references agency_subscriptions(id),
    invoice_number text unique not null,
    status text not null default 'DRAFT',
    amount_minor bigint not null,
    amount_paid_minor bigint not null default 0,
    currency_code text not null default 'USD',
    due_date timestamptz,
    issued_at timestamptz,
    paid_at timestamptz,
    billing_period_start timestamptz,
    billing_period_end timestamptz,
    metadata jsonb default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table billing_invoices
add column if not exists tax_minor bigint not null default 0;

alter table billing_invoices
add column if not exists total_minor bigint;

update billing_invoices
set total_minor = amount_minor + tax_minor
where total_minor is null;

alter table billing_invoices
alter column total_minor set default 0;

alter table billing_invoices
add column if not exists due_at timestamptz;

create table if not exists billing_payments (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    invoice_id uuid references billing_invoices(id),
    amount_minor bigint not null,
    currency_code text not null default 'USD',
    payment_method text not null,
    provider_reference text,
    status text not null default 'PENDING',
    confirmed_by_id text,
    confirmed_by_name text,
    paid_at timestamptz,
    idempotency_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table billing_payments
add column if not exists provider text;

alter table billing_payments
add column if not exists provider_payment_id text;

alter table billing_payments
add column if not exists idempotency_key text;

create unique index if not exists uniq_billing_payments_idempotency_key
on billing_payments(idempotency_key)
where idempotency_key is not null;

create table if not exists subscription_access_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    subscription_id uuid,
    old_status text,
    new_status text,
    reason text,
    created_at timestamptz not null default now()
);

create table if not exists agency_wallets (
    id uuid primary key default gen_random_uuid(),
    org_id text not null unique,
    balance_minor bigint not null default 0,
    currency_code text not null default 'USD',
    status text not null default 'ACTIVE',
    low_balance_threshold_minor bigint not null default 1000,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table agency_wallets
add column if not exists reserved_minor bigint not null default 0;

create table if not exists wallet_transactions (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    wallet_id uuid references agency_wallets(id),
    transaction_type text not null,
    amount_minor bigint not null,
    currency_code text not null default 'USD',
    balance_before_minor bigint not null,
    balance_after_minor bigint not null,
    status text not null default 'COMPLETED',
    source_type text,
    source_id text,
    description text,
    metadata jsonb default '{}',
    idempotency_key text,
    created_by_id text,
    created_by_name text,
    created_at timestamptz not null default now()
);

alter table wallet_transactions
alter column balance_before_minor set default 0;

alter table wallet_transactions
alter column balance_after_minor set default 0;

alter table wallet_transactions
add column if not exists updated_at timestamptz not null default now();

alter table wallet_transactions
add column if not exists idempotency_key text;

create unique index if not exists uniq_wallet_transactions_idempotency_key
on wallet_transactions(idempotency_key)
where idempotency_key is not null;

create table if not exists usage_charge_rules (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    unit_price_minor bigint not null,
    currency_code text not null default 'USD',
    unit text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into usage_charge_rules (
    code,
    name,
    unit_price_minor,
    currency_code,
    unit
)
values
    ('WHATSAPP_MESSAGE', 'WhatsApp message usage', 2, 'USD', 'MESSAGE'),
    ('AI_REQUEST', 'AI request usage', 1, 'USD', 'AI_REQUEST'),
    (
        'BROADCAST_RECIPIENT',
        'Broadcast recipient usage',
        1,
        'USD',
        'BROADCAST_RECIPIENT'
    )
on conflict (code) do nothing;

create table if not exists payment_providers (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    provider_type text not null,
    country_code text,
    currency_code text,
    active boolean default true,
    config jsonb default '{}',
    created_at timestamptz default now()
);

insert into payment_providers (
    code,
    name,
    provider_type,
    country_code,
    currency_code
)
values
    ('MTN_MOMO', 'MTN Mobile Money', 'MOBILE_MONEY', 'CD', 'USD'),
    ('ORANGE_MONEY', 'Orange Money', 'MOBILE_MONEY', 'CD', 'USD'),
    ('WAVE', 'Wave', 'MOBILE_MONEY', 'SN', 'XOF')
on conflict(code) do nothing;

create table if not exists payment_requests (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    provider_code text not null,
    amount_minor bigint not null,
    currency_code text not null,
    external_reference text unique,
    customer_phone text,
    customer_name text,
    payment_purpose text,
    status text not null default 'PENDING',
    provider_transaction_id text,
    metadata jsonb default '{}',
    expires_at timestamptz,
    idempotency_key text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table payment_requests
add column if not exists paid_at timestamptz;

alter table payment_requests
add column if not exists failed_at timestamptz;

alter table payment_requests
add column if not exists description text;

alter table payment_requests
add column if not exists provider_reference text;

alter table payment_requests
add column if not exists source_type text;

alter table payment_requests
add column if not exists source_id text;

alter table payment_requests
add column if not exists raw_response jsonb;

alter table payment_requests
add column if not exists idempotency_key text;

create unique index if not exists uniq_payment_requests_idempotency_key
on payment_requests(idempotency_key)
where idempotency_key is not null;

create table if not exists payment_webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider_code text,
    external_reference text,
    payload jsonb,
    processed boolean default false,
    created_at timestamptz default now()
);

create table if not exists accounting_categories (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    code text not null,
    name text not null,
    category_type text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(org_id, code)
);

alter table accounting_categories
add column if not exists updated_at timestamptz not null default now();

insert into accounting_categories (
    org_id,
    code,
    name,
    category_type
)
values
    ('demo_agency', 'SHIPMENT_REVENUE', 'Revenus expéditions', 'REVENUE'),
    ('demo_agency', 'DELIVERY_REVENUE', 'Revenus livraison', 'REVENUE'),
    ('demo_agency', 'WAREHOUSE_COST', 'Coûts entrepôt', 'EXPENSE'),
    ('demo_agency', 'AIR_FREIGHT_COST', 'Coût fret aérien', 'EXPENSE'),
    ('demo_agency', 'SEA_FREIGHT_COST', 'Coût fret maritime', 'EXPENSE'),
    ('demo_agency', 'CUSTOMS_COST', 'Frais douane', 'EXPENSE'),
    ('demo_agency', 'DELIVERY_COST', 'Coût livraison locale', 'EXPENSE'),
    ('demo_agency', 'OPERATIONAL_EXPENSE', 'Dépense opérationnelle', 'EXPENSE')
on conflict (org_id, code) do nothing;

create table if not exists accounting_entries (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    category_id uuid references accounting_categories(id),
    entry_type text not null,
    amount_minor bigint not null,
    currency_code text not null default 'USD',
    entity_type text,
    entity_id text,
    description text,
    payment_method text,
    recorded_by_id text,
    recorded_by_name text,
    metadata jsonb default '{}',
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists shipment_financial_components (
    id uuid primary key default gen_random_uuid(),
    shipment_id uuid not null,
    org_id text not null,
    component_type text not null,
    component_code text not null,
    component_name text not null,
    amount_minor bigint not null,
    currency_code text not null default 'USD',
    payment_status text,
    metadata jsonb default '{}',
    created_by_id text,
    created_at timestamptz default now()
);

create table if not exists shipment_financial_snapshots (
    shipment_id uuid primary key,
    org_id text not null,
    total_revenue_minor bigint default 0,
    total_cost_minor bigint default 0,
    total_profit_minor bigint default 0,
    margin_percent numeric(10,2) default 0,
    total_paid_minor bigint default 0,
    total_unpaid_minor bigint default 0,
    currency_code text default 'USD',
    updated_at timestamptz default now()
);

create table if not exists shipment_payments (
    id uuid primary key default gen_random_uuid(),
    shipment_id uuid not null,
    billing_payment_id uuid,
    payment_request_id uuid,
    amount_minor bigint not null,
    currency_code text,
    payment_method text,
    status text,
    created_at timestamptz default now()
);

create table if not exists financial_idempotency_keys (
    id uuid primary key default gen_random_uuid(),
    idempotency_key text unique not null,
    entity_type text,
    entity_id text,
    request_hash text,
    response_payload jsonb,
    created_at timestamptz not null default now()
);

alter table financial_idempotency_keys
add column if not exists org_id text;

alter table financial_idempotency_keys
add column if not exists operation_type text;
