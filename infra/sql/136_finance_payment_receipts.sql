-- Apply before deploying payment receipt snapshots. Historical payments are not
-- backfilled with today's identity: that would invent their historical context.
begin;
alter table finance_payments add column if not exists receipt_snapshot jsonb;
comment on column finance_payments.receipt_snapshot is
  'Agency and customer identity captured atomically when payment is recorded. Null for legacy payments without verified historical identity.';
commit;
