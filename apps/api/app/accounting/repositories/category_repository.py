from sqlalchemy import text

from app.db.database import engine


def list_accounting_categories(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from accounting_categories
                where org_id = :org_id
                  and is_active = true
                order by category_type asc, name asc
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def create_accounting_category(
    org_id: str,
    category_code: str,
    category_name: str,
    category_type: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into accounting_categories (
                    org_id,
                    code,
                    name,
                    category_type
                )
                values (
                    :org_id,
                    :category_code,
                    :category_name,
                    :category_type
                )
                on conflict (org_id, code)
                do update set
                    name = excluded.name,
                    category_type = excluded.category_type,
                    is_active = true,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "category_code": category_code,
                "category_name": category_name,
                "category_type": category_type,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None
