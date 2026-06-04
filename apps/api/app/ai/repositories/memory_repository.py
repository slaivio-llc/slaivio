from sqlalchemy import text

from app.db.database import engine


def store_memory(
    org_id: str,
    client_phone: str,
    role: str,
    content: str,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into ai_conversation_memory (
                    org_id,
                    client_phone,
                    role,
                    content
                )
                values (
                    :org_id,
                    :client_phone,
                    :role,
                    :content
                )
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "role": role,
                "content": content,
            },
        )
        conn.commit()


def get_recent_memory(
    org_id: str,
    client_phone: str,
    limit: int = 10,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select role, content
                from ai_conversation_memory
                where org_id = :org_id
                  and client_phone = :client_phone
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "limit": limit,
            },
        ).fetchall()

        return list(reversed([dict(row._mapping) for row in rows]))

