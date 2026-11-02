-- Apply before deploying the matching API/dashboard.
-- Office codes identify an implantation inside its agency network, not across
-- all SLAIVIO customers. No existing organization or code is rewritten.
begin;

create unique index if not exists uniq_organizations_network_code
 on organizations(group_id,organization_code)
 where group_id is not null and organization_code is not null;

-- Preserve the existing exact-code uniqueness for standalone organizations.
create unique index if not exists uniq_organizations_standalone_code
 on organizations(organization_code)
 where group_id is null and organization_code is not null;

-- Install both replacement protections before removing the old global index.
drop index if exists uniq_organizations_code;

commit;
