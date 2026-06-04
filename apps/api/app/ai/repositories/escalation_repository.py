from sqlalchemy import text

from app.db.database import engine


def log_escalation_event(
    org_id: str,
    client_phone: str | None,
    message: str,
    intent: str,
    escalation_score: float,
    escalation_reason: str,
    triggered_rules: list[str],
    decision: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_escalation_events (
                    org_id,
                    client_phone,
                    message,
                    intent,
                    escalation_score,
                    escalation_reason,
                    triggered_rules,
                    decision
                )
                values (
                    :org_id,
                    :client_phone,
                    :message,
                    :intent,
                    :escalation_score,
                    :escalation_reason,
                    :triggered_rules,
                    :decision
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "message": message,
                "intent": intent,
                "escalation_score": escalation_score,
                "escalation_reason": escalation_reason,
                "triggered_rules": triggered_rules,
                "decision": decision,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)

