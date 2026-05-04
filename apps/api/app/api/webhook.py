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
    get_organization,
    update_dossier_from_ai_fields,
    get_dossier_full,
    update_dossier_from_action,
    mark_dossier_confirmed,
)
from app.services.understanding_orchestrator import understand_message
from app.services.reply_generator import generate_reply
from app.services.business_action_engine import decide_business_action
from app.services.notification_engine import (
    should_queue_notification,
    build_notification_type,
)
from app.db.notification_repository import create_notification_outbox
from app.services.followup_engine import build_followup_for_business_action
from app.db.followup_repository import create_followup_task
from app.db.followup_repository import cancel_pending_followups_for_dossier
from app.db.message_repository import update_dossier_pricing
from app.services.pricing_orchestrator import handle_pricing_request
from app.db.message_repository import mark_dossier_confirmed
from app.services.intake_parser import parse_intake_message
from app.services.intake_service import (
    is_intake_in_progress,
    get_missing_intake_fields,
    build_human_intake_message,
)
from app.db.message_repository import update_dossier_intake_fields
from app.db.message_repository import mark_dossier_intake_complete

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

    if intent == "CONFIRMATION":
        updated_dossier = mark_dossier_confirmed(
            org_id="demo_agency",
            dossier_id=dossier_id,
        )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="CLIENT_CONFIRMED",
        payload={},
    )

    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=dossier_id,
    )

    cancelled_followups = cancel_pending_followups_for_dossier(
        org_id="demo_agency",
        dossier_id=dossier_id,
        reason="client_replied",
    )

    if cancelled_followups:
        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="FOLLOWUPS_CANCELLED_ON_REPLY",
            payload={
                "count": len(cancelled_followups),
                "followups": cancelled_followups,
            },
        )

    insert_raw_message(
        org_id="demo_agency",
        phone=normalized_message.from_phone,
        text_msg=normalized_message.text_body or "",
        payload=payload,
        client_id=client_id,
        dossier_id=dossier_id,
    )

    understanding = understand_message(normalized_message.text_body)
    intent = understanding["intent"]

    print("=== UNDERSTANDING ===")
    print(understanding)

    ai_fields = None

    if understanding.get("ai_result"):
        ai_fields = understanding["ai_result"].get("extracted_fields")

    updated_from_ai = None

    if ai_fields:
        updated_from_ai = update_dossier_from_ai_fields(
            org_id="demo_agency",
            dossier_id=dossier_id,
            fields=ai_fields,
        )

    if updated_from_ai:
        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="DOSSIER_UPDATED_FROM_AI",
            payload={
                "fields": ai_fields
            },
        )
    
    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=dossier_id,
    )

    pricing_result = None
    updated_pricing_dossier = None

    if intent == "PRICING_REQUEST":
        pricing_result = handle_pricing_request(
            org_id="demo_agency",
            text=normalized_message.text_body or "",
            dossier=dossier_full,
        )

        parsed = pricing_result.get("parsed") or {}
        result = pricing_result.get("result")

        updated_pricing_dossier = update_dossier_pricing(
            org_id="demo_agency",
            dossier_id=dossier_id,
            origin_country=parsed.get("origin_country"),
            destination_country=parsed.get("destination_country"),
            weight_kg=parsed.get("weight_kg"),
            quoted_total=result.get("total") if result else None,
            quoted_currency=result.get("currency") if result else None,
            pricing_status=pricing_result["pricing_status"],
        )

        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="PRICING_CALCULATED",
            payload={
                "pricing_status": pricing_result["pricing_status"],
                "parsed": parsed,
                "result": result,
            },
        )

        dossier_full = get_dossier_full(
            org_id="demo_agency",
            dossier_id=dossier_id,
        )

    confirmed_dossier = None

    if intent == "CONFIRMATION":
        confirmed_dossier = mark_dossier_confirmed(
            org_id="demo_agency",
            dossier_id=dossier_id,
        )

        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="CLIENT_CONFIRMED",
            payload={
                "validation_status": "CONFIRMED_BY_CLIENT",
                "intake_status": "PARTIAL",
            },
        )

        dossier_full = get_dossier_full(
            org_id="demo_agency",
            dossier_id=dossier_id,
        )

    updated_intake_dossier = None
    intake_fields = None

    if is_intake_in_progress(dossier_full) and intent != "CONFIRMATION":
        intake_fields = parse_intake_message(normalized_message.text_body or "")

        # garder seulement les champs trouvés
        clean_fields = {
            key: value
            for key, value in intake_fields.items()
            if value is not None
        }

        if clean_fields:
            updated_intake_dossier = update_dossier_intake_fields(
                org_id="demo_agency",
                dossier_id=dossier_id,
                fields=clean_fields,
            )

            create_dossier_event(
                org_id="demo_agency",
                dossier_id=dossier_id,
                event_type="INTAKE_FIELDS_UPDATED",
                payload={
                    "fields": clean_fields,
                },
            )

            dossier_full = get_dossier_full(
                org_id="demo_agency",
                dossier_id=dossier_id,
            )

    completed_intake_dossier = None

    if is_intake_in_progress(dossier_full):
        missing = get_missing_intake_fields(dossier_full)

        if not missing:
            completed_intake_dossier = mark_dossier_intake_complete(
                org_id="demo_agency",
                dossier_id=dossier_id,
            )

            create_dossier_event(
                org_id="demo_agency",
                dossier_id=dossier_id,
                event_type="INTAKE_COMPLETED",
                payload={
                    "status": "COMPLETE",
                },
            )

            dossier_full = get_dossier_full(
                org_id="demo_agency",
                dossier_id=dossier_id,
            )

    business_action = decide_business_action(
        intent=intent,
        dossier=dossier_full,
    )
    
    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="BUSINESS_ACTION_DECIDED",
        payload=business_action,
    )

    updated_status = update_dossier_from_action(
        org_id="demo_agency",
        dossier_id=dossier_id,
        action=business_action,
    )

    followup = build_followup_for_business_action(
        org_name=org_name,
        business_action=business_action,
        dossier=dossier_full,
    )

    created_followup = None

    if followup:
        created_followup = create_followup_task(
            org_id="demo_agency",
            client_id=client_id,
            dossier_id=dossier_id,
            followup_type=followup["followup_type"],
            message=followup["message"],
            due_minutes=followup["due_minutes"],
        )

        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="FOLLOWUP_CREATED",
            payload={
                "followup_id": str(created_followup["id"]),
                "followup_type": created_followup["followup_type"],
                "due_at": str(created_followup["due_at"]),
                "already_exists": created_followup.get("already_exists", False),
            },
        )

    if updated_status: create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="DOSSIER_STATUS_UPDATED",
        payload={
            "action_type": business_action["action_type"],
            "intake_status": updated_status.get("intake_status"),
            "validation_status": updated_status.get("validation_status"),
        },
    )

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

    org = get_organization("demo_agency")
    org_name = org["name"] if org else "Notre agence"
    
    reply = generate_reply(
        intent=intent,
        org_name=org_name,
        understanding=understanding,
        dossier=dossier_full,
        text=normalized_message.text_body,
    )

    queued_notification = None

    if should_queue_notification(business_action, reply):
        queued_notification = create_notification_outbox(
            org_id="demo_agency",
            client_id=client_id,
            dossier_id=dossier_id,
            recipient_phone=normalized_message.from_phone,
            notification_type=build_notification_type(intent, business_action),
            message=reply["message"],
        )

        create_dossier_event(
            org_id="demo_agency",
            dossier_id=dossier_id,
            event_type="NOTIFICATION_QUEUED",
            payload={
                "notification_id": str(queued_notification["id"]),
                "notification_status": queued_notification["status"],
                "notification_type": build_notification_type(intent, business_action),
            },
        )

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
            "source": understanding["source"],
            "confidence": understanding["confidence"],
            "ai_result": understanding["ai_result"],
        },
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="UNDERSTANDING_COMPLETED",
        payload=understanding,
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
    "understanding": understanding,
    "updated_dossier": updated_dossier,
    "business_action": business_action,
    "queued_notification": queued_notification,
    "cancelled_followups": cancelled_followups,
    "created_followup": created_followup,
    "pricing_result": pricing_result,
    "confirmed_dossier": confirmed_dossier,
    "completed_intake_dossier": completed_intake_dossier,
    "intake_fields": intake_fields,
    "updated_intake_dossier": updated_intake_dossier,
    "updated_pricing_dossier": updated_pricing_dossier,
    "reply": reply,
    "normalized_message": normalized_message.model_dump(mode="json"),
}