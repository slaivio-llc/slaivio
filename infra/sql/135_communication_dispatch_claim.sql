-- Apply before deploying notification dispatch reservations.
begin;
alter table notification_outbox
  add column if not exists dispatch_state text not null default 'IDLE'
    check (dispatch_state in ('IDLE','CLAIMED','ACCEPTED','REJECTED','UNKNOWN')),
  add column if not exists dispatch_started_at timestamptz;
comment on column notification_outbox.dispatch_state is
  'CLAIMED/UNKNOWN require reconciliation; never replay an ambiguous provider send automatically.';
commit;
