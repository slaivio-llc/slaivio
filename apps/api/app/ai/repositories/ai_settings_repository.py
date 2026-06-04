from sqlalchemy import text

from app.db.database import engine


DEFAULT_AI_SETTINGS = {
    "provider": "MISTRAL",
    "model_name": "mistral-large-latest",
    "temperature": 0.2,
    "max_tokens": 700,
    "enabled": True,
    "escalation_threshold": 0.60,
    "auto_escalation_enabled": True,
}


def get_ai_settings(org_id: str):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from ai_settings
                where org_id = :org_id
                limit 1
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else DEFAULT_AI_SETTINGS

