from sqlalchemy import text

from app.db.database import engine


def list_active_rules(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from insight_rules
                where org_id = :org_id
                  and active = true
                order by rule_code
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_rule_by_code(
    org_id: str,
    rule_code: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from insight_rules
                where org_id = :org_id
                  and rule_code = :rule_code
                  and active = true
                limit 1
            """),
            {
                "org_id": org_id,
                "rule_code": rule_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
