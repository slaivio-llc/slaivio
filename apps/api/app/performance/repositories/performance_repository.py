from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_performance_metric(
    org_id: str,
    metric_type: str,
    metric_name: str,
    metric_value: float,
    metric_unit: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_id: str | None = None,
    actor_name: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into performance_metrics (
                    org_id,
                    metric_type,
                    metric_name,
                    metric_value,
                    metric_unit,
                    entity_type,
                    entity_id,
                    actor_id,
                    actor_name,
                    metadata
                )
                values (
                    :org_id,
                    :metric_type,
                    :metric_name,
                    :metric_value,
                    :metric_unit,
                    :entity_type,
                    :entity_id,
                    :actor_id,
                    :actor_name,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "metric_type": metric_type,
                "metric_name": metric_name,
                "metric_value": metric_value,
                "metric_unit": metric_unit,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "actor_id": actor_id,
                "actor_name": actor_name,
                "metadata": to_jsonb(metadata or {}),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_performance_metrics(
    org_id: str,
    metric_type: str | None = None,
    limit: int = 100,
):
    where = ["org_id = :org_id"]
    params = {
        "org_id": org_id,
        "limit": limit,
    }

    if metric_type:
        where.append("metric_type = :metric_type")
        params["metric_type"] = metric_type

    where_sql = " and ".join(where)

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select *
                from performance_metrics
                where {where_sql}
                order by measured_at desc
                limit :limit
            """),
            params,
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def performance_summary(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    metric_type,
                    metric_unit,
                    count(*) as total_records,
                    avg(metric_value) as avg_value,
                    min(metric_value) as min_value,
                    max(metric_value) as max_value
                from performance_metrics
                where org_id = :org_id
                group by metric_type, metric_unit
                order by metric_type
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

