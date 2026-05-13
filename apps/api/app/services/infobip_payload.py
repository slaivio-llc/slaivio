from app.services.normalized_message import (
    NormalizedMessage,
)


def normalize_infobip_payload(
    payload: dict,
) -> NormalizedMessage:
    results = payload.get("results") or []

    if not results:
        raise ValueError("No results in Infobip payload")

    item = results[0]

    from_number = item.get("from")
    to_number = item.get("to")

    text_body = None

    message = item.get("message") or {}

    if message.get("type") == "TEXT":
        text_obj = message.get("text") or {}

        text_body = text_obj.get("body")

    provider_message_id = item.get("messageId")

    return NormalizedMessage(
        provider="infobip",
        provider_message_id=provider_message_id,
        from_phone=from_number,
        to_phone=to_number,
        text_body=text_body,
        message_type="text",
        raw_payload=payload,
    )
