from fastapi import APIRouter
from sqlalchemy import text

from app.db.database import engine


router = APIRouter()


@router.get("/inbox/conversations")
def list_conversations():
    org_id = "demo_agency"

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select
                    from_phone,
                    max(created_at) as last_message_at,
                    (array_agg(text_body order by created_at desc))[1] as last_message,
                    count(*) as message_count
                from messages
                where org_id = :org_id
                  and direction = 'inbound'
                group by from_phone
                order by max(created_at) desc
            """),
            {"org_id": org_id},
        )

        conversations = [dict(row._mapping) for row in result.fetchall()]

    return {
        "status": "ok",
        "conversations": conversations,
    }


@router.get("/inbox/conversations/{phone}/messages")
def get_conversation_messages(phone: str):
    org_id = "demo_agency"

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from messages
                where org_id = :org_id
                  and from_phone = :phone
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        )

        messages = [dict(row._mapping) for row in result.fetchall()]

    return {
        "status": "ok",
        "messages": messages,
    }