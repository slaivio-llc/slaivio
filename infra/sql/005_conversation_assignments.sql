create table if not exists conversation_assignments (
    id uuid primary key default gen_random_uuid(),
    org_id text not null,
    client_phone text not null,
    assigned_manager_id text,
    assigned_manager_name text,
    status text not null default 'OPEN',
    priority text not null default 'NORMAL',
    last_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(org_id, client_phone)
);

create or replace view inbox_conversations_view as
select
    m.org_id,
    m.from_phone,
    max(m.created_at) as last_message_at,
    (array_agg(m.text_body order by m.created_at desc))[1] as last_message,
    count(*) as message_count,
    (array_agg(m.number_role order by m.created_at desc))[1] as number_role,
    (array_agg(m.provider_phone_number_id order by m.created_at desc))[1] as provider_phone_number_id,
    (array_agg(m.whatsapp_number_id order by m.created_at desc))[1] as whatsapp_number_id,
    coalesce(a.status, 'OPEN') as conversation_status,
    coalesce(a.priority, 'NORMAL') as priority,
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note
from messages m
left join conversation_assignments a
    on a.org_id = m.org_id
   and a.client_phone = m.from_phone
group by
    m.org_id,
    m.from_phone,
    a.status,
    a.priority,
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note;
