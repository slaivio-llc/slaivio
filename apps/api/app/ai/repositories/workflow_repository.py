import json

from sqlalchemy import text

from app.db.database import engine


def create_workflow_run(
    org_id: str,
    client_phone: str,
    source_message: str,
    intent: str,
    confidence: float,
    workflow_type: str,
    entities: dict,
    proposed_actions: list,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_workflow_runs (
                    org_id,
                    client_phone,
                    source_message,
                    intent,
                    confidence,
                    workflow_type,
                    entities,
                    proposed_actions,
                    manager_id,
                    manager_name
                )
                values (
                    :org_id,
                    :client_phone,
                    :source_message,
                    :intent,
                    :confidence,
                    :workflow_type,
                    cast(:entities as jsonb),
                    cast(:proposed_actions as jsonb),
                    :manager_id,
                    :manager_name
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "source_message": source_message,
                "intent": intent,
                "confidence": confidence,
                "workflow_type": workflow_type,
                "entities": json.dumps(entities or {}),
                "proposed_actions": json.dumps(proposed_actions or []),
                "manager_id": manager_id,
                "manager_name": manager_name,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)


def list_workflow_runs(
    org_id: str,
    client_phone: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from ai_workflow_runs
                where org_id = :org_id
                  and client_phone = :client_phone
                order by created_at desc
                limit 30
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def update_workflow_status(
    workflow_id: str,
    status: str,
    result_payload: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update ai_workflow_runs
                set
                    workflow_status = :status,
                    result_payload = coalesce(
                        cast(:result_payload as jsonb),
                        result_payload
                    ),
                    updated_at = now()
                where id = :workflow_id
                returning *
            """),
            {
                "workflow_id": workflow_id,
                "status": status,
                "result_payload": (
                    json.dumps(result_payload)
                    if result_payload is not None
                    else None
                ),
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None

