-- Preserve the operational reason chosen for a pilot follow-up and use it
-- when creating the underlying follow-up tasks.
begin;

alter table pilot_followup_batches
  add column if not exists followup_type text not null default 'PILOT_MANUAL';

alter table pilot_followup_batches
  drop constraint if exists ck_pilot_followup_batches_followup_type;

alter table pilot_followup_batches
  add constraint ck_pilot_followup_batches_followup_type
  check (followup_type in ('PILOT_MANUAL','PAYMENT_DUE','PICKUP_REMINDER','DOCUMENT_MISSING'));

commit;
