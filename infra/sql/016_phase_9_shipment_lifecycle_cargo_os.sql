-- Phase 9 - Shipment Lifecycle Cargo OS
-- Adapted to SLAIVO's existing tenant model where organizations.id is text.

create table if not exists shipment_status_transitions (
    id uuid primary key default gen_random_uuid(),
    from_status text,
    to_status text not null,
    active boolean not null default true,
    unique(from_status, to_status)
);

insert into shipment_status_transitions (from_status, to_status)
values
    ('DRAFT', 'PENDING_DEPOSIT'),
    ('CREATED', 'DRAFT'),
    ('CREATED', 'PENDING_DEPOSIT'),
    ('CREATED', 'RECEIVED_AT_ORIGIN'),
    ('PENDING_DEPOSIT', 'DEPOSIT_CONFIRMED'),
    ('DEPOSIT_CONFIRMED', 'WAITING_SUPPLIER'),
    ('WAITING_SUPPLIER', 'RECEIVED_AT_ORIGIN'),
    ('DEPOSIT_CONFIRMED', 'RECEIVED_AT_ORIGIN'),
    ('RECEIVED_AT_ORIGIN', 'WAREHOUSE_PROCESSING'),
    ('WAREHOUSE_PROCESSING', 'READY_FOR_DISPATCH'),
    ('READY_FOR_DISPATCH', 'IN_TRANSIT'),
    ('IN_TRANSIT', 'CUSTOMS'),
    ('CUSTOMS', 'ARRIVED_DESTINATION'),
    ('IN_TRANSIT', 'ARRIVED_DESTINATION'),
    ('ARRIVED_DESTINATION', 'READY_PICKUP'),
    ('ARRIVED_DESTINATION', 'READY_FOR_PICKUP'),
    ('READY_FOR_PICKUP', 'DELIVERED'),
    ('READY_PICKUP', 'DELIVERED'),
    ('IN_TRANSIT', 'LOST'),
    ('IN_TRANSIT', 'RETURNED'),
    ('ANY', 'CANCELLED')
on conflict do nothing;

alter table shipments add column if not exists current_status text default 'DRAFT';
alter table shipments add column if not exists eta_at timestamptz;
alter table shipments add column if not exists dispatched_at timestamptz;
alter table shipments add column if not exists delivered_at timestamptz;
alter table shipments add column if not exists current_warehouse_id uuid;
alter table shipments add column if not exists status_updated_at timestamptz default now();
alter table shipments add column if not exists received_at_origin_at timestamptz;
alter table shipments add column if not exists actual_weight_kg numeric;
alter table shipments add column if not exists actual_volume_cbm numeric;
alter table shipments add column if not exists package_condition text;
alter table shipments add column if not exists current_batch_id uuid;
alter table shipments add column if not exists batch_status text;
alter table shipments add column if not exists manifest_id uuid;
alter table shipments add column if not exists customs_status text default 'NOT_REQUIRED';
alter table shipments add column if not exists customs_risk_level text;
alter table shipments add column if not exists compliance_hold boolean not null default false;
alter table shipments add column if not exists route_id uuid;
alter table shipments add column if not exists estimated_arrival_at timestamptz;
alter table shipments add column if not exists delay_status text default 'ON_TIME';
alter table shipments add column if not exists delay_reason text;
alter table shipments add column if not exists public_tracking_token text;
alter table shipments add column if not exists public_tracking_enabled boolean not null default true;
alter table shipments add column if not exists barcode text;
alter table shipments add column if not exists qr_code_value text;
alter table shipments add column if not exists last_scan_at timestamptz;
alter table shipments add column if not exists last_scan_location text;
alter table shipments add column if not exists storage_location_id uuid;
alter table shipments add column if not exists inventory_status text default 'NOT_STORED';
alter table shipments add column if not exists delivery_status text default 'NOT_READY';
alter table shipments add column if not exists pickup_ready_at timestamptz;
alter table shipments add column if not exists pickup_completed_at timestamptz;
alter table shipments add column if not exists delivered_to_name text;
alter table shipments add column if not exists delivered_to_phone text;
alter table shipments add column if not exists delivery_blocked_reason text;
alter table shipments add column if not exists payment_clearance_status text default 'UNKNOWN';
alter table shipments add column if not exists proof_required boolean not null default true;
alter table shipments add column if not exists final_release_status text default 'PENDING';

update shipments
set current_status = coalesce(current_status, status, 'DRAFT')
where current_status is null;

