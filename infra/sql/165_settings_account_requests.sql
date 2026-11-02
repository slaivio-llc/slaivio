-- Complete settings defaults without rewriting formats or existing references.
begin;
insert into document_numbering_settings(org_id,document_type,prefix_format)
select o.id,v.kind,v.format from organizations o cross join (values
 ('PACKAGE','COL-{YYYY}-{000001}'),('CLIENT','CLI-{YYYY}-{000001}'),
 ('DOSSIER','DOS-{YYYY}-{000001}'),('SHIPMENT','EXP-{YYYY}-{000001}')
) v(kind,format) on conflict(org_id,document_type) do nothing;

-- The shared allocator serialises the counter. Skip historical manual shipment
-- references rather than resetting the counter or rewriting any old record.
create or replace function next_shipment_reference(requested_org text) returns text
language plpgsql as $$
declare candidate text;
begin
 loop
  candidate:=next_organization_reference(requested_org,'SHIPMENT','EXP-{YYYY}-{000001}');
  exit when not exists(select 1 from cargo_expeditions
   where org_id=requested_org and expedition_reference=candidate);
 end loop;
 return candidate;
end; $$;
revoke all on function next_shipment_reference(text) from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function next_shipment_reference(text) to service_role;
 end if;
end; $$;

alter table organization_data_requests drop constraint if exists organization_data_requests_request_type_check;
alter table organization_data_requests add constraint organization_data_requests_request_type_check
check(request_type in('EXPORT','ARCHIVE_WORKSPACE','DELETE_WORKSPACE','DELETE_ORGANIZATION','DELETE_ACCOUNT'));
create index if not exists organization_data_requests_actor_pending
on organization_data_requests(requested_by,request_type,status);
commit;
