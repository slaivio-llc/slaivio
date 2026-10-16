-- Keep one active exigibility rule per agency/service and trigger.
-- Older rules are retained (not deleted) and the latest remains active.
begin;

alter table finance_due_obligations
  drop constraint if exists finance_due_obligations_trigger_event_check;
alter table finance_due_obligations
  add constraint finance_due_obligations_trigger_event_check
  check (trigger_event in ('DEPARTURE','RECEPTION','ARRIVAL','DELIVERY','MANUAL'));
alter table finance_due_obligations
  add column if not exists policy_name_snapshot text;
alter table finance_documents
  add column if not exists due_policy_snapshot_at timestamptz;

with ranked as (
  select id,
         row_number() over (
           partition by org_id, trigger_event, shipping_service_id
           order by row_version desc, updated_at desc, created_at desc, id
         ) as position
  from finance_due_policies
  where is_active = true
)
update finance_due_policies p
set is_active = false,
    row_version = p.row_version + 1,
    updated_at = now()
from ranked r
where p.id = r.id and r.position > 1;

create unique index if not exists idx_finance_due_policy_active_service
  on finance_due_policies(org_id, trigger_event, shipping_service_id)
  where is_active = true and shipping_service_id is not null;

create unique index if not exists idx_finance_due_policy_active_agency
  on finance_due_policies(org_id, trigger_event)
  where is_active = true and shipping_service_id is null;

commit;
