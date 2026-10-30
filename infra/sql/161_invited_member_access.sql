-- Single effective agency role; explicit office grants on invitations.
-- Existing custom roles and business data are preserved.
begin;
alter table organization_invitations add column if not exists office_access_scope text not null default 'ALL_OFFICES'
 check(office_access_scope in('ALL_OFFICES','SELECTED_OFFICES'));
alter table organization_invitations add column if not exists office_ids uuid[] not null default '{}';
create index if not exists invitation_email_followup on organization_invitations(lower(email),org_id,status);
delete from role_permissions rp using permissions p where rp.permission_id=p.id
 and (p.permission_code like 'platform.%' or p.permission_code like 'quarantine.%');

-- The standard Finance role is operational finance only, not SaaS billing,
-- global audit, clients, shipments, marketing or agency administration.
delete from role_permissions rp using organization_roles r,permissions p
 where rp.role_id=r.id and rp.permission_id=p.id and r.role_code='FINANCE' and r.system_role
 and p.permission_code not in('finance.read','finance.create','finance.issue','finance.payments','finance.export');
insert into role_permissions(role_id,permission_id)
 select r.id,p.id from organization_roles r cross join permissions p
 where r.role_code='FINANCE' and r.system_role and p.permission_code in
 ('finance.read','finance.create','finance.issue','finance.payments','finance.export') on conflict do nothing;
update user_role_assignments a set assignment_status='REVOKED'
 where a.assignment_status='ACTIVE' and not exists(
  select 1 from organization_memberships m join organization_roles r
   on r.org_id=m.org_id and r.role_code=m.role_code
  where m.clerk_user_id=a.user_id and m.org_id=a.org_id and m.status='ACTIVE' and r.id=a.role_id);
commit;
