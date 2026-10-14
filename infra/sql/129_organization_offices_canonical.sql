-- Use organization_locations as the canonical office record while preserving
-- agency_offices identifiers used by existing operational references.
begin;

alter table organization_locations
  add column if not exists agency_office_id uuid
    references agency_offices(id) on delete restrict;

alter table agency_offices
  add column if not exists organization_location_id uuid
    references organization_locations(id) on delete restrict;
alter table agency_offices alter column address drop not null;

create unique index if not exists uq_agency_offices_organization_location
  on agency_offices(organization_location_id)
  where organization_location_id is not null;

-- Link unambiguous existing records by their physical address.
with candidates as (
  select office.id office_id, location.id location_id,
    count(*) over (partition by office.id) office_matches,
    count(*) over (partition by location.id) location_matches
  from agency_offices office
  join organization_locations location
    on location.org_id = office.org_id
   and location.location_type = 'OFFICE'
   and lower(location.country) = lower(office.country)
   and lower(location.city) = lower(office.city)
   and nullif(btrim(office.address), '') is not null
   and lower(btrim(location.address)) = lower(btrim(office.address))
)
update agency_offices office
set organization_location_id = candidates.location_id
from candidates
where office.id = candidates.office_id
  and candidates.office_matches = 1
  and candidates.location_matches = 1
  and office.organization_location_id is null;

-- Preserve offices that existed only in the operational table.
insert into organization_locations(
  org_id, name, code, location_type, country, city, address, phone,
  whatsapp, opening_hours, status
)
select office.org_id,
  coalesce(nullif(btrim(office.city), ''), 'Bureau') || ' (' || left(office.id::text, 6) || ')',
  'LEGACY-' || upper(replace(office.id::text, '-', '')),
  'OFFICE', office.country, office.city, office.address, office.phone,
  office.whatsapp,
  case when nullif(btrim(office.opening_hours), '') is null then '{}'::jsonb
    else jsonb_build_object('text', office.opening_hours) end,
  case when office.is_active then 'ACTIVE' else 'INACTIVE' end
from agency_offices office
where office.organization_location_id is null
on conflict (org_id, code) do nothing;

update agency_offices office
set organization_location_id = location.id
from organization_locations location
where office.organization_location_id is null
  and location.org_id = office.org_id
  and location.code = 'LEGACY-' || upper(replace(office.id::text, '-', ''));

-- Link organization-managed offices that were not represented operationally.
insert into agency_offices(
  org_id, country, city, address, office_type, phone, whatsapp,
  opening_hours, is_active, organization_location_id
)
select location.org_id, location.country, location.city, location.address,
  'OFFICE', location.phone, location.whatsapp,
  nullif(location.opening_hours ->> 'text', ''),
  location.status = 'ACTIVE', location.id
from organization_locations location
where location.location_type = 'OFFICE'
  and not exists (
    select 1 from agency_offices office
    where office.organization_location_id = location.id
  );

update organization_locations location
set agency_office_id = office.id
from agency_offices office
where office.organization_location_id = location.id
  and location.agency_office_id is null;

update agency_offices office
set is_active = location.status = 'ACTIVE'
from organization_locations location
where location.id = office.organization_location_id;

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

drop trigger if exists trg_sync_agency_office_from_location on organization_locations;
create trigger trg_sync_agency_office_from_location
after insert or update of name, location_type, country, city, address, phone,
  whatsapp, opening_hours, status
on organization_locations
for each row execute function sync_agency_office_from_location();

do $$ begin
  if exists (
    select 1 from organization_locations
    where location_type = 'OFFICE' and status = 'ACTIVE'
    group by org_id, lower(btrim(name)), lower(btrim(country)), lower(btrim(city))
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate active office names within the same country and city before migration 129';
  end if;
end $$;

create unique index if not exists uq_active_office_name_city_country
  on organization_locations(org_id, lower(btrim(name)), lower(btrim(country)), lower(btrim(city)))
  where location_type = 'OFFICE' and status = 'ACTIVE';

comment on column agency_offices.organization_location_id is
  'Canonical organization_locations record for this operational office reference.';

commit;
