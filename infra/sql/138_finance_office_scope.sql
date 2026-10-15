-- Explicit financial ownership. Do not guess an office from a destination.
begin;
alter table finance_documents add column if not exists office_id uuid references organization_locations(id);
create index if not exists idx_finance_documents_office on finance_documents(org_id,office_id,created_at desc);
drop trigger if exists trg_finance_office_tenant on finance_documents;
create trigger trg_finance_office_tenant before insert or update of office_id,org_id
  on finance_documents for each row execute function enforce_slaivio_reference_tenant('office_id','organization_locations');
create or replace function preserve_finance_office() returns trigger language plpgsql as $$
begin
  if old.office_id is not null and new.office_id is distinct from old.office_id then
    raise exception 'finance_office_immutable';
  end if;
  return new;
end $$;
drop trigger if exists trg_preserve_finance_office on finance_documents;
create trigger trg_preserve_finance_office before update of office_id on finance_documents
  for each row execute function preserve_finance_office();
commit;
