from sqlalchemy import text
from app.db.database import engine


def list_offices(
    org_id: str,
    country: str | None = None,
    city: str | None = None,
    office_type: str | None = None,
):
    filters = [
        "office.org_id = :org_id",
        "office.is_active = true",
    ]

    params = {
        "org_id": org_id,
    }

    if country:
        filters.append("lower(office.country) = lower(:country)")
        params["country"] = country.strip()

    if city:
        filters.append("lower(office.city) = lower(:city)")
        params["city"] = city.strip()

    if office_type:
        filters.append("upper(office.office_type) = upper(:office_type)")
        params["office_type"] = office_type.strip()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select office.*, location.name
                from agency_offices office
                left join organization_locations location
                  on location.id = office.organization_location_id
                 and location.org_id = office.org_id
                where {where_clause}
                order by office.country asc, office.city asc, office.created_at desc
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def find_office(
    org_id: str,
    country: str | None = None,
    city: str | None = None,
    office_type: str | None = None,
):
    offices = list_offices(
        org_id=org_id,
        country=country,
        city=city,
        office_type=office_type,
    )

    return offices[0] if offices else None
