from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_financial_audit_log(
    org_id: str,
    actor_id: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    before_state: dict | None = None,
    after_state: dict | None = None,
    severity: str = "INFO",
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into financial_audit_logs (
                    org_id,
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    before_state,
                    after_state,
                    severity,
                    ip_address,
                    user_agent
                )
                values (
                    :org_id,
                    :actor_id,
                    :action,
                    :entity_type,
                    :entity_id,
                    cast(:before_state as jsonb),
                    cast(:after_state as jsonb),
                    :severity,
                    :ip_address,
                    :user_agent
                )
                returning *
            """),
            {
                "org_id": org_id,
                "actor_id": actor_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "before_state": to_jsonb(before_state),
                "after_state": to_jsonb(after_state),
                "severity": severity,
                "ip_address": ip_address,
                "user_agent": user_agent,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_financial_audit_logs(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from financial_audit_logs
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

