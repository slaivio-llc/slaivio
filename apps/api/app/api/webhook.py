from datetime import datetime, timezone
from fastapi import APIRouter, Request
from app.services.deduplication import is_duplicate, mark_as_seen
from app.models.message import NormalizedMessage
from app.db.message_repository import (
    insert_raw_message, 
    get_or_create_client,
    get_or_create_active_dossier,
    create_dossier_event,
)

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
            "text": normalized_message.text_body,
            "phone": normalized_message.from_phone,
        },
    )

    print("=== CLIENT ID ===")
    print(client_id)

    print("=== DOSSIER ID ===")
    print(dossier_id)

    if is_duplicate(normalized_message.dedupe_key):
        return {
            "status": "duplicate",
            "message": "Message already processed",
            "dedupe_key": normalized_message.dedupe_key,
        }
        
    mark_as_seen(normalized_message.dedupe_key)

    print("=== WHATSAPP WEBHOOK RECEIVED ===")
    print(payload)

    print("=== NORMALIZED MESSAGE ===")
    print(normalized_message.model_dump())

    return {
        "status": "stored",
        "client_id": str(client_id),
        "dossier_id": str(dossier_id),
        "normalized_message": normalized_message.model_dump(mode="json"),
    }