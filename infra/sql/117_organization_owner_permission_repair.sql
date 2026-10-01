-- Ensure every organization owner receives the complete tenant product
-- surface, including organizations created after permission migrations ran.
-- Safe and idempotent after 116_parcel_freight_operational_completion.sql.

insert into role_permissions (role_id, permission_id)
select role.id, permission.id
from organization_roles role
cross join permissions permission
where role.role_code = 'OWNER'
  and permission.permission_code not like 'platform.%'
on conflict do nothing;

comment on table role_permissions is
  'Tenant role grants. Organization provisioning mirrors all non-platform permissions to OWNER.';
