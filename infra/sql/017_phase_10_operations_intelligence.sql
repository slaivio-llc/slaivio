-- Phase 10.0 - Operations Intelligence Layer
-- SLAIVIO uses organizations.id as text, so org_id is text in this migration.

create table if not exists operational_insights (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    insight_type text not null,
    severity text not null default 'MEDIUM',
    entity_type text,
    entity_id text,
    title text not null,
    message text not null,
    recommended_action text,
    status text not null default 'OPEN',
    metadata jsonb default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz
);

create index if not exists idx_operational_insights_org_status
on operational_insights(org_id, status, created_at desc);

create index if not exists idx_operational_insights_entity
on operational_insights(org_id, insight_type, entity_type, entity_id);

create table if not exists insight_rules (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    rule_code text not null,
    rule_name text not null,
    insight_type text not null,
    severity text not null default 'MEDIUM',
    threshold_value numeric,
    threshold_unit text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(org_id, rule_code)
);

insert into insight_rules (
    org_id,
    rule_code,
    rule_name,
    insight_type,
    severity,
    threshold_value,
    threshold_unit
)
values
    (
        'demo_agency',
        'SHIPMENT_DELAY_OVER_2_DAYS',
        'Shipment en retard de plus de 2 jours',
        'SHIPMENT_DELAYED',
        'HIGH',
        2,
        'days'
    ),
    (
        'demo_agency',
        'WAREHOUSE_STUCK_48H',
        'Colis bloque warehouse plus de 48h',
        'WAREHOUSE_STUCK',
        'HIGH',
        48,
        'hours'
    ),
    (
        'demo_agency',
        'DELIVERY_PENDING_24H',
        'Colis pret pickup non livre apres 24h',
        'DELIVERY_PENDING_TOO_LONG',
        'MEDIUM',
        24,
        'hours'
    ),
    (
        'demo_agency',
        'LOW_WALLET_UNDER_10_USD',
        'Wallet inferieur a 10 USD',
        'LOW_WALLET_BALANCE',
        'HIGH',
        1000,
        'amount_minor'
    ),
    (
        'demo_agency',
        'CUSTOMS_BLOCKED',
        'Shipment bloque en douane',
        'CUSTOMS_BLOCKED',
        'HIGH',
        null,
        null
    ),
    (
        'demo_agency',
        'PAYMENT_BLOCKING_DELIVERY',
        'Paiement bloquant la livraison',
        'PAYMENT_BLOCKING_DELIVERY',
        'CRITICAL',
        null,
        null
    )
on conflict (org_id, rule_code) do nothing;

insert into permissions (
    permission_code,
    description
)
values
    ('dashboard.view', 'Voir le dashboard operations'),
    ('operations.write', 'Executer les detections operations')
on conflict (permission_code) do nothing;

insert into role_permissions (
    role_id,
    permission_id
)
select
    r.id,
    p.id
from organization_roles r
cross join permissions p
where r.org_id = 'demo_agency'
  and r.role_code = 'OWNER'
  and p.permission_code in (
      'dashboard.view',
      'operations.write'
  )
on conflict do nothing;
