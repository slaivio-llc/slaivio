from sqlalchemy import text

from app.db.database import engine


def create_ai_draft(
    org_id: str,
    client_phone: str,
    source_message: str,
    draft_text: str,
    intent: str | None = None,
    decision: str | None = None,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_draft_responses (
                    org_id,
                    client_phone,
                    source_message,
                    intent,
                    decision,
                    draft_text,
                    manager_id,
                    manager_name
                )
                values (
                    :org_id,
                    :client_phone,
                    :source_message,
                    :intent,
                    :decision,
                    :draft_text,
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
                "decision": decision,
                "draft_text": draft_text,
                "manager_id": manager_id,
                "manager_name": manager_name,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)


def mark_ai_draft_used(draft_id: str):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update ai_draft_responses
                set
                    status = 'USED',
                    updated_at = now()
                where id = :draft_id
                returning *
            """),
            {
                "draft_id": draft_id,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None


def list_ai_drafts(
    org_id: str,
    client_phone: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from ai_draft_responses
                where org_id = :org_id
                  and client_phone = :client_phone
                order by created_at desc
                limit 20
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

