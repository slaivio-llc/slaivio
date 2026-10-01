-- Link configured routes and parcels to a destination organisation (office).
-- Visibility is only allowed inside the same organisation group or hierarchy.
-- Safe and idempotent after 122_vehicle_client_payment_tracking.sql.

alter table shipping_routes
  add column if not exists destination_org_id text references organizations(id);

create index if not exists idx_shipping_routes_destination_org
  on shipping_routes(destination_org_id, active, updated_at desc)
  where archived_at is null and destination_org_id is not null;

-- Earlier API versions accepted destination_org_id without validating the
-- organisation network. Remove any unsafe legacy link before enabling shared
-- destination-office visibility.
update cargo_packages package
set destination_org_id = null
where destination_org_id is not null
  and not exists (
    select 1
    from organizations source
    join organizations destination on destination.id = package.destination_org_id
    where source.id = package.org_id
      and (
        source.id = destination.id
        or (source.group_id is not null and source.group_id = destination.group_id)
        or destination.parent_org_id = source.id
        or source.parent_org_id = destination.id
        or (
          source.parent_org_id is not null
          and source.parent_org_id = destination.parent_org_id
        )
      )
  );

comment on column shipping_routes.destination_org_id is
  'Destination office organisation. It must belong to the same organisation group or hierarchy as the route owner.';
