from sqlalchemy import text

from app.db.database import engine


def get_active_configuration_version(
    org_id: str,
    config_domain: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from configuration_versions
                where org_id = :org_id
                  and config_domain = :config_domain
                  and status = 'ACTIVE'
                order by version_number desc
                limit 1
            """),
            {
                "org_id": org_id,
                "config_domain": config_domain,
            },
        ).fetchone()

    return dict(row._mapping) if row else None


def resolve_shipping_service(
    org_id: str,
    origin_country: str | None = None,
    destination_country: str | None = None,
    destination_city: str | None = None,
    shipping_mode: str | None = None,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipping_services
                where org_id = :org_id
                  and active = true
                  and (:origin_country is null or origin_country is null or lower(origin_country) = lower(:origin_country))
                  and (:destination_country is null or destination_country is null or lower(destination_country) = lower(:destination_country))
                  and (:destination_city is null or destination_city is null or lower(destination_city) = lower(:destination_city))
                  and (:shipping_mode is null or shipping_mode is null or lower(shipping_mode) = lower(:shipping_mode))
                order by priority asc, created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "origin_country": origin_country,
                "destination_country": destination_country,
                "destination_city": destination_city,
                "shipping_mode": shipping_mode,
            },
        ).fetchone()

    return dict(rows._mapping) if rows else None


def resolve_pricing_components(
    org_id: str,
    shipping_service_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from pricing_components
                where org_id = :org_id
                  and shipping_service_id = :shipping_service_id
                  and active = true
                order by priority asc, created_at asc
            """),
            {
                "org_id": org_id,
                "shipping_service_id": shipping_service_id,
            },
        ).fetchall()

    return [dict(row._mapping) for row in rows]


def resolve_goods_rule(
    org_id: str,
    goods_description: str | None = None,
    goods_category: str | None = None,
    shipping_service_id: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from advanced_goods_rules
                where org_id = :org_id
                  and active = true
                  and (:shipping_service_id is null or shipping_service_id is null or shipping_service_id = :shipping_service_id)
                  and (
                    (:goods_category is not null and goods_category is not null and lower(goods_category) = lower(:goods_category))
                    or
                    (:goods_description is not null and goods_name is not null and lower(:goods_description) like '%' || lower(goods_name) || '%')
                  )
                order by priority asc, created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "goods_description": goods_description,
                "goods_category": goods_category,
                "shipping_service_id": shipping_service_id,
            },
        ).fetchone()

    return dict(row._mapping) if row else None
