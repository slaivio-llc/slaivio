-- Select the SLAIVIO operating surface per agency.
-- Existing agencies retain their current vehicle-import experience unless
-- they explicitly select parcel and freight during onboarding.
-- Safe and idempotent after 114_pilot_knowledge_files_bucket.sql.

alter table organizations drop constraint if exists ck_organizations_business_type;
alter table organizations add constraint ck_organizations_business_type check (
  organization_type is null
  or organization_type in (
    'VEHICLE_IMPORT',
    'PARCEL_FREIGHT',
    -- Legacy values remain accepted until the agency completes onboarding.
    'AGENCY',
    'CARGO'
  )
);

alter table agency_profile drop constraint if exists ck_agency_profile_business_type;
alter table agency_profile add constraint ck_agency_profile_business_type check (
  business_type is null
  or business_type in ('VEHICLE_IMPORT', 'PARCEL_FREIGHT')
);

comment on column organizations.organization_type is
  'Agency product surface. VEHICLE_IMPORT preserves the current dossier workflow; PARCEL_FREIGHT enables the LUZA parcel workflow.';
