-- V1 manual-payment clearance. No provider or webhook is involved.
begin;
alter table finance_due_policies
  add column if not exists shipping_service_id uuid references shipping_services(id) on delete cascade;
alter table finance_due_policies
  drop constraint if exists finance_due_policies_trigger_event_check;
alter table finance_due_policies
  add constraint finance_due_policies_trigger_event_check
  check (trigger_event in ('DEPARTURE','RECEPTION','ARRIVAL','DELIVERY','MANUAL'));
create index if not exists idx_finance_due_policy_service
  on finance_due_policies(org_id, shipping_service_id, trigger_event, is_active, row_version desc);
comment on column finance_due_policies.shipping_service_id is
  'Optional service-specific policy. Null means the agency default. Service policy takes precedence.';
commit;
