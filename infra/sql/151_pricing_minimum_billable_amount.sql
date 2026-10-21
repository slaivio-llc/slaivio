-- Persist optional minimum charge amounts on pricing grids.
begin;

alter table pricing_grids
  add column if not exists minimum_billable_amount numeric(14,2);

commit;
