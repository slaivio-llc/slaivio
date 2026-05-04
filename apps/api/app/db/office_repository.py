from sqlalchemy import text
from app.db.database import engine


def create_office(
    org_id: str,
    country: str,
    city: str,
    address: str,
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
                "phone": phone,
                "whatsapp": whatsapp,
                "opening_hours": opening_hours,
                "pickup_instructions": pickup_instructions,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_offices(org_id: str = "demo_agency"):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from agency_offices
                where org_id = :org_id
                  and is_active = true
                order by country asc, city asc
            """),
            {"org_id": org_id},
        )

        return [dict(row._mapping) for row in result.fetchall()]


def find_office(
    org_id: str,
    country: str | None = None,
    city: str | None = None,
):
    filters = [
        "org_id = :org_id",
        "is_active = true",
    ]

    params = {
        "org_id": org_id,
    }

    if country:
        filters.append("lower(country) = lower(:country)")
        params["country"] = country

    if city:
        filters.append("lower(city) = lower(:city)")
        params["city"] = city

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from agency_offices
                where {where_clause}
                order by created_at desc
                limit 1
            """),
            params,
        ).fetchone()

        return dict(result._mapping) if result else None