create table if not exists shipment_lifecycle_events (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    dossier_id uuid references dossiers(id),
    previous_status text,
    new_status text not null,
    event_type text not null,
    event_source text not null,
    event_message text,
    metadata jsonb default '{}',
    actor_id text,
    actor_name text,
    created_at timestamptz not null default now()
);

create index if not exists idx_shipment_lifecycle_events_shipment
on shipment_lifecycle_events(shipment_id, created_at desc);

create table if not exists warehouse_receipts (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    warehouse_id uuid references warehouses(id),
    receipt_code text unique,
    received_by_id text,
    received_by_name text,
    supplier_name text,
    supplier_phone text,
    package_label text,
    package_condition text default 'UNKNOWN',
    measured_weight_kg numeric,
    measured_volume_cbm numeric,
    notes text,
    received_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists warehouse_receipt_media (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    receipt_id uuid references warehouse_receipts(id),
    shipment_id uuid references shipments(id),
    media_url text not null,
    media_type text not null default 'IMAGE',
    caption text,
    uploaded_by_id text,
    uploaded_by_name text,
    created_at timestamptz not null default now()
);

create table if not exists shipment_batches (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    batch_code text unique not null,
    batch_type text not null,
    route_origin_country text,
    route_origin_city text,
    route_destination_country text,
    route_destination_city text,
    origin_warehouse_id uuid references warehouses(id),
    destination_warehouse_id uuid references warehouses(id),
    carrier_name text,
    carrier_reference text,
    status text not null default 'DRAFT',
    eta_at timestamptz,
    dispatched_at timestamptz,
    arrived_at timestamptz,
    notes text,
    created_by_id text,
    created_by_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists shipment_batch_items (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    batch_id uuid references shipment_batches(id) on delete cascade,
    shipment_id uuid references shipments(id),
    added_by_id text,
    added_by_name text,
    added_at timestamptz not null default now(),
    unique(batch_id, shipment_id)
);

create table if not exists shipment_batch_events (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    batch_id uuid references shipment_batches(id),
    previous_status text,
    new_status text not null,
    event_type text not null,
    event_source text not null,
    event_message text,
    metadata jsonb default '{}',
    actor_id text,
    actor_name text,
    created_at timestamptz not null default now()
);

create table if not exists shipment_manifests (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    batch_id uuid references shipment_batches(id),
    manifest_code text unique not null,
    manifest_type text not null default 'BATCH',
    status text not null default 'DRAFT',
    total_shipments integer not null default 0,
    total_weight_kg numeric,
    total_volume_cbm numeric,
    generated_by_id text,
    generated_by_name text,
    raw_payload jsonb default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists shipment_manifest_items (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    manifest_id uuid references shipment_manifests(id) on delete cascade,
    batch_id uuid references shipment_batches(id),
    shipment_id uuid references shipments(id),
    tracking_id text,
    goods_type text,
    weight_kg numeric,
    volume_cbm numeric,
    created_at timestamptz not null default now(),
    unique(manifest_id, shipment_id)
);

create table if not exists batch_documents (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    batch_id uuid references shipment_batches(id),
    manifest_id uuid references shipment_manifests(id),
    document_type text not null,
    document_url text,
    document_status text not null default 'GENERATED',
    generated_by_id text,
    generated_by_name text,
    metadata jsonb default '{}',
    created_at timestamptz not null default now()
);

alter table shipment_batches add column if not exists manifest_status text default 'NOT_GENERATED';
alter table shipment_batches add column if not exists last_manifest_id uuid;

create table if not exists customs_cases (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    batch_id uuid references shipment_batches(id),
    case_code text unique not null,
    customs_status text not null default 'OPEN',
    risk_level text not null default 'UNKNOWN',
    country_code text,
    declared_value numeric,
    declared_currency text,
    goods_description text,
    blocked_reason text,
    opened_by_id text,
    opened_by_name text,
    resolved_by_id text,
    resolved_by_name text,
    resolved_at timestamptz,
    raw_payload jsonb default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists customs_documents (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    customs_case_id uuid references customs_cases(id) on delete cascade,
    shipment_id uuid references shipments(id),
    document_type text not null,
    document_url text,
    document_status text not null default 'PENDING',
    uploaded_by_id text,
    uploaded_by_name text,
    created_at timestamptz not null default now()
);

create table if not exists customs_goods_rules (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    country_code text,
    goods_type text not null,
    risk_level text not null default 'LOW',
    requires_document boolean not null default false,
    forbidden boolean not null default false,
    rule_message text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(org_id, country_code, goods_type)
);

create table if not exists shipping_routes (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    route_code text unique not null,
    route_name text not null,
    origin_country text,
    origin_city text,
    destination_country text,
    destination_city text,
    transport_mode text not null default 'AIR',
    expected_duration_days integer,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists shipment_eta_tracking (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    route_id uuid references shipping_routes(id),
    previous_eta_at timestamptz,
    new_eta_at timestamptz,
    delay_status text default 'ON_TIME',
    delay_reason text,
    event_source text default 'SYSTEM',
    created_at timestamptz not null default now()
);

create table if not exists shipment_public_access_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    tracking_token text,
    ip_address text,
    user_agent text,
    created_at timestamptz not null default now()
);

create table if not exists shipment_tracking_views (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    tracking_id text,
    current_status text,
    public_message text,
    location_label text,
    eta_at timestamptz,
    event_payload jsonb default '{}',
    created_at timestamptz not null default now()
);

create unique index if not exists uniq_shipments_public_tracking_token
on shipments(public_tracking_token)
where public_tracking_token is not null;

create table if not exists shipment_scan_events (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    barcode text,
    scan_type text not null,
    warehouse_id uuid references warehouses(id),
    location_label text,
    scanned_by_id text,
    scanned_by_name text,
    metadata jsonb default '{}',
    created_at timestamptz not null default now()
);

create table if not exists shipment_barcodes (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    barcode text unique not null,
    qr_code_value text,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists warehouse_locations (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    warehouse_id uuid references warehouses(id),
    location_code text not null,
    location_name text,
    zone text,
    capacity_units integer,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(warehouse_id, location_code)
);

create table if not exists warehouse_zones (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    warehouse_id uuid references warehouses(id),
    zone_code text not null,
    zone_name text,
    zone_type text default 'GENERAL',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(warehouse_id, zone_code)
);

create table if not exists warehouse_storage_locations (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    warehouse_id uuid references warehouses(id),
    zone_id uuid references warehouse_zones(id),
    location_code text not null,
    location_name text,
    capacity_units integer default 0,
    occupied_units integer default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(warehouse_id, location_code)
);

create table if not exists shipment_inventory (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    warehouse_id uuid references warehouses(id),
    storage_location_id uuid references warehouse_storage_locations(id),
    inventory_status text not null default 'STORED',
    stored_at timestamptz not null default now(),
    removed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, shipment_id)
);

create table if not exists inventory_movements (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    from_location_id uuid,
    to_location_id uuid,
    movement_type text not null,
    moved_by_id text,
    moved_by_name text,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists shipment_delivery_jobs (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    job_type text not null default 'PICKUP',
    status text not null default 'READY',
    recipient_name text,
    recipient_phone text,
    pickup_location text,
    delivery_address text,
    scheduled_at timestamptz,
    completed_at timestamptz,
    assigned_manager_id text,
    assigned_manager_name text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists delivery_proofs (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    delivery_job_id uuid references shipment_delivery_jobs(id),
    shipment_id uuid references shipments(id),
    proof_type text not null,
    proof_url text,
    proof_text text,
    verified boolean not null default false,
    captured_by_id text,
    captured_by_name text,
    metadata jsonb default '{}',
    created_at timestamptz not null default now()
);

alter table delivery_proofs add column if not exists verification_status text default 'PENDING';
alter table delivery_proofs add column if not exists payment_check_id uuid;

create table if not exists delivery_otps (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    delivery_job_id uuid references shipment_delivery_jobs(id),
    shipment_id uuid references shipments(id),
    otp_code text not null,
    status text not null default 'PENDING',
    expires_at timestamptz,
    verified_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists delivery_payment_checks (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    shipment_id uuid references shipments(id),
    delivery_job_id uuid references shipment_delivery_jobs(id),
    required_amount numeric,
    paid_amount numeric,
    currency text,
    payment_status text not null default 'UNKNOWN',
    release_allowed boolean not null default false,
    checked_by_id text,
    checked_by_name text,
    raw_payload jsonb default '{}',
    created_at timestamptz not null default now()
);

create table if not exists delivery_verification_sessions (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    delivery_job_id uuid references shipment_delivery_jobs(id),
    shipment_id uuid references shipments(id),
    session_status text not null default 'OPEN',
    verification_method text,
    payment_check_id uuid references delivery_payment_checks(id),
    proof_id uuid,
    otp_id uuid,
    release_decision text default 'PENDING',
    decision_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
