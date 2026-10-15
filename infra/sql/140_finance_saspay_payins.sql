begin;

create table if not exists finance_saspay_connections (
  org_id text primary key references organizations(id) on delete cascade,
  merchant_id text not null,
  environment text not null check (environment in ('TEST','LIVE')),
  encrypted_api_key text not null,
  encrypted_signing_secret text not null,
  is_active boolean not null default false,
  configured_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_finance_saspay_one_org_per_merchant
  on finance_saspay_connections(merchant_id);

create unique index if not exists idx_finance_documents_org_document
  on finance_documents(org_id,id);

create table if not exists finance_saspay_attempts (
  id uuid primary key,
  org_id text not null references organizations(id) on delete cascade,
  document_id uuid not null,
  idempotency_key text not null,
  status text not null check (status in (
    'CREATING','PENDING','AMBIGUOUS','SUCCEEDED','FAILED','CANCELLED'
  )),
  requested_amount numeric(18,2) not null check (requested_amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null,
  checkout_session_id text,
  checkout_url text,
  provider_payment_id text,
  provider_reference text,
  provider_fee numeric(18,4),
  provider_charged numeric(18,4),
  provider_net_amount numeric(18,4),
  fee_charge_mode text check (fee_charge_mode is null or fee_charge_mode in ('ADD_ON','DEDUCTED')),
  provider_details jsonb not null default '{}'::jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (org_id, idempotency_key),
  unique (org_id, checkout_session_id),
  unique (org_id, provider_payment_id),
  unique (org_id,id),
  foreign key (org_id,document_id) references finance_documents(org_id,id) on delete cascade
);

create unique index if not exists idx_finance_saspay_one_open_attempt_per_document
  on finance_saspay_attempts(org_id, document_id)
  where status in ('CREATING','PENDING','AMBIGUOUS');

create index if not exists idx_finance_saspay_attempts_document
  on finance_saspay_attempts(org_id, document_id, created_at desc);

alter table finance_payments
  add column if not exists provider text,
  add column if not exists provider_transaction_id text,
  add column if not exists provider_amount numeric(18,4),
  add column if not exists provider_fee numeric(18,4),
  add column if not exists provider_charged numeric(18,4),
  add column if not exists provider_net_amount numeric(18,4),
  add column if not exists fee_charge_mode text
    check (fee_charge_mode is null or fee_charge_mode in ('ADD_ON','DEDUCTED'));

create unique index if not exists idx_finance_payment_provider_transaction
  on finance_payments(org_id, provider, provider_transaction_id)
  where provider is not null and provider_transaction_id is not null;

create table if not exists finance_saspay_webhook_events (
  id bigserial primary key,
  org_id text not null references organizations(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  provider_payment_id text,
  attempt_id uuid,
  outcome text not null check (outcome in ('PROCESSED','IGNORED','UNMATCHED')),
  received_at timestamptz not null default now(),
  unique (org_id, event_key),
  foreign key (org_id,attempt_id) references finance_saspay_attempts(org_id,id)
);

commit;
