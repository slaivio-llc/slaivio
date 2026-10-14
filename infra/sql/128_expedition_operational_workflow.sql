-- Apply before deploying the unified freight loading/departure workflow.
-- No historical assignment is silently deleted to resolve conflicts.
begin;
alter table cargo_expeditions add column if not exists workflow_version integer not null default 1;

-- Abort safely if historical data needs an explicit operational correction.
do $$ begin
  if exists(select 1 from expedition_packages where removed_at is null
            group by org_id,package_id having count(*)>1) then
    raise exception 'Resolve duplicate active expedition assignments before migration 128';
  end if;
end $$;
create unique index if not exists idx_expedition_package_single_active
  on expedition_packages(org_id,package_id) where removed_at is null;

create table if not exists expedition_departure_manifests (
  org_id text not null references organizations(id),
  expedition_id uuid not null references cargo_expeditions(id),
  payload jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  primary key(org_id,expedition_id)
);

-- Only untouched creations from the new register can be adopted automatically.
update cargo_expeditions e set workflow_version=2
where e.workflow_version=1 and e.status='PREPARING'
  and e.departure_id is null and e.departed_at is null and e.archived_at is null
  and exists(select 1 from expedition_events ev where ev.org_id=e.org_id
    and ev.expedition_id=e.id and ev.event_type='EXPEDITION_CREATED'
    and ev.metadata ? 'creation_hash')
  and not exists(select 1 from expedition_packages ep where ep.org_id=e.org_id
    and ep.expedition_id=e.id and ep.removed_at is null);
create table if not exists expedition_milestone_notifications (
  org_id text not null references organizations(id),
  expedition_id uuid not null references cargo_expeditions(id),
  notification_id uuid not null references notification_outbox(id),
  primary key (org_id, expedition_id, notification_id)
);

commit;
