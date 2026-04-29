from datetime import datetime, timezone
from fastapi import APIRouter, Request
from app.services.deduplication import is_duplicate, mark_as_seen
from app.models.message import NormalizedMessage
from app.db.message_repository import (
    insert_raw_message, 
    get_or_create_client,
    get_or_create_active_dossier,
    create_dossier_event,
    update_dossier_from_intent,
)
from app.services.intent_detector import detect_intent
from app.services.reply_generator import generate_reply

router = APIRouter()


@router.get("/webhook/whatsapp")
def verify_webhook():
    return {"status": "webhook verification endpoint ready"}


def normalize_whatsapp_payload(payload: dict) -> NormalizedMessage:
    from_phone = payload.get("from", "unknown")
    to_phone = payload.get("to")
    text_body = payload.get("text")
    provider_message_id = payload.get("id")

    dedupe_key = provider_message_id or f"whatsapp:{from_phone}:{text_body}"

    return NormalizedMessage(
        provider_message_id=provider_message_id,
        from_phone=from_phone,
        to_phone=to_phone,
        text_body=text_body,
        received_at=datetime.now(timezone.utc),
        dedupe_key=dedupe_key,
    )


@router.post("/webhook/whatsapp")
async def receive_whatsapp_message(request: Request):
    payload = await request.json()

    normalized_message = normalize_whatsapp_payload(payload)

    if is_duplicate(normalized_message.dedupe_key):
        return {
            "status": "duplicate",
            "message": "Message already processed",
            "dedupe_key": normalized_message.dedupe_key,
        }

    mark_as_seen(normalized_message.dedupe_key)

    client_id = get_or_create_client(
        org_id="demo_agency",
        phone=normalized_message.from_phone,
    )

    dossier_id = get_or_create_active_dossier(
        org_id="demo_agency",
        client_id=client_id,
    )

    insert_raw_message(
        org_id="demo_agency",
        phone=normalized_message.from_phone,
        text_msg=normalized_message.text_body or "",
        payload=payload,
        client_id=client_id,
        dossier_id=dossier_id,
    )

    intent = detect_intent(normalized_message.text_body)

    updated_dossier = update_dossier_from_intent(
        org_id="demo_agency",
        dossier_id=dossier_id,
        intent=intent,
    )

    if updated_dossier:
        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="DOSSIER_UPDATED_FROM_INTENT",
            payload={
                "intent": intent,
                "case_type": updated_dossier["case_type"],
                "status_global": updated_dossier["status_global"],
            },
        )
    
    reply = generate_reply(intent)

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="REPLY_GENERATED",
        payload={
            "intent": intent,
            "reply_type": reply["reply_type"],
            "should_escalate": reply["should_escalate"],
            "message": reply["message"],
        },
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="INTENT_DETECTED",
        payload={
            "intent": intent,
            "text": normalized_message.text_body,
            "source": "rules",
        },
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="CLIENT_IDENTIFIED",
        payload={
            "client_id": str(client_id),
            "phone": normalized_message.from_phone,
        },
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="MESSAGE_RECEIVED",
        payload={
            "intent": intent,
            "text": normalized_message.text_body,
            "phone": normalized_message.from_phone,
            "source": "rules",
        },
    )

    return {
        "status": "stored",
        "client_id": str(client_id),
        "dossier_id": str(dossier_id),
        "intent": intent,
        "updated_dossier": updated_dossier,
        "reply": reply,
        "normalized_message": normalized_message.model_dump(mode="json"),
    }