from sqlalchemy import text

from app.db.database import engine


def get_subscription(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    s.*,
                    p.name as plan_name,
                    p.monthly_price_minor
                from agency_subscriptions s
                left join pricing_plans p
                    on p.id = s.pricing_plan_id
                where s.org_id = :org_id
                limit 1
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def upsert_subscription(
    org_id: str,
    plan_id: str,
    status: str = "TRIAL",
    starts_at: str | None = None,
    trial_ends_at: str | None = None,
    current_period_ends_at: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into agency_subscriptions (
                    org_id,
                    pricing_plan_id,
                    status,
                    starts_at,
                    trial_ends_at,
                    ends_at
                )
                values (
                    :org_id,
                    :plan_id,
                    :status,
                    coalesce(cast(:starts_at as timestamptz), now()),
                    cast(:trial_ends_at as timestamptz),
                    cast(:current_period_ends_at as timestamptz)
                )
                on conflict (org_id)
                do update set
                    pricing_plan_id = excluded.pricing_plan_id,
                    status = excluded.status,
                    trial_ends_at = excluded.trial_ends_at,
                    ends_at = excluded.ends_at,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "plan_id": plan_id,
                "status": status,
                "starts_at": starts_at,
                "trial_ends_at": trial_ends_at,
                "current_period_ends_at": current_period_ends_at,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def update_subscription_status(
    org_id: str,
    status: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update agency_subscriptions
                set
                    status = :status,
                    updated_at = now()
                where org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "status": status,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None
