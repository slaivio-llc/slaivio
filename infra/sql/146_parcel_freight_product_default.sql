-- SLAIVIO now operates the parcel/freight product only. Normalize legacy
-- product labels without deleting agencies, memberships, dossiers, or history.
begin;

update organizations
set organization_type = 'PARCEL_FREIGHT',
    row_version = coalesce(row_version, 1) + 1,
    updated_at = now()
where organization_type in ('AGENCY', 'CARGO', 'VEHICLE_IMPORT');

update agency_profile
set business_type = 'PARCEL_FREIGHT',
    updated_at = now()
where business_type = 'VEHICLE_IMPORT';

comment on column organizations.organization_type is
  'Operational product surface. SLAIVIO currently supports PARCEL_FREIGHT; legacy labels are retained only until migration 146 normalizes them.';

commit;
