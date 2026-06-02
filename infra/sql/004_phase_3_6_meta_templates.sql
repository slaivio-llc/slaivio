-- Phase 3.6: retain the historical template table while adding Meta sync state.

alter table whatsapp_templates
add column if not exists body_text text;

alter table whatsapp_templates
add column if not exists meta_template_id text;

alter table whatsapp_templates
add column if not exists quality_score text;

alter table whatsapp_templates
add column if not exists rejection_reason text;

alter table whatsapp_templates
add column if not exists last_synced_at timestamptz;

alter table whatsapp_templates
add column if not exists raw_payload jsonb;

create index if not exists idx_whatsapp_templates_meta_name
on whatsapp_templates(org_id, provider, template_name, language);
