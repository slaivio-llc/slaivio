-- Persist clients selected directly in the campaign form.
-- Tenant ownership is rechecked when the audience snapshot is created.
begin;

alter table broadcasts
  add column if not exists selected_client_ids jsonb not null default '[]'::jsonb;

alter table broadcasts
  drop constraint if exists broadcasts_selected_client_ids_array_check;
alter table broadcasts
  add constraint broadcasts_selected_client_ids_array_check
  check (jsonb_typeof(selected_client_ids) = 'array');

comment on column broadcasts.selected_client_ids is
  'Client IDs selected directly for this campaign. Snapshot queries always scope them to the campaign organization.';

commit;
