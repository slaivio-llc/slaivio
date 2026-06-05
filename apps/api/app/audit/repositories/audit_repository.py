from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_audit_log(
    org_id: str | None,
    actor_id: str | None,
    actor_name: str | None,
    actor_role: str | None,
    entity_type: str,
    entity_id: str | None,
    action: str,
    old_data: dict | None = None,
    new_data: dict | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    severity: str = "INFO",
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into audit_logs (
                    org_id,
                    actor_id,
                    actor_name,
                    actor_role,
                    entity_type,
                    entity_id,
                    action,
                    old_data,
                    new_data,
                    metadata,
                    ip_address,
                    user_agent,
                    severity
                )
                values (
                    :org_id,
                    :actor_id,
                    :actor_name,
                    :actor_role,
                    :entity_type,
                    :entity_id,
                    :action,
                    cast(:old_data as jsonb),
                    cast(:new_data as jsonb),
                    cast(:metadata as jsonb),
                    :ip_address,
                    :user_agent,
                    :severity
                )
                returning *
            """),
            {
                "org_id": org_id,
                "actor_id": actor_id,
                "actor_name": actor_name,
                "actor_role": actor_role,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": action,
                "old_data": to_jsonb(old_data or {}),
                "new_data": to_jsonb(new_data or {}),
                "metadata": to_jsonb(metadata or {}),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "severity": severity,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_audit_logs(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from audit_logs
                where org_id = :org_id
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

