from sqlalchemy import text

from app.db.database import engine


def get_active_policies(
    org_id: str,
    metric_type: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from sla_policies
                where org_id = :org_id
                  and metric_type = :metric_type
                  and active = true
            """),
            {
                "org_id": org_id,
                "metric_type": metric_type,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def create_sla_breach(
    org_id: str,
    sla_policy_id: str,
    metric_id: str,
    entity_type: str | None,
    entity_id: str | None,
    breach_type: str,
    severity: str,
    expected_value: float,
    actual_value: float,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into sla_breaches (
                    org_id,
                    sla_policy_id,
                    metric_id,
                    entity_type,
                    entity_id,
                    breach_type,
                    severity,
                    expected_value,
                    actual_value
                )
                values (
                    :org_id,
                    :sla_policy_id,
                    :metric_id,
                    :entity_type,
                    :entity_id,
                    :breach_type,
                    :severity,
                    :expected_value,
                    :actual_value
                )
                returning *
            """),
            {
                "org_id": org_id,
                "sla_policy_id": sla_policy_id,
                "metric_id": metric_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "breach_type": breach_type,
                "severity": severity,
                "expected_value": expected_value,
                "actual_value": actual_value,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_sla_breaches(
    org_id: str,
    status: str | None = None,
):
    where = ["b.org_id = :org_id"]
    params = {
        "org_id": org_id,
    }

    if status:
        where.append("b.status = :status")
        params["status"] = status

    where_sql = " and ".join(where)

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select
                    b.*,
                    p.policy_name,
                    p.metric_type
                from sla_breaches b
                left join sla_policies p
                    on p.id = b.sla_policy_id
                where {where_sql}
                order by b.created_at desc
            """),
            params,
        ).fetchall()

        return [dict(row._mapping) for row in rows]

