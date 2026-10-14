-- Fix PostgreSQL's inference of the partial unique index used by the
-- canonical organization-location to operational-office synchronization.
begin;

create or replace function sync_agency_office_from_location()
returns trigger language plpgsql as $$
declare
  operational_office_id uuid;
begin
  if new.location_type <> 'OFFICE' then
    update agency_offices set is_active = false
    where id = new.agency_office_id and org_id = new.org_id;
    return new;
  end if;

  if new.agency_office_id is null then
    insert into agency_offices(
      org_id, country, city, address, office_type, phone, whatsapp,
      opening_hours, is_active, organization_location_id
    ) values (
      new.org_id, new.country, new.city, new.address, 'OFFICE', new.phone,
      new.whatsapp, nullif(new.opening_hours ->> 'text', ''),
      new.status = 'ACTIVE', new.id
    )
    on conflict (organization_location_id)
      where organization_location_id is not null
    do update set
      country = excluded.country,
      city = excluded.city,
      address = excluded.address,
      phone = excluded.phone,
      whatsapp = excluded.whatsapp,
      opening_hours = excluded.opening_hours,
      is_active = excluded.is_active
    returning id into operational_office_id;

    update organization_locations
    set agency_office_id = operational_office_id
    where id = new.id;
  else
    update agency_offices set
      country = new.country,
      city = new.city,
      address = new.address,
      phone = new.phone,
      whatsapp = new.whatsapp,
      opening_hours = nullif(new.opening_hours ->> 'text', ''),
      is_active = new.status = 'ACTIVE'
    where id = new.agency_office_id
      and org_id = new.org_id
      and organization_location_id = new.id;
  end if;

  return new;
end;
$$;

commit;
