alter table conversation_assignments
add column if not exists queue_name text;

alter table conversation_assignments
add column if not exists waiting_since timestamptz;

alter table conversation_assignments
add column if not exists unread_count integer default 0;

alter table conversation_assignments
add column if not exists requires_attention boolean default false;

create index if not exists idx_conversation_assignments_queue
on conversation_assignments(org_id, queue_name);

create index if not exists idx_conversation_assignments_attention
on conversation_assignments(org_id, requires_attention);

drop view if exists inbox_conversations_view;

create or replace view inbox_conversations_view as
select
    m.org_id,
    case
        when m.direction = 'outbound' then m.to_phone
        else m.from_phone
    end as from_phone,
    max(m.created_at) as last_message_at,
    (array_agg(m.text_body order by m.created_at desc))[1] as last_message,
    count(*) as message_count,
    (array_agg(m.number_role order by m.created_at desc))[1] as number_role,
    (array_agg(m.provider_phone_number_id order by m.created_at desc))[1] as provider_phone_number_id,
    (array_agg(m.whatsapp_number_id order by m.created_at desc))[1] as whatsapp_number_id,
    coalesce(a.status, 'OPEN') as conversation_status,
    coalesce(a.priority, 'NORMAL') as priority,
    coalesce(a.queue_name, 'UNASSIGNED') as queue_name,
    coalesce(a.unread_count, 0) as unread_count,
    coalesce(a.requires_attention, false) as requires_attention,
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note,
    a.waiting_since
from messages m
left join conversation_assignments a
    on a.org_id = m.org_id
   and a.client_phone = case
        when m.direction = 'outbound' then m.to_phone
        else m.from_phone
    end
group by
    m.org_id,
    case
        when m.direction = 'outbound' then m.to_phone
        else m.from_phone
    end,
    a.status,
    a.priority,
    a.queue_name,
    a.unread_count,
    a.requires_attention,
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note,
    a.waiting_since;
