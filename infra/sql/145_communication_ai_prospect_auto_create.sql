-- Allow each parcel agency to opt into automatic CRM creation only after an
-- explicit, high-confidence WhatsApp shipping intent and profile completion.
-- Existing agencies keep the safer manual-confirmation behavior.
begin;
alter table ai_settings
  add column if not exists auto_create_qualified_whatsapp_clients boolean not null default false;
comment on column ai_settings.auto_create_qualified_whatsapp_clients is
  'When enabled, qualified individual WhatsApp prospects with an explicit shipping intent may be created as CRM clients after required profile details are collected.';
commit;
