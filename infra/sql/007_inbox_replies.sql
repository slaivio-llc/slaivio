alter table messages
add column if not exists provider_message_id text;

alter table messages
add column if not exists send_status text default 'PENDING';

alter table messages
add column if not exists error_message text;

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
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note
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
    a.assigned_manager_id,
    a.assigned_manager_name,
    a.last_note;
