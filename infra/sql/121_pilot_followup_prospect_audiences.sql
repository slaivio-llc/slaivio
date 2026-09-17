-- Allow an agency to include WhatsApp prospects that have not yet completed
-- client registration in a confirmed announcement or follow-up audience.
-- Safe and idempotent after 120_parcel_freight_customer_journey.sql.

alter table pilot_followup_batches
  add column if not exists selected_journey_ids uuid[] not null default '{}',
  add column if not exists excluded_journey_ids uuid[] not null default '{}';

alter table pilot_followup_recipients
  alter column client_id drop not null,
  add column if not exists journey_id uuid
    references parcel_customer_journeys(id) on delete set null;

create index if not exists idx_pilot_followup_recipients_journey
  on pilot_followup_recipients(org_id, journey_id, created_at desc)
  where journey_id is not null;

comment on column pilot_followup_batches.selected_journey_ids is
  'WhatsApp prospects selected before a formal client record exists.';
comment on column pilot_followup_recipients.journey_id is
  'Prospect journey used as the recipient identity when client_id is not available.';
