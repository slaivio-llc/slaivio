import json

from sqlalchemy import text

from app.db.database import engine


def log_response_decision(
    org_id: str,
    message: str,
    intent: str,
    confidence: float,
    decision: str,
    reason: str | None = None,
    response_text: str | None = None,
    entities: dict | None = None,
    client_phone: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_response_decisions (
                    org_id,
                    client_phone,
                    message,
                    intent,
                    confidence,
                    decision,
                    reason,
                    response_text,
                    entities
                )
                values (
                    :org_id,
                    :client_phone,
                    :message,
                    :intent,
                    :confidence,
                    :decision,
                    :reason,
                    :response_text,
                    cast(:entities as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "message": message,
                "intent": intent,
                "confidence": confidence,
                "decision": decision,
                "reason": reason,
                "response_text": response_text,
                "entities": json.dumps(entities or {}),
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)

