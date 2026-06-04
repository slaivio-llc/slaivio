from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.conversation_timeline_repository import create_timeline_event
from app.core.websocket_manager import manager
from app.db.outbound_message_repository import (
    create_outbound_message,
    mark_outbound_message_failed,
    mark_outbound_message_sent,
)
from app.ai.repositories.draft_response_repository import mark_ai_draft_used
from app.services.whatsapp_provider_factory import get_whatsapp_provider
from app.services.whatsapp_routing_service import resolve_outbound_number


router = APIRouter()

ORG_ID = "demo_agency"


class SendReplyRequest(BaseModel):
    message: str
    preferred_role: str | None = "SUPPORT"
    manager_id: str | None = None
    manager_name: str | None = None
    draft_id: str | None = None


@router.post("/inbox/conversations/{phone}/reply")
async def send_reply(
    phone: str,
    body: SendReplyRequest,
):
    message_text = body.message.strip()

    if not message_text:
        raise HTTPException(
            status_code=400,
            detail="Message is required",
        )

    route = resolve_outbound_number(
        org_id=ORG_ID,
        preferred_role=body.preferred_role,
    )

    if not route["resolved"]:
        raise HTTPException(
            status_code=400,
            detail="No WhatsApp number available",
        )

    number = route["number"]
    whatsapp_number_id = number.get("id")

    outbound_message = create_outbound_message(
        org_id=ORG_ID,
        to_phone=phone,
        from_phone=number.get("display_phone_number"),
        text_body=message_text,
        provider="META",
        provider_phone_number_id=number.get("phone_number_id"),
        whatsapp_number_id=(
            str(whatsapp_number_id)
            if whatsapp_number_id is not None
            else None
        ),
        waba_id=number.get("waba_id"),
        number_role=number.get("number_role"),
        send_status="PENDING",
    )

    try:
        provider = get_whatsapp_provider(
            org_id=ORG_ID,
            preferred_role=body.preferred_role,
        )
        result = provider.send_message(
            to=phone,
            message=message_text,
        )

        if result.get("success"):
            sent_message = mark_outbound_message_sent(
                message_id=str(outbound_message["id"]),
                provider_message_id=result.get("provider_message_id"),
            )

            create_timeline_event(
                org_id=ORG_ID,
                client_phone=phone,
                event_type="MESSAGE_SENT",
                event_title="Reponse envoyee",
                event_payload={
                    "message_id": str(outbound_message["id"]),
                    "provider_message_id": result.get(
                        "provider_message_id"
                    ),
                    "number_role": number.get("number_role"),
                },
                created_by_id=body.manager_id,
                created_by_name=body.manager_name,
            )

            await manager.broadcast(
                {
                    "event": "NEW_MESSAGE",
                    "phone": phone,
                    "message": message_text,
                    "direction": "outbound",
                }
            )

            if body.draft_id:
                mark_ai_draft_used(body.draft_id)

            return {
                "status": "ok",
                "message": sent_message,
                "provider_response": result,
            }

        failed_message = mark_outbound_message_failed(
            message_id=str(outbound_message["id"]),
            error_message=str(result),
        )

        return {
            "status": "failed",
            "message": failed_message,
            "provider_response": result,
        }

    except Exception as exc:
        failed_message = mark_outbound_message_failed(
            message_id=str(outbound_message["id"]),
            error_message=str(exc),
        )

        return {
            "status": "failed",
            "message": failed_message,
            "error": str(exc),
        }
