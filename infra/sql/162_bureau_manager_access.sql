-- Apply after 161, before the matching API/dashboard deployment.
-- A bureau is an organization selected in the workspace switcher.
-- Only the standard MANAGER role is reconciled; custom roles, memberships,
-- physical office restrictions and business records are not changed.
begin;
create temporary table slaivio_bureau_manager_permissions on commit drop as
 select id from permissions where split_part(permission_code,'.',1) in (
  'clients','packages','shipments','warehouses','pickups','departures','batches',
  'tracking','dossiers','documents','finance','pricing','routes','services',
  'inbox','followups','broadcasts','knowledge','analytics','reports',
  'notifications','support','commercial'
 ) or permission_code in (
  'organization.read','dashboard.view','team.read','team.write','team.manage',
  'roles.manage','locations.manage','locations.access.manage','workspaces.manage',
  'settings.read','settings.write','audit.read','operations.write',
  'references.read','references.audit',
  'pilot.settings.read','pilot.knowledge.read','pilot.knowledge.manage',
  'pilot.knowledge.publish','pilot.followups.read','pilot.followups.manage',
  'pilot.followups.send','pilot.readiness.read','pilot.readiness.review'
 );
delete from role_permissions rp using organization_roles r
 where rp.role_id=r.id and r.role_code='MANAGER' and r.system_role
 and not exists(select 1 from slaivio_bureau_manager_permissions p where p.id=rp.permission_id);
insert into role_permissions(role_id,permission_id)
 select r.id,p.id from organization_roles r cross join slaivio_bureau_manager_permissions p
 where r.role_code='MANAGER' and r.system_role on conflict do nothing;
update organization_roles set role_name='Responsable du bureau',
 description='Gestion complète des opérations, de la finance, des rapports et de l’équipe du bureau actif, sans administration du réseau ni droits du propriétaire.'
 where role_code='MANAGER' and system_role;
commit;
