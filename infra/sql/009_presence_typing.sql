create table if not exists agent_presence (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    manager_id text not null,
    manager_name text,
    status text not null default 'ONLINE',
    active_conversation text,
    last_seen timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique(org_id, manager_id)
);

create index if not exists idx_agent_presence_org_status
on agent_presence(org_id, status);

create index if not exists idx_agent_presence_active_conversation
on agent_presence(org_id, active_conversation);
