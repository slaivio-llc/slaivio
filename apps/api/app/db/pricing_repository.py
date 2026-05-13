from sqlalchemy import text

from app.db.database import engine


def create_pricing_rule(
    org_id: str,
    origin_country: str | None = None,
    origin_city: str | None = None,
    destination_country: str | None = None,
    destination_city: str | None = None,
    shipping_mode: str | None = None,
    goods_type: str | None = None,
    rule_type: str = "PER_KG",
    pricing_mode: str | None = None,
    unit: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    price: float = 0,
    currency: str = "USD",
    note: str | None = None,
    requires_manual_confirmation: bool = False,
    priority: int = 0,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into pricing_rules (
                    org_id,
                    origin_country,
                    origin_city,
                    destination_country,
                    destination_city,
                    shipping_mode,
                    goods_type,
                    rule_type,
                    pricing_mode,
                    unit,
                    min_value,
                    max_value,
                    price,
                    currency,
                    note,
                    requires_manual_confirmation,
                    priority
                )
                values (
                    :org_id,
                    :origin_country,
                    :origin_city,
                    :destination_country,
                    :destination_city,
                    :shipping_mode,
                    :goods_type,
                    :rule_type,
                    :pricing_mode,
                    :unit,
                    :min_value,
                    :max_value,
                    :price,
                    :currency,
                    :note,
                    :requires_manual_confirmation,
                    :priority
                )
                returning *
            """),
            {
                "org_id": org_id,
                "origin_country": origin_country.strip() if origin_country else None,
                "origin_city": origin_city.strip() if origin_city else None,
                "destination_country": destination_country.strip() if destination_country else None,
                "destination_city": destination_city.strip() if destination_city else None,
                "shipping_mode": shipping_mode.strip().upper() if shipping_mode else None,
                "goods_type": goods_type.strip().lower() if goods_type else None,
                "rule_type": rule_type.strip().upper(),
                "pricing_mode": pricing_mode.strip().upper() if pricing_mode else None,
                "unit": unit.strip().upper() if unit else None,
                "min_value": min_value,
                "max_value": max_value,
                "price": price,
                "currency": currency.strip().upper(),
                "note": note,
                "requires_manual_confirmation": requires_manual_confirmation,
                "priority": priority,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def find_pricing_rules(
    org_id: str,
    origin_country: str | None = None,
    destination_country: str | None = None,
    origin_city: str | None = None,
    destination_city: str | None = None,
    shipping_mode: str | None = None,
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
        filters.append("(origin_country is null or lower(origin_country) = lower(:origin_country))")
        params["origin_country"] = origin_country.strip()

    if destination_country:
        filters.append("(destination_country is null or lower(destination_country) = lower(:destination_country))")
        params["destination_country"] = destination_country.strip()

    if origin_city:
        filters.append("(origin_city is null or lower(origin_city) = lower(:origin_city))")
        params["origin_city"] = origin_city.strip()

    if destination_city:
        filters.append("(destination_city is null or lower(destination_city) = lower(:destination_city))")
        params["destination_city"] = destination_city.strip()

    if shipping_mode:
        filters.append("(shipping_mode is null or upper(shipping_mode) = upper(:shipping_mode))")
        params["shipping_mode"] = shipping_mode.strip()

    if goods_type:
        filters.append("(goods_type is null or lower(goods_type) = lower(:goods_type))")
        params["goods_type"] = goods_type.strip().lower()

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


def list_pricing_rules(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from pricing_rules
                where org_id = :org_id
                order by priority desc, created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_pricing_rule(
    org_id: str,
    rule_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from pricing_rules
                where org_id = :org_id
                  and id = :rule_id
                limit 1
            """),
            {
                "org_id": org_id,
                "rule_id": rule_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def update_pricing_rule(
    org_id: str,
    rule_id: str,
    **fields,
):
    allowed = {
        "origin_country",
        "origin_city",
        "destination_country",
        "destination_city",
        "shipping_mode",
        "goods_type",
        "rule_type",
        "pricing_mode",
        "unit",
        "min_value",
        "max_value",
        "price",
        "currency",
        "note",
        "requires_manual_confirmation",
        "priority",
        "is_active",
    }

    updates = []
    params = {
        "org_id": org_id,
        "rule_id": rule_id,
    }

    for key, value in fields.items():
        if key in allowed and value is not None:
            updates.append(f"{key} = :{key}")
            params[key] = value

    if not updates:
        return get_pricing_rule(
            org_id=org_id,
            rule_id=rule_id,
        )

    updates.append("updated_at = now()")

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                update pricing_rules
                set {", ".join(updates)}
                where org_id = :org_id
                  and id = :rule_id
                returning *
            """),
            params,
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
