create table if not exists organizations (
    id text primary key,
    name text,
    country text,
    city text,
    created_at timestamptz default now()
);

alter table organizations add column if not exists organization_code text;
alter table organizations add column if not exists organization_name text;
alter table organizations add column if not exists organization_type text;
alter table organizations add column if not exists status text not null default 'ACTIVE';
alter table organizations add column if not exists updated_at timestamptz default now();
alter table organizations add column if not exists group_id uuid;
alter table organizations add column if not exists country_id uuid;
alter table organizations add column if not exists parent_org_id text;
alter table organizations add column if not exists agency_type text default 'AGENCY';
alter table organizations add column if not exists address text;
alter table organizations add column if not exists phone text;
alter table organizations add column if not exists email text;

create unique index if not exists uniq_organizations_code
on organizations(organization_code)
where organization_code is not null;

insert into organizations (
    id,
    name,
    country,
    city,
    organization_code,
    organization_name,
    organization_type,
    agency_type
)
values (
    'demo_agency',
    'SLAIVO Demo Agency',
    'CD',
    'Kinshasa',
    'demo_agency',
    'SLAIVO Demo Agency',
    'AGENCY',
    'AGENCY'
)
on conflict (id)
do update set
    name = excluded.name,
    organization_code = excluded.organization_code,
    organization_name = excluded.organization_name,
    organization_type = excluded.organization_type,
    updated_at = now();

create table if not exists organization_settings (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    timezone text default 'UTC',
    currency_code text default 'USD',
    country_code text,
    language_code text default 'fr',
    settings jsonb default '{}',
    updated_at timestamptz default now(),
    unique(org_id)
);

insert into organization_settings (
    org_id,
    timezone,
    currency_code,
    country_code,
    language_code
)
values (
    'demo_agency',
    'Africa/Kinshasa',
    'USD',
    'CD',
    'fr'
)
on conflict (org_id) do nothing;

create table if not exists user_organizations (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    org_id text references organizations(id),
    membership_status text default 'ACTIVE',
    created_at timestamptz default now(),
    unique(user_id, org_id)
);

insert into user_organizations (
    user_id,
    org_id
)
values
    ('jeremy', 'demo_agency'),
    ('demo_manager', 'demo_agency')
on conflict (user_id, org_id) do nothing;

create table if not exists organization_groups (
    id uuid primary key default gen_random_uuid(),
    group_code text unique not null,
    group_name text not null,
    status text not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists organization_countries (
    id uuid primary key default gen_random_uuid(),
    group_id uuid references organization_groups(id),
    country_code text not null,
    country_name text not null,
    default_currency_code text default 'USD',
    default_timezone text default 'UTC',
    status text not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(group_id, country_code)
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'organizations_group_fk'
    ) then
        alter table organizations
        add constraint organizations_group_fk
        foreign key (group_id)
        references organization_groups(id)
        not valid;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'organizations_country_fk'
    ) then
        alter table organizations
        add constraint organizations_country_fk
        foreign key (country_id)
        references organization_countries(id)
        not valid;
    end if;
end $$;

create table if not exists warehouses (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    group_id uuid references organization_groups(id),
    country_id uuid references organization_countries(id),
    warehouse_code text unique not null,
    warehouse_name text not null,
    warehouse_type text not null,
    country_code text,
    city text,
    address text,
    contact_phone text,
    contact_name text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table shipments add column if not exists tenant_org_id text references organizations(id);
alter table shipments add column if not exists group_id uuid;
alter table shipments add column if not exists agency_org_id text;
alter table shipments add column if not exists origin_warehouse_id uuid;
alter table shipments add column if not exists destination_warehouse_id uuid;
alter table shipments add column if not exists route_label text;

do $$
begin
    if to_regclass('public.dossiers') is not null then
        alter table dossiers add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.messages') is not null then
        alter table messages add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.followups') is not null then
        alter table followups add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.notification_outbox') is not null then
        alter table notification_outbox add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.agency_wallets') is not null then
        alter table agency_wallets add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.payment_requests') is not null then
        alter table payment_requests add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.billing_invoices') is not null then
        alter table billing_invoices add column if not exists tenant_org_id text references organizations(id);
    end if;

    if to_regclass('public.accounting_entries') is not null then
        alter table accounting_entries add column if not exists tenant_org_id text references organizations(id);
    end if;
end $$;

create table if not exists permissions (
    id uuid primary key default gen_random_uuid(),
    permission_code text unique not null,
    description text,
    created_at timestamptz not null default now()
);

insert into permissions (
    permission_code,
    description
)
values
    ('inbox.read','Lire les conversations inbox'),
    ('inbox.reply','Répondre aux clients'),
    ('inbox.assign','Assigner les conversations'),
    ('shipments.read','Lire les shipments'),
    ('shipments.create','Créer shipments'),
    ('shipments.update','Modifier shipments'),
    ('shipments.confirm_arrival','Confirmer arrivée colis'),
    ('dossiers.read','Lire dossiers'),
    ('dossiers.create','Créer dossiers'),
    ('dossiers.update','Modifier dossiers'),
    ('warehouse.read','Lire opérations warehouse'),
    ('warehouse.update','Modifier opérations warehouse'),
    ('finance.read','Lire données financières'),
    ('finance.write','Modifier données financières'),
    ('wallet.read','Lire wallet'),
    ('wallet.write','Modifier wallet'),
    ('billing.read','Lire billing'),
    ('billing.write','Modifier billing'),
    ('accounting.read','Lire accounting'),
    ('accounting.write','Modifier accounting'),
    ('settings.read','Lire settings'),
    ('settings.write','Modifier settings'),
    ('whatsapp.settings','Gérer WhatsApp settings'),
    ('knowledge.write','Modifier knowledge base'),
    ('team.read','Lire équipe'),
    ('team.write','Modifier équipe'),
    ('audit.read','Lire audit logs')
on conflict (permission_code) do nothing;

create table if not exists organization_roles (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    role_code text not null,
    role_name text not null,
    description text,
    system_role boolean not null default true,
    created_at timestamptz not null default now(),
    unique(org_id, role_code)
);

insert into organization_roles (
    org_id,
    role_code,
    role_name,
    description
)
values
    ('demo_agency','OWNER','Owner','Accès total'),
    ('demo_agency','MANAGER','Manager','Gestion opérationnelle'),
    ('demo_agency','OPERATOR','Operator','Opérations dossiers et shipments'),
    ('demo_agency','WAREHOUSE','Warehouse','Opérations entrepôt'),
    ('demo_agency','SUPPORT','Support','Support client'),
    ('demo_agency','FINANCE','Finance','Finance et comptabilité')
on conflict (org_id, role_code) do nothing;

create table if not exists role_permissions (
    role_id uuid references organization_roles(id),
    permission_id uuid references permissions(id),
    created_at timestamptz not null default now(),
    primary key (role_id, permission_id)
);

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
on conflict do nothing;

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
        'finance.read',
        'finance.write',
        'wallet.read',
        'wallet.write',
        'billing.read',
        'billing.write',
        'accounting.read',
        'accounting.write',
        'audit.read'
    )
