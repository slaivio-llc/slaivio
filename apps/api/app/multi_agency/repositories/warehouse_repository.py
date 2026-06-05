from sqlalchemy import text

from app.db.database import engine


def create_warehouse(
    org_id: str,
    group_id: str | None,
    country_id: str | None,
    warehouse_code: str,
    warehouse_name: str,
    warehouse_type: str,
    country_code: str | None = None,
    city: str | None = None,
    address: str | None = None,
    contact_phone: str | None = None,
    contact_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into warehouses (
                    org_id,
                    group_id,
                    country_id,
                    warehouse_code,
                    warehouse_name,
                    warehouse_type,
                    country_code,
                    city,
                    address,
                    contact_phone,
                    contact_name
                )
                values (
                    :org_id,
                    :group_id,
                    :country_id,
                    :warehouse_code,
                    :warehouse_name,
                    :warehouse_type,
                    :country_code,
                    :city,
                    :address,
                    :contact_phone,
                    :contact_name
                )
                on conflict (warehouse_code)
                do update set
                    org_id = excluded.org_id,
                    group_id = excluded.group_id,
                    country_id = excluded.country_id,
                    warehouse_name = excluded.warehouse_name,
                    warehouse_type = excluded.warehouse_type,
                    country_code = excluded.country_code,
                    city = excluded.city,
                    address = excluded.address,
                    contact_phone = excluded.contact_phone,
                    contact_name = excluded.contact_name,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "group_id": group_id,
                "country_id": country_id,
                "warehouse_code": warehouse_code,
                "warehouse_name": warehouse_name,
                "warehouse_type": warehouse_type,
                "country_code": country_code,
                "city": city,
                "address": address,
                "contact_phone": contact_phone,
                "contact_name": contact_name,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_warehouses(
    org_id: str | None = None,
):
    where_sql = "where active = true"
    params = {}

    if org_id:
        where_sql = "where org_id = :org_id and active = true"
        params["org_id"] = org_id

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select *
                from warehouses
                {where_sql}
                order by warehouse_name
            """),
            params,
        ).fetchall()

        return [dict(row._mapping) for row in rows]

