-- Persist the agency's operational payment-control preferences.
begin;

alter table finance_settings
  add column if not exists block_departure_confirmation boolean not null default true,
  add column if not exists block_delivery_release boolean not null default false,
  add column if not exists payment_reminders_enabled boolean not null default true;

commit;
