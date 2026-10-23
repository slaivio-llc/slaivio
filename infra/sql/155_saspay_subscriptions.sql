-- Platform subscriptions, not agency customer invoices.
begin;

create table if not exists billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id),
  invoice_id uuid not null references billing_invoices(id),
  pricing_plan_id uuid not null references pricing_plans(id),
  amount_minor bigint not null check(amount_minor > 0),
  currency_code text not null,
  provider_session_id text unique,
  provider_transaction_id text unique,
  checkout_url text,
  status text not null default 'CREATING'
    check(status in ('CREATING','PENDING','UNKNOWN','SUCCESS','FAILED')),
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_pending_billing_checkout_per_org
  on billing_checkout_sessions(org_id) where status in ('CREATING','PENDING','UNKNOWN');

-- Extend older short trials from their original start, never from migration time.
-- Paid subscriptions are left untouched.
update agency_subscriptions set
  trial_ends_at=starts_at+interval '30 days',
  ends_at=greatest(ends_at,starts_at+interval '30 days'),updated_at=now()
where status='TRIAL' and trial_ends_at<starts_at+interval '30 days';

insert into agency_subscriptions(org_id,pricing_plan_id,status,starts_at,trial_ends_at,ends_at,auto_renew)
select o.id,p.id,'TRIAL',now(),now()+interval '30 days',now()+interval '30 days',false
from organizations o cross join pricing_plans p
where o.parent_org_id is null and p.code='STARTER' and p.active=true
on conflict(org_id) do nothing;

commit;
