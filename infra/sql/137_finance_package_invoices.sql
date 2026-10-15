-- Explicit package-backed invoices. Never infer historical assignments.
begin;
alter table finance_documents
  add column if not exists package_id uuid references cargo_packages(id),
  add column if not exists operation_snapshot jsonb;
create unique index if not exists idx_finance_package_active_invoice
  on finance_documents(org_id,package_id)
  where package_id is not null and document_type='INVOICE' and status<>'VOID';
drop trigger if exists trg_finance_package_tenant on finance_documents;
create trigger trg_finance_package_tenant
  before insert or update of package_id,org_id on finance_documents
  for each row execute function enforce_slaivio_reference_tenant('package_id','cargo_packages');
comment on column finance_documents.operation_snapshot is
  'Pricing and operation captured at draft creation; not a rule of financial exigibility.';
commit;
