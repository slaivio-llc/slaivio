from datetime import datetime, timezone

from app.models.message import NormalizedMessage


def normalize_infobip_payload(payload: dict) -> NormalizedMessage:
    results = payload.get("results") or []

    if not results:
        raise ValueError("No results in Infobip payload")

    item = results[0]

    message = item.get("message") or {}

    text_body = ""

    if (message.get("type") or "").upper() == "TEXT":
        text_obj = message.get("text") or {}
        text_body = text_obj.get("body") or ""

    provider_message_id = item.get("messageId")

    from_phone = item.get("from") or "unknown"
    to_phone = item.get("to")

    return NormalizedMessage(
        provider_message_id=provider_message_id,
        from_phone=from_phone,
        to_phone=to_phone,
        text_body=text_body,
        message_type="text",
        received_at=datetime.now(timezone.utc),
        source_channel="whatsapp",
        dedupe_key=provider_message_id or f"infobip:{from_phone}:{text_body}",
    )
