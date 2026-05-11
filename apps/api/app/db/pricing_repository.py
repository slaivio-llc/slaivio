from sqlalchemy import text
from app.db.database import engine


def find_pricing_rules(
    org_id: str,
    origin_country: str | None = None,
    destination_country: str | None = None,
    goods_type: str | None = None,
):
    filters = [
        "org_id = :org_id",
        "is_active = true",
    ]

    params = {
        "org_id": org_id,
    }

    if origin_country:
        filters.append("lower(origin_country) = lower(:origin_country)")
        params["origin_country"] = origin_country.strip()

    if destination_country:
        filters.append("lower(destination_country) = lower(:destination_country)")
        params["destination_country"] = destination_country.strip()

    if goods_type:
        filters.append("(goods_type is null or lower(goods_type) = lower(:goods_type))")
        params["goods_type"] = goods_type.strip()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from pricing_rules
                where {where_clause}
                order by
                    priority desc,
                    created_at desc
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]
