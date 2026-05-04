from sqlalchemy import text
from app.db.database import engine


def create_office(
    org_id: str,
    country: str,
    city: str,
    address: str,
    office_type: str = "OFFICE",
    phone: str | None = None,
    whatsapp: str | None = None,
    opening_hours: str | None = None,
    pickup_instructions: str | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into agency_offices (
                    org_id,
                    country,
                    city,
                    address,
                    office_type,
                    phone,
                    whatsapp,
                    opening_hours,
                    pickup_instructions
                )
                values (
                    :org_id,
                    :country,
                    :city,
                    :address,
                    :office_type,
                    :phone,
                    :whatsapp,
                    :opening_hours,
                    :pickup_instructions
                )
                returning *
            """),
            {
                "org_id": org_id,
                "country": country,
                "city": city,
                "address": address,
                "office_type": office_type,
                "phone": phone,
                "whatsapp": whatsapp,
                "opening_hours": opening_hours,
                "pickup_instructions": pickup_instructions,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_offices(
    org_id: str = "demo_agency",
    country: str | None = None,
    city: str | None = None,
    office_type: str | None = None,
):
    filters = [
        "org_id = :org_id",
        "is_active = true",
    ]

    params = {"org_id": org_id}

    if country:
        filters.append("lower(country) = lower(:country)")
        params["country"] = country

    if city:
        filters.append("lower(city) = lower(:city)")
        params["city"] = city

    if office_type:
        filters.append("office_type = :office_type")
        params["office_type"] = office_type

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from agency_offices
                where {where_clause}
                order by country asc, city asc, created_at desc
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