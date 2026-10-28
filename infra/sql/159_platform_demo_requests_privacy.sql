-- Demo contacts and internal follow-up are platform-only data.
-- The API uses its trusted SQL server connection; browsers get no table access.
begin;

alter table landing_demo_requests enable row level security;
alter table platform_admin_audit_log enable row level security;
revoke all on landing_demo_requests,platform_admin_audit_log from public;

-- Supabase roles may not exist on a plain PostgreSQL development/test database.
do $$
declare browser_role text;
begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on landing_demo_requests,platform_admin_audit_log from %I',browser_role);
  end if;
 end loop;
end; $$;

create index if not exists platform_admin_audit_target_history
 on platform_admin_audit_log(target_type,target_id,created_at desc);

commit;