where r.org_id = 'demo_agency'
  and r.role_code = 'FINANCE'
on conflict do nothing;

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
        'inbox.read',
        'inbox.reply',
        'inbox.assign',
        'dossiers.read',
        'shipments.read'
    )
where r.org_id = 'demo_agency'
  and r.role_code = 'SUPPORT'
on conflict do nothing;

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
        'warehouse.read',
        'warehouse.update',
        'shipments.read',
        'shipments.update',
        'shipments.confirm_arrival'
    )
where r.org_id = 'demo_agency'
  and r.role_code = 'WAREHOUSE'
on conflict do nothing;

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
        'inbox.read',
        'dossiers.read',
        'dossiers.create',
        'dossiers.update',
        'shipments.read',
        'shipments.create',
        'shipments.update'
    )
where r.org_id = 'demo_agency'
  and r.role_code = 'OPERATOR'
on conflict do nothing;

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
        'inbox.read',
        'inbox.reply',
        'inbox.assign',
        'dossiers.read',
        'dossiers.create',
        'dossiers.update',
        'shipments.read',
        'shipments.create',
        'shipments.update',
        'shipments.confirm_arrival',
        'warehouse.read',
        'warehouse.update',
        'settings.read',
        'knowledge.write',
        'team.read',
        'audit.read'
    )
where r.org_id = 'demo_agency'
  and r.role_code = 'MANAGER'
on conflict do nothing;

create table if not exists user_role_assignments (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    org_id text references organizations(id),
    role_id uuid references organization_roles(id),
    assignment_status text not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    unique(user_id, org_id, role_id)
);

insert into user_role_assignments (
    user_id,
    org_id,
    role_id
)
select
    user_id,
    r.org_id,
    r.id
from (
    values ('jeremy'), ('demo_manager')
) as users(user_id)
cross join organization_roles r
where r.org_id = 'demo_agency'
  and r.role_code = 'OWNER'
on conflict do nothing;

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    actor_id text,
    actor_name text,
    actor_role text,
    entity_type text,
    entity_id text,
    action text,
    old_data jsonb,
    new_data jsonb,
    metadata jsonb default '{}',
    ip_address text,
    user_agent text,
    severity text default 'INFO',
    created_at timestamptz default now()
);

create index if not exists idx_audit_logs_org on audit_logs(org_id);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor on audit_logs(actor_id);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);

create table if not exists sla_policies (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    policy_code text not null,
    policy_name text not null,
    metric_type text not null,
    target_minutes integer,
    target_hours integer,
    target_days integer,
    severity text not null default 'MEDIUM',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, policy_code)
);

insert into sla_policies (
    org_id,
    policy_code,
    policy_name,
    metric_type,
    target_minutes,
    target_hours,
    target_days,
    severity
)
values
    ('demo_agency','SUPPORT_FIRST_RESPONSE_15M','Première réponse support < 15 minutes','RESPONSE_TIME',15,null,null,'HIGH'),
    ('demo_agency','WAREHOUSE_CONFIRM_24H','Confirmation warehouse < 24 heures','WAREHOUSE_DELAY',null,24,null,'HIGH'),
    ('demo_agency','SHIPMENT_ARRIVAL_DELAY','Retard shipment supérieur à ETA','SHIPMENT_DELAY',null,null,0,'CRITICAL')
on conflict (org_id, policy_code) do nothing;

create table if not exists performance_metrics (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    metric_type text not null,
    metric_name text not null,
    metric_value numeric not null,
    metric_unit text not null,
    entity_type text,
    entity_id text,
    actor_id text,
    actor_name text,
    metadata jsonb default '{}',
    measured_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create table if not exists sla_breaches (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    sla_policy_id uuid references sla_policies(id),
    metric_id uuid references performance_metrics(id),
    entity_type text,
    entity_id text,
    breach_type text not null,
    severity text not null,
    expected_value numeric,
    actual_value numeric,
    status text not null default 'OPEN',
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);
