-- Apply before deploying the API and QR gateway. No historical sends.
begin;
alter table finance_settings add column if not exists invoice_whatsapp_enabled boolean not null default false;
create table if not exists finance_invoice_deliveries (
 id uuid primary key default gen_random_uuid(),
 org_id text not null references organizations(id),
 document_id uuid not null references finance_documents(id),
 notification_id uuid not null unique references notification_outbox(id),
 request_key text not null,
 snapshot jsonb not null,
 gateway_started_at timestamptz,
 gateway_message_id text,
 created_at timestamptz not null default now(),
 unique(org_id,document_id,request_key)
);
create index if not exists finance_invoice_delivery_document on finance_invoice_deliveries(org_id,document_id,created_at desc);
alter table finance_invoice_deliveries enable row level security;
revoke all on finance_invoice_deliveries from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on finance_invoice_deliveries from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on finance_invoice_deliveries from authenticated; end if;
 if exists(select 1 from pg_roles where rolname='service_role') then grant select,insert,update,delete on finance_invoice_deliveries to service_role; end if;
end $$;
commit;
