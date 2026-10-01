-- Track the commercial amount expected from a vehicle-import client without
-- conflating it with accounting documents or the optional credit facility.
-- Safe and idempotent after 121_pilot_followup_prospect_audiences.sql.

alter table clients
  add column if not exists payment_amount_due numeric(14,2) not null default 0,
  add column if not exists payment_amount_paid numeric(14,2) not null default 0,
  add column if not exists payment_currency text;

alter table clients drop constraint if exists ck_clients_payment_amount_due;
alter table clients add constraint ck_clients_payment_amount_due
  check (payment_amount_due >= 0);

alter table clients drop constraint if exists ck_clients_payment_amount_paid;
alter table clients add constraint ck_clients_payment_amount_paid
  check (payment_amount_paid >= 0);

alter table clients drop constraint if exists ck_clients_payment_currency;
alter table clients add constraint ck_clients_payment_currency
  check (payment_currency is null or payment_currency ~ '^[A-Z]{3}$');

create index if not exists idx_clients_org_payment_outstanding
  on clients(org_id, payment_amount_due, payment_amount_paid)
  where deleted_at is null and payment_amount_due > payment_amount_paid;

comment on column clients.payment_amount_due is
  'Commercial amount expected from the client for the current vehicle operation.';
comment on column clients.payment_amount_paid is
  'Cumulative amount received against payment_amount_due; payment status is derived from both values.';
comment on column clients.payment_currency is
  'ISO 4217 currency used by the client-level vehicle payment tracker.';
