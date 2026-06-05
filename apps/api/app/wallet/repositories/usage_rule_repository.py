from sqlalchemy import text

from app.db.database import engine


def get_usage_charge_rule(
    usage_type: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from usage_charge_rules
                where code = :usage_type
                  and is_active = true
                limit 1
            """),
            {
                "usage_type": usage_type,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def list_usage_charge_rules():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from usage_charge_rules
                where is_active = true
                order by code asc
            """),
        ).fetchall()

        return [dict(row._mapping) for row in rows]
