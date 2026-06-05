from sqlalchemy import text

from app.db.database import engine


def create_group(
    group_code: str,
    group_name: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into organization_groups (
                    group_code,
                    group_name
                )
                values (
                    :group_code,
                    :group_name
                )
                on conflict (group_code)
                do update set
                    group_name = excluded.group_name,
                    updated_at = now()
                returning *
            """),
            {
                "group_code": group_code,
                "group_name": group_name,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def create_country(
    group_id: str,
    country_code: str,
    country_name: str,
    default_currency_code: str = "USD",
    default_timezone: str = "UTC",
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into organization_countries (
                    group_id,
                    country_code,
                    country_name,
                    default_currency_code,
                    default_timezone
                )
                values (
                    :group_id,
                    :country_code,
                    :country_name,
                    :default_currency_code,
                    :default_timezone
                )
                on conflict (group_id, country_code)
                do update set
                    country_name = excluded.country_name,
                    default_currency_code = excluded.default_currency_code,
                    default_timezone = excluded.default_timezone,
                    updated_at = now()
                returning *
            """),
            {
                "group_id": group_id,
                "country_code": country_code,
                "country_name": country_name,
                "default_currency_code": default_currency_code,
                "default_timezone": default_timezone,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_hierarchy():
    with engine.connect() as conn:
        groups = conn.execute(
            text("""
                select *
                from organization_groups
                order by group_name
            """),
        ).fetchall()

        countries = conn.execute(
            text("""
                select *
                from organization_countries
                order by country_name
            """),
        ).fetchall()

        organizations = conn.execute(
            text("""
                select *
                from organizations
                order by organization_name
            """),
        ).fetchall()

        warehouses = conn.execute(
            text("""
                select *
                from warehouses
                order by warehouse_name
            """),
        ).fetchall()

    return {
        "groups": [dict(row._mapping) for row in groups],
        "countries": [dict(row._mapping) for row in countries],
        "organizations": [dict(row._mapping) for row in organizations],
        "warehouses": [dict(row._mapping) for row in warehouses],
    }

