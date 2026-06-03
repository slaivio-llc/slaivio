create table if not exists conversation_internal_notes (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    manager_id text,
    manager_name text,
    note text not null,
    created_at timestamptz not null default now()
);

create table if not exists conversation_timeline_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    event_type text not null,
    event_title text,
    event_payload jsonb,
    created_by_id text,
    created_by_name text,
    created_at timestamptz not null default now()
);

create index if not exists idx_conversation_internal_notes_lookup
on conversation_internal_notes(org_id, client_phone, created_at desc);

create index if not exists idx_conversation_timeline_lookup
on conversation_timeline_events(org_id, client_phone, created_at desc);
