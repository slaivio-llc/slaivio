-- Phase 3.5: persist the WhatsApp number route used for each message.

alter table messages
add column if not exists provider text;

alter table messages
add column if not exists provider_phone_number_id text;

alter table messages
add column if not exists whatsapp_number_id uuid;

alter table messages
add column if not exists waba_id text;

alter table messages
add column if not exists number_role text;

create index if not exists idx_messages_provider_phone_number
on messages(org_id, provider_phone_number_id);

create index if not exists idx_messages_number_role
on messages(org_id, number_role);
