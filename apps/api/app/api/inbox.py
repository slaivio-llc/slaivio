from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.core.tenant_context import get_current_tenant
from app.db.database import engine


router = APIRouter()


@router.get("/inbox/conversations")
def list_conversations(
    number_role: str | None = None,
    status: str | None = None,
    queue_name: str | None = None,
    priority: str | None = None,
    requires_attention: bool | None = None,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]
    where_clauses = [
        "org_id = :org_id",
    ]
    params = {
        "org_id": org_id,
    }

    if number_role:
        where_clauses.append("number_role = :number_role")
        params["number_role"] = number_role

    if status:
        where_clauses.append("conversation_status = :status")
        params["status"] = status

    if queue_name:
        where_clauses.append("queue_name = :queue_name")
        params["queue_name"] = queue_name

    if priority:
        where_clauses.append("priority = :priority")
        params["priority"] = priority

    if requires_attention is not None:
        where_clauses.append("requires_attention = :requires_attention")
        params["requires_attention"] = requires_attention

    where_sql = " and ".join(where_clauses)

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select
                    org_id,
                    from_phone,
                    last_message_at,
                    last_message,
                    message_count,
                    number_role,
                    provider_phone_number_id,
                    whatsapp_number_id,
                    conversation_status,
                    priority,
                    queue_name,
                    unread_count,
                    requires_attention,
                    assigned_manager_id,
                    assigned_manager_name,
                    last_note,
                    waiting_since
                from inbox_conversations_view
                where {where_sql}
                order by last_message_at desc
            """),
            params,
        ).fetchall()

    return {
        "status": "ok",
        "conversations": [dict(row._mapping) for row in rows],
    }


@router.get("/inbox/conversations/{phone}/messages")
def get_conversation_messages(
    phone: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    org_id,
                    from_phone,
                    to_phone,
                    direction,
                    text_body,
                    provider,
                    provider_message_id,
                    provider_phone_number_id,
                    whatsapp_number_id,
                    waba_id,
                    number_role,
                    conversation_status,
                    priority,
                    assigned_manager_id,
                    send_status,
                    error_message,
                    created_at
                from messages
                where org_id = :org_id
                  and (
                    from_phone = :phone
                    or to_phone = :phone
                  )
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        ).fetchall()

    return {
        "status": "ok",
        "messages": [dict(row._mapping) for row in rows],
    }


@router.patch("/inbox/conversations/{phone}/status")
def update_conversation_status(
    phone: str,
    status: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    with engine.connect() as conn:
        conn.execute(
            text("""
                update messages
                set conversation_status = :status
                where org_id = :org_id
                  and from_phone = :phone
            """),
            {
                "org_id": org_id,
                "phone": phone,
                "status": status,
            },
        )
        conn.commit()

    return {
        "status": "ok",
        "conversation_status": status,
    }
