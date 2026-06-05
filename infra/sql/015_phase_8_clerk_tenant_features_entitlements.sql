alter table organizations add column if not exists clerk_org_id text;
alter table organizations add column if not exists external_source text;
alter table organizations add column if not exists provisioning_status text default 'PENDING';
alter table organizations add column if not exists onboarded_at timestamptz;

create unique index if not exists uniq_organizations_clerk_org_id
on organizations(clerk_org_id)
where clerk_org_id is not null;

update organizations
set
    clerk_org_id = coalesce(clerk_org_id, 'demo_clerk_org'),
    external_source = coalesce(external_source, 'DEMO'),
    provisioning_status = 'ACTIVE',
    onboarded_at = coalesce(onboarded_at, now())
where id = 'demo_agency';

create table if not exists organization_memberships (
    id uuid primary key default gen_random_uuid(),
    clerk_membership_id text,
    clerk_user_id text not null,
    clerk_org_id text,
    org_id text references organizations(id),
    role_code text,
    status text default 'ACTIVE',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(clerk_user_id, clerk_org_id)
);

insert into organization_memberships (
    clerk_membership_id,
    clerk_user_id,
    clerk_org_id,
    org_id,
    role_code
)
values
    ('demo_membership_jeremy', 'jeremy', 'demo_clerk_org', 'demo_agency', 'OWNER'),
    ('demo_membership_manager', 'demo_manager', 'demo_clerk_org', 'demo_agency', 'OWNER')
on conflict (clerk_user_id, clerk_org_id)
do update set
    org_id = excluded.org_id,
    role_code = excluded.role_code,
    status = 'ACTIVE',
    updated_at = now();

create table if not exists organization_invitations (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    clerk_invitation_id text unique,
    email text not null,
    role_code text not null,
    status text not null default 'PENDING',
    invited_by_id text,
    invited_by_name text,
    created_at timestamptz not null default now(),
    accepted_at timestamptz
);

create table if not exists tenant_sessions (
    id uuid primary key default gen_random_uuid(),
    clerk_user_id text not null,
    org_id text references organizations(id),
    clerk_org_id text,
    active boolean not null default true,
    last_used_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_tenant_sessions_user
on tenant_sessions(clerk_user_id, active);

create table if not exists feature_flags (
    id uuid primary key default gen_random_uuid(),
    flag_key text unique not null,
    flag_name text not null,
    description text,
    default_enabled boolean not null default false,
    category text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists organization_feature_flags (
    id uuid primary key default gen_random_uuid(),
    org_id text references organizations(id),
    flag_key text not null references feature_flags(flag_key),
    enabled boolean not null default false,
    rollout_percentage integer default 100,
    metadata jsonb default '{}',
    updated_by_id text,
    updated_by_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, flag_key)
);

insert into feature_flags (
    flag_key,
    flag_name,
    description,
    default_enabled,
    category
)
values
    ('ai_layer','AI Layer','Activer les fonctionnalités IA',false,'AI'),
    ('ai_drafts','AI Draft Assistant','Brouillons IA dans inbox',false,'AI'),
    ('ai_workflows','AI Workflow Engine','Workflows IA opérationnels',false,'AI'),
    ('finance_dashboard','Financial Dashboard','Dashboard financier',false,'FINANCE'),
    ('wallet','Agency Wallet','Wallet agence et crédits',false,'FINANCE'),
    ('billing','SaaS Billing','Abonnements et factures',false,'FINANCE'),
    ('accounting','Accounting Core','Comptabilité revenus/dépenses',false,'FINANCE'),
    ('whatsapp_enterprise','WhatsApp Enterprise','Connexion WhatsApp officielle',true,'WHATSAPP'),
    ('multi_number','Multi-number Routing','Routage multi-numéros',false,'WHATSAPP'),
    ('broadcasts','Broadcasts','Campagnes WhatsApp',false,'WHATSAPP'),
    ('multi_agency','Multi-agency','Groupes, pays, agences, warehouses',false,'ENTERPRISE'),
    ('performance_sla','SLA Performance','Métriques SLA et performance',false,'ENTERPRISE')
on conflict (flag_key) do nothing;

insert into organization_feature_flags (
    org_id,
    flag_key,
    enabled,
    updated_by_id,
    updated_by_name
)
select
    'demo_agency',
    flag_key,
    true,
    'system',
    'Phase 8 seed'
from feature_flags
where flag_key in (
    'ai_layer',
    'ai_drafts',
    'ai_workflows',
    'finance_dashboard',
    'wallet',
    'billing',
    'accounting',
    'whatsapp_enterprise',
    'multi_number',
    'broadcasts',
    'multi_agency',
    'performance_sla'
)
on conflict (org_id, flag_key)
do update set
    enabled = excluded.enabled,
    updated_at = now();

create table if not exists plan_entitlements (
    id uuid primary key default gen_random_uuid(),
    plan_code text not null,
    entitlement_key text not null,
    entitlement_type text not null,
    boolean_value boolean,
    limit_value integer,
    created_at timestamptz not null default now(),
    unique(plan_code, entitlement_key)
);

insert into plan_entitlements (
    plan_code,
    entitlement_key,
    entitlement_type,
    boolean_value,
    limit_value
)
values
    ('STARTER','ai_layer','BOOLEAN',true,null),
    ('STARTER','ai_drafts','BOOLEAN',false,null),
    ('STARTER','multi_number','BOOLEAN',false,null),
    ('STARTER','finance_dashboard','BOOLEAN',true,null),
    ('STARTER','max_users','LIMIT',null,3),
    ('STARTER','max_whatsapp_numbers','LIMIT',null,1),
    ('STARTER','max_monthly_messages','LIMIT',null,5000),
    ('STARTER','max_ai_requests','LIMIT',null,1000),
    ('PRO','ai_layer','BOOLEAN',true,null),
    ('PRO','ai_drafts','BOOLEAN',true,null),
    ('PRO','ai_workflows','BOOLEAN',true,null),
    ('PRO','multi_number','BOOLEAN',true,null),
    ('PRO','finance_dashboard','BOOLEAN',true,null),
    ('PRO','wallet','BOOLEAN',true,null),
    ('PRO','billing','BOOLEAN',true,null),
    ('PRO','max_users','LIMIT',null,10),
    ('PRO','max_whatsapp_numbers','LIMIT',null,5),
    ('PRO','max_monthly_messages','LIMIT',null,30000),
    ('PRO','max_ai_requests','LIMIT',null,10000),
    ('ENTERPRISE','ai_layer','BOOLEAN',true,null),
    ('ENTERPRISE','ai_drafts','BOOLEAN',true,null),
    ('ENTERPRISE','ai_workflows','BOOLEAN',true,null),
    ('ENTERPRISE','multi_number','BOOLEAN',true,null),
    ('ENTERPRISE','multi_agency','BOOLEAN',true,null),
    ('ENTERPRISE','performance_sla','BOOLEAN',true,null),
    ('ENTERPRISE','finance_dashboard','BOOLEAN',true,null),
    ('ENTERPRISE','wallet','BOOLEAN',true,null),
    ('ENTERPRISE','billing','BOOLEAN',true,null),
    ('ENTERPRISE','accounting','BOOLEAN',true,null),
    ('ENTERPRISE','max_users','LIMIT',null,999),
    ('ENTERPRISE','max_whatsapp_numbers','LIMIT',null,999),
    ('ENTERPRISE','max_monthly_messages','LIMIT',null,999999),
    ('ENTERPRISE','max_ai_requests','LIMIT',null,999999)
on conflict (plan_code, entitlement_key) do nothing;
