-- Make operational setup optional during onboarding while preserving the
-- agency activity that selects the correct vehicle or parcel/freight journey.
-- Safe and idempotent after 117_organization_owner_permission_repair.sql.

update onboarding_steps
set required = false
where step_key in ('OPERATIONS', 'WHATSAPP', 'AI_KNOWLEDGE');

comment on column onboarding_steps.required is
  'Required steps cannot be skipped. Operational, WhatsApp and AI setup may be completed later from the workspace.';
