-- Phase 3.8: persistent atomic webhook idempotency.

create table if not exists processed_webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null default 'META',
    event_key text not null unique,
    event_type text,
    payload_hash text,
    processed_at timestamptz not null default now(),
    raw_payload jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists uniq_processed_webhook_event_key
on processed_webhook_events(event_key);
