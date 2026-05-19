from datetime import datetime, timezone

from app.models.message import NormalizedMessage


def extract_meta_value(payload: dict) -> dict | None:
    entries = payload.get("entry") or []

    if not entries:
        return None

    changes = entries[0].get("changes") or []

    if not changes:
        return None

    return changes[0].get("value") or {}


def normalize_meta_payload(payload: dict) -> NormalizedMessage:
    value = extract_meta_value(payload)

    if not value:
        raise ValueError("No value in Meta payload")

    messages = value.get("messages") or []

    if not messages:
        raise ValueError("No messages in Meta payload")

    message = messages[0]

    contacts = value.get("contacts") or []
    metadata = value.get("metadata") or {}

    from_phone = message.get("from")
    to_phone = metadata.get("display_phone_number")
    phone_number_id = metadata.get("phone_number_id")

    message_id = message.get("id")
    message_type = message.get("type") or "text"

    text_body = ""

    if message_type == "text":
        text_body = (message.get("text") or {}).get("body") or ""

    return NormalizedMessage(
        provider_message_id=message_id,
        from_phone=from_phone,
        to_phone=to_phone,
        text_body=text_body,
        message_type=message_type,
        received_at=datetime.now(timezone.utc),
        source_channel="whatsapp",
        dedupe_key=message_id or f"meta:{from_phone}:{text_body}",
    )


def extract_meta_statuses(payload: dict) -> list[dict]:
    value = extract_meta_value(payload)

    if not value:
        return []

    statuses = value.get("statuses") or []

    parsed = []

    for item in statuses:
        parsed.append({
            "provider": "meta",
            "provider_message_id": item.get("id"),
            "recipient_id": item.get("recipient_id"),
            "status": item.get("status"),
            "timestamp": item.get("timestamp"),
            "raw": item,
        })

    return parsed


def extract_meta_phone_number_id(payload: dict) -> str | None:
    value = extract_meta_value(payload)

    if not value:
        return None

    metadata = value.get("metadata") or {}

    return metadata.get("phone_number_id")
