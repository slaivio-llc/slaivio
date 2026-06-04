import json

from sqlalchemy import text

from app.db.database import engine


def log_intent_detection(
    org_id: str,
    message: str,
    intent: str,
    confidence: float,
    entities: dict,
    raw_response: dict | None = None,
    client_phone: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_intent_logs (
                    org_id,
                    client_phone,
                    message,
                    intent,
                    confidence,
                    entities,
                    raw_response
                )
                values (
                    :org_id,
                    :client_phone,
                    :message,
                    :intent,
                    :confidence,
                    cast(:entities as jsonb),
                    cast(:raw_response as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "message": message,
                "intent": intent,
                "confidence": confidence,
                "entities": json.dumps(entities or {}),
                "raw_response": json.dumps(raw_response or {}),
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)

