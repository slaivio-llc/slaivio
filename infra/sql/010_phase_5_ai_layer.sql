create table if not exists ai_settings (
    id uuid primary key default gen_random_uuid(),
    org_id text not null unique,
    enabled boolean not null default true,
    provider text not null default 'MISTRAL',
    model_name text not null default 'mistral-large-latest',
    temperature numeric not null default 0.2,
    max_tokens integer not null default 700,
    escalation_confidence numeric not null default 0.4,
    escalation_threshold numeric default 0.60,
    auto_escalation_enabled boolean default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into ai_settings (
    org_id,
    provider,
    model_name,
    temperature,
    max_tokens
)
values (
    'demo_agency',
    'MISTRAL',
    'mistral-large-latest',
    0.2,
    700
)
on conflict (org_id) do nothing;

create table if not exists ai_knowledge_documents (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    title text not null,
    content text not null,
    source text,
    category text,
    tags text[],
    priority integer default 1,
    search_text text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);

alter table ai_knowledge_documents
add column if not exists category text;

alter table ai_knowledge_documents
add column if not exists tags text[];

alter table ai_knowledge_documents
add column if not exists priority integer default 1;

alter table ai_knowledge_documents
add column if not exists search_text text;

alter table ai_knowledge_documents
add column if not exists updated_at timestamptz default now();

update ai_knowledge_documents
set search_text =
    coalesce(title, '') || ' ' ||
    coalesce(content, '') || ' ' ||
    coalesce(category, '')
where search_text is null;

create index if not exists idx_ai_docs_org
on ai_knowledge_documents(org_id);

create index if not exists idx_ai_docs_active
on ai_knowledge_documents(is_active);

create index if not exists idx_ai_docs_category
on ai_knowledge_documents(category);

create index if not exists idx_ai_docs_search_text
on ai_knowledge_documents
using gin(to_tsvector('simple', coalesce(search_text, '')));

insert into ai_knowledge_documents (
    org_id,
    title,
    content,
    source,
    category,
    tags,
    search_text
)
values (
    'demo_agency',
    'Tarifs cargo Chine Kinshasa',
    'Le tarif standard Chine vers Kinshasa est calculé selon le poids, le volume et le type de marchandise. Le client doit fournir la ville de départ, la destination, le poids estimé et le type de marchandise.',
    'manual',
    'pricing',
    array['chine', 'kinshasa', 'cargo'],
    'Tarifs cargo Chine Kinshasa Le tarif standard Chine vers Kinshasa est calculé selon le poids, le volume et le type de marchandise. pricing'
)
on conflict do nothing;

create table if not exists ai_conversation_memory (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    role text not null,
    content text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_memory_lookup
on ai_conversation_memory(org_id, client_phone, created_at desc);

create table if not exists ai_intent_logs (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text,
    message text not null,
    intent text not null,
    confidence numeric,
    entities jsonb default '{}',
    raw_response jsonb,
    created_at timestamptz not null default now()
);

create table if not exists ai_response_decisions (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text,
    message text not null,
    intent text not null,
    confidence numeric,
    decision text not null,
    reason text,
    response_text text,
    entities jsonb default '{}',
    created_at timestamptz not null default now()
);

create table if not exists ai_draft_responses (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    source_message text not null,
    intent text,
    decision text,
    draft_text text not null,
    status text not null default 'DRAFT',
    manager_id text,
    manager_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_ai_drafts_lookup
on ai_draft_responses(org_id, client_phone, created_at desc);

create table if not exists ai_escalation_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text,
    message text not null,
    intent text,
    escalation_score numeric,
    escalation_reason text,
    triggered_rules text[],
    decision text,
    created_at timestamptz not null default now()
);

create table if not exists ai_workflow_runs (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    source_message text not null,
    intent text not null,
    confidence numeric,
    workflow_type text not null,
    workflow_status text not null default 'PREPARED',
    entities jsonb default '{}',
    proposed_actions jsonb default '[]',
    result_payload jsonb default '{}',
    manager_id text,
    manager_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_ai_workflows_lookup
on ai_workflow_runs(org_id, client_phone, created_at desc);

create table if not exists ai_dossier_drafts (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    workflow_id uuid,
    source_message text not null,
    client_name text,
    case_type text default 'SEND_CARGO',
    origin_country text,
    origin_city text,
    destination_country text,
    destination_city text,
    goods_type text,
    estimated_weight_kg numeric,
    estimated_volume_cbm numeric,
    shipping_mode text,
    missing_fields jsonb default '[]',
    status text not null default 'DRAFT',
    created_dossier_id uuid,
    created_shipment_id uuid,
    manager_id text,
    manager_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_ai_dossier_drafts_lookup
on ai_dossier_drafts(org_id, client_phone, created_at desc);
