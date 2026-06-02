-- Phase 3.7: delivery status history and outbox state.

alter table notification_outbox
add column if not exists delivery_status text;

alter table notification_outbox
add column if not exists delivered_at timestamptz;

alter table notification_outbox
add column if not exists read_at timestamptz;

alter table notification_outbox
add column if not exists failed_at timestamptz;

alter table notification_outbox
add column if not exists error_code text;

alter table notification_outbox
add column if not exists error_title text;

alter table notification_outbox
add column if not exists error_details jsonb;

alter table notification_outbox
add column if not exists updated_at timestamptz not null default now();

create table if not exists whatsapp_delivery_events (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    provider text not null default 'META',
    waba_id text,
    phone_number_id text,
    whatsapp_number_id uuid,
    recipient_phone text,
    provider_message_id text not null,
    status text not null,
    timestamp_at timestamptz,
    error_code text,
    error_title text,
    error_message text,
    error_details jsonb,
    raw_payload jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists uniq_whatsapp_delivery_provider_message_status
on whatsapp_delivery_events(provider, provider_message_id, status);
