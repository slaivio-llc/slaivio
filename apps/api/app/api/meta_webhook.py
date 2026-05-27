from fastapi import APIRouter, Request, Response, HTTPException
from app.core.config import settings
from app.api.webhook import process_normalized_whatsapp_message
from app.services.meta_payload import (
    normalize_meta_payload,
    extract_meta_statuses,
    extract_meta_phone_number_id,
)
from app.db.organization_whatsapp_repository import find_org_by_meta_phone_number_id
from app.db.notification_repository import (
    get_notification_by_provider_message_id,
    update_notification_provider_status,
    create_notification_delivery_event,
)
from app.services.meta_media_parser import extract_meta_media_items
from app.services.inbound_media_service import store_inbound_meta_media
from app.services.whatsapp_routing_service import (
    resolve_inbound_route,
)




router = APIRouter()


@router.get("/webhook/meta/whatsapp")
async def verify_meta_webhook(request: Request):
    params = request.query_params

    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.meta_wa_verify_token:
        return Response(
            content=challenge or "",
            media_type="text/plain",
        )

    raise HTTPException(
        status_code=403,
        detail="Invalid verify token",
    )


@router.post("/webhook/meta/whatsapp")
async def meta_whatsapp_webhook(request: Request):
    payload = await request.json()

    phone_number_id = extract_meta_phone_number_id(payload)

    org_settings = None

    if phone_number_id:
        org_settings = find_org_by_meta_phone_number_id(phone_number_id)

    org_id = org_settings["org_id"] if org_settings else "demo_agency"

    statuses = extract_meta_statuses(payload)

    if statuses:
        handled = []

        for status_item in statuses:
            provider_message_id = status_item.get("provider_message_id")
            status = (status_item.get("status") or "unknown").upper()

            notification = None
            notification_id = None

            if provider_message_id:
                notification = get_notification_by_provider_message_id(
                    provider_message_id=provider_message_id,
                )

            if notification:
                notification_id = str(notification["id"])

                update_notification_provider_status(
                    provider_message_id=provider_message_id,
                    provider_status=status,
                )

            event = create_notification_delivery_event(
                org_id=org_id,
                notification_id=notification_id,
                provider_message_id=provider_message_id,
                status=status,
                raw_payload=status_item.get("raw"),
                provider="meta",
            )

            handled.append({
                "provider_message_id": provider_message_id,
                "status": status,
                "notification_found": notification is not None,
                "event_id": str(event["id"]) if event else None,
            })

        return {
            "status": "ok",
            "type": "statuses",
            "handled": handled,
        }

    normalized_message = normalize_meta_payload(payload)

    result = await process_normalized_whatsapp_message(
        normalized_message=normalized_message,
        payload=payload,
        org_id=org_id,
    )

    media_items = extract_meta_media_items(payload)

    if media_items:
        store_inbound_meta_media(
            org_id=org_id,
            client_id=result["client_id"],
            dossier_id=result["dossier_id"],
            shipment_id=result.get("shipment_id"),
            media_items=media_items,
            raw_payload=payload,
            phone_number_id=phone_number_id,
        )

    return result
