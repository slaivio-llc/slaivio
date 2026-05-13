from datetime import datetime, timezone

from app.models.message import NormalizedMessage


def strip_whatsapp_prefix(value: str | None) -> str | None:
    if not value:
        return value

    if value.startswith("whatsapp:"):
        return value.replace("whatsapp:", "", 1)

    return value


def normalize_twilio_whatsapp_form(form: dict) -> NormalizedMessage:
    from_phone = strip_whatsapp_prefix(form.get("From")) or "unknown"
    to_phone = strip_whatsapp_prefix(form.get("To"))
    text_body = form.get("Body") or ""
    provider_message_id = form.get("MessageSid") or form.get("SmsMessageSid")

    dedupe_key = provider_message_id or f"twilio:whatsapp:{from_phone}:{text_body}"

    return NormalizedMessage(
        provider_message_id=provider_message_id,
        from_phone=from_phone,
        to_phone=to_phone,
        text_body=text_body,
        message_type="text",
        received_at=datetime.now(timezone.utc),
        source_channel="whatsapp",
        dedupe_key=dedupe_key,
    )


def twilio_form_to_payload(form: dict) -> dict:
    return {
        "provider": "twilio",
        "provider_message_id": form.get("MessageSid") or form.get("SmsMessageSid"),
        "from": strip_whatsapp_prefix(form.get("From")),
        "to": strip_whatsapp_prefix(form.get("To")),
        "text": form.get("Body") or "",
        "num_media": form.get("NumMedia"),
        "raw": dict(form),
    }
