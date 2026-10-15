-- Apply before deploying conversation ownership (Module 06).
begin;
alter table conversation_assignments add column if not exists assigned_to text;
create index if not exists idx_conversation_owner_open
  on conversation_assignments(org_id, assigned_to, updated_at desc)
  where assigned_to is not null and status <> 'CLOSED';
comment on column conversation_assignments.assigned_to is
  'Authenticated agent handling the conversation. Ownership never grants access to another organization.';
commit;
