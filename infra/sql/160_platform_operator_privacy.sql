-- Platform permissions and internal agency notes must never be writable by browsers.
-- Apply using the trusted database owner, before deploying the updated console.
begin;
alter table platform_operator_permissions enable row level security;
alter table platform_agency_notes enable row level security;
revoke all on platform_operator_permissions,platform_agency_notes from public;
do $$
declare browser_role text;
begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on platform_operator_permissions,platform_agency_notes from %I',browser_role);
  end if;
 end loop;
end; $$;
commit;
