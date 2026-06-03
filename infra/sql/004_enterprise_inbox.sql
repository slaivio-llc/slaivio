alter table messages
add column if not exists provider text default 'META';

alter table messages
add column if not exists provider_message_id text;

alter table messages
add column if not exists provider_phone_number_id text;

alter table messages
add column if not exists whatsapp_number_id uuid;

alter table messages
add column if not exists waba_id text;

alter table messages
add column if not exists number_role text;

alter table messages
add column if not exists conversation_status text default 'OPEN';

alter table messages
add column if not exists assigned_manager_id text;

alter table messages
add column if not exists priority text default 'NORMAL';

create index if not exists idx_messages_org_phone
on messages(org_id, from_phone);

create index if not exists idx_messages_org_created
on messages(org_id, created_at desc);

create index if not exists idx_messages_number_role
on messages(org_id, number_role);

create index if not exists idx_messages_provider_message
on messages(provider_message_id);

create or replace view inbox_conversations_view as
select
    org_id,
    from_phone,
    max(created_at) as last_message_at,
    (array_agg(text_body order by created_at desc))[1] as last_message,
    count(*) as message_count,
    (array_agg(number_role order by created_at desc))[1] as number_role,
    (array_agg(provider_phone_number_id order by created_at desc))[1] as provider_phone_number_id,
    (array_agg(whatsapp_number_id order by created_at desc))[1] as whatsapp_number_id,
    (array_agg(conversation_status order by created_at desc))[1] as conversation_status,
    (array_agg(priority order by created_at desc))[1] as priority,
    (array_agg(assigned_manager_id order by created_at desc))[1] as assigned_manager_id
from messages
group by org_id, from_phone;
