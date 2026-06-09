import json

from sqlalchemy import text

from app.db.database import engine


def create_insight(
    org_id: str,
    insight_type: str,
    severity: str,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    recommended_action: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into operational_insights (
                    org_id,
                    insight_type,
                    severity,
                    entity_type,
                    entity_id,
                    title,
                    message,
                    recommended_action,
                    metadata
                )
                values (
                    :org_id,
                    :insight_type,
                    :severity,
                    :entity_type,
                    :entity_id,
                    :title,
                    :message,
                    :recommended_action,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "insight_type": insight_type,
                "severity": severity,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "title": title,
                "message": message,
                "recommended_action": recommended_action,
                "metadata": json.dumps(metadata or {}, default=str),
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None


def list_insights(
    org_id: str,
    status: str | None = None,
    severity: str | None = None,
    limit: int = 100,
):
    where_clauses = [
        "org_id = :org_id",
    ]
    params = {
        "org_id": org_id,
        "limit": limit,
    }

    if status:
        where_clauses.append("status = :status")
        params["status"] = status

    if severity:
        where_clauses.append("severity = :severity")
        params["severity"] = severity

    where_sql = " and ".join(where_clauses)

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select *
                from operational_insights
                where {where_sql}
                order by
                    case severity
                        when 'CRITICAL' then 0
                        when 'HIGH' then 1
                        when 'MEDIUM' then 2
                        else 3
                    end,
                    created_at desc
                limit :limit
            """),
            params,
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def find_existing_open_insight(
    org_id: str,
    insight_type: str,
    entity_type: str | None,
    entity_id: str | None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from operational_insights
                where org_id = :org_id
                  and insight_type = :insight_type
                  and coalesce(entity_type, '') = coalesce(:entity_type, '')
                  and coalesce(entity_id, '') = coalesce(:entity_id, '')
                  and status in ('OPEN', 'ACKNOWLEDGED')
                order by created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "insight_type": insight_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def mark_acknowledged(
    org_id: str,
    insight_id: str,
):
    return _update_status(
        org_id=org_id,
        insight_id=insight_id,
        status="ACKNOWLEDGED",
        resolved=False,
    )


def mark_resolved(
    org_id: str,
    insight_id: str,
):
    return _update_status(
        org_id=org_id,
        insight_id=insight_id,
        status="RESOLVED",
        resolved=True,
    )


def dismiss_insight(
    org_id: str,
    insight_id: str,
):
    return _update_status(
        org_id=org_id,
        insight_id=insight_id,
        status="DISMISSED",
        resolved=True,
    )


def _update_status(
    org_id: str,
    insight_id: str,
    status: str,
    resolved: bool,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update operational_insights
                set
                    status = :status,
                    updated_at = now(),
                    resolved_at = case
                        when :resolved then now()
                        else resolved_at
                    end
                where org_id = :org_id
                  and id = :insight_id
                returning *
            """),
            {
                "org_id": org_id,
                "insight_id": insight_id,
                "status": status,
                "resolved": resolved,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None
