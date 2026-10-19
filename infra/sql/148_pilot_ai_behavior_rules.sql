-- Persist the communication assistant's configurable behavior rules.
begin;

alter table ai_settings
  add column if not exists pilot_handoff_to_human boolean not null default true,
  add column if not exists pilot_use_organization_name boolean not null default true;

commit;
