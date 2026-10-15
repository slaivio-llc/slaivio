-- Finance due/exigibility rules are versioned and traceable without forcing a default agency policy.
create table if not exists finance_due_policies (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id) on delete cascade,
  name text not null,
  trigger_event text not null check (trigger_event in ('RECEPTION','ARRIVAL','DELIVERY','MANUAL')),
  rule_type text not null check (rule_type in ('PERCENTAGE','FIXED_AMOUNT')),
  percentage numeric(7,4) default null check (percentage is null or (percentage >= 0 and percentage <= 100)),
  fixed_amount numeric(18,2) default null check (fixed_amount is null or fixed_amount >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  row_version integer not null default 1,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, name)
);

create table if not exists finance_due_obligations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id) on delete cascade,
  document_id uuid not null references finance_documents(id) on delete cascade,
  policy_id uuid not null references finance_due_policies(id) on delete cascade,
  policy_row_version integer not null,
  trigger_event text not null check (trigger_event in ('RECEPTION','ARRIVAL','DELIVERY','MANUAL')),
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'OPEN' check (status in ('OPEN','PARTIAL','PAID','VOID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, document_id, policy_id, trigger_event)
);

create index if not exists idx_finance_due_policies_org on finance_due_policies(org_id, is_active, row_version desc);
create index if not exists idx_finance_due_obligations_doc on finance_due_obligations(org_id, document_id, trigger_event, created_at desc);
