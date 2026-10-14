-- Module-09: keep service-to-route offerings as the canonical many-to-many
-- relationship while retaining shipping_services.route_id for legacy readers.
begin;

insert into service_route_offerings (
  org_id,
  service_id,
  route_id,
  workspace_id,
  availability,
  eta_min_days,
  eta_max_days
)
select
  service.org_id,
  service.id,
  service.route_id,
  coalesce(service.workspace_id, 'ORGANIZATION'),
  coalesce(service.availability, 'AVAILABLE'),
  service.eta_min_days,
  service.eta_max_days
from shipping_services service
join shipping_routes route
  on route.id = service.route_id
 and route.org_id = service.org_id
where service.route_id is not null
on conflict (service_id, route_id, workspace_id) do nothing;

create index if not exists idx_service_route_offerings_route_active
  on service_route_offerings (org_id, route_id, effective_from)
  where effective_until is null;

create index if not exists idx_service_route_offerings_service_active
  on service_route_offerings (org_id, service_id, effective_from)
  where effective_until is null;

commit;
