-- MANUAL ONLY: never add this file to automatic migrations.
-- In Clerk > Users, open your own SLAIVIO staff account and copy its User ID.
-- Replace the single placeholder below. Run in the trusted Supabase SQL editor.
-- Do not use an organization ID, an email address, a JWT or an API secret.
begin;
do $$
declare operator_clerk_id text := 'user_3LDsKqtA2tLYhTZ8TXtk6juyxwX';
begin
 if operator_clerk_id !~ '^user_[A-Za-z0-9]+$' then
  raise exception 'Remplacez le placeholder par votre identifiant utilisateur Clerk exact (user_...).';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('platform-permissions',0));
 insert into platform_operator_permissions(user_id,permission_code,status,granted_by)
 select operator_clerk_id,permission,'ACTIVE','manual-bootstrap'
 from unnest(array[
  'platform.admin.read','platform.agencies.manage','platform.billing.manage',
  'platform.support.manage','platform.audit.read','platform.permissions.manage',
  'quarantine.read','quarantine.resolve','quarantine.replay'
 ]) permission
 on conflict(user_id,permission_code) do update set
  status='ACTIVE',granted_by='manual-bootstrap',granted_at=now();
 insert into platform_admin_audit_log(actor_user_id,action,target_type,target_id,reason)
 values('manual-bootstrap','PLATFORM_PERMISSIONS_CHANGED','platform_operator',operator_clerk_id,
  'Attribution manuelle initiale des accès par un administrateur de confiance de la base.');
end; $$;
commit;
