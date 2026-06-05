from sqlalchemy import text

from app.db.database import engine


def list_pricing_plans():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    *,
                    code as plan_code,
                    name as plan_name
                from pricing_plans
                where active = true
                order by monthly_price_minor asc
            """),
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_pricing_plan(
    plan_code: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    *,
                    code as plan_code,
                    name as plan_name
                from pricing_plans
                where code = :plan_code
                  and active = true
                limit 1
            """),
            {
                "plan_code": plan_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
