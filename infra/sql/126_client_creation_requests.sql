-- Apply before deploying the CRM creation retry protection.
-- Records are committed atomically with the client; no pending requests persist.
create table if not exists client_creation_requests (
  org_id text not null references organizations(id),
  actor_id text not null,
  request_key uuid not null,
  payload_hash text not null,
  client_id uuid not null references clients(id),
  created_at timestamptz not null default now(),
  primary key (org_id, actor_id, request_key)
);

comment on table client_creation_requests is
  'Idempotent client creation per office and actor. Keep records when clients are archived to prevent accidental recreation.';
