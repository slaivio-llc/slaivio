from sqlalchemy import text

from app.db.database import engine


def get_plan_entitlements(
    plan_code: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from plan_entitlements
                where plan_code = :plan_code
            """),
            {
                "plan_code": plan_code,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_org_plan_code(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select p.code as plan_code
                from agency_subscriptions s
                join pricing_plans p
                    on p.id = s.pricing_plan_id
                where s.org_id = :org_id
                  and s.status in ('TRIAL', 'ACTIVE', 'GRACE')
                limit 1
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return row._mapping["plan_code"] if row else "STARTER"


def get_org_entitlements(
    org_id: str,
):
    plan_code = get_org_plan_code(org_id)

    return {
        "plan_code": plan_code,
        "entitlements": get_plan_entitlements(plan_code),
    }


def get_entitlement(
    org_id: str,
    entitlement_key: str,
):
    plan_code = get_org_plan_code(org_id)

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from plan_entitlements
                where plan_code = :plan_code
                  and entitlement_key = :entitlement_key
                limit 1
            """),
            {
                "plan_code": plan_code,
                "entitlement_key": entitlement_key,
            },
        ).fetchone()

        return dict(row._mapping) if row else None

