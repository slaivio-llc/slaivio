def detect_infobip_media_type(message: dict) -> str:
    message_type = (message.get("type") or "").upper()

    if message_type == "IMAGE":
        return "PHOTO"

    if message_type == "VIDEO":
        return "VIDEO"

    if message_type == "AUDIO":
        return "VOICE_NOTE"

    if message_type == "DOCUMENT":
        return "DOCUMENT"

    return "PHOTO"


def extract_infobip_media_items(payload: dict) -> list[dict]:
    results = payload.get("results") or []
    items = []

    for item in results:
        message = item.get("message") or {}
        message_type = (message.get("type") or "").upper()

        if message_type not in {"IMAGE", "VIDEO", "AUDIO", "DOCUMENT"}:
            continue

        content = (
            message.get("image")
            or message.get("video")
            or message.get("audio")
            or message.get("document")
            or {}
        )

        media_url = (
            content.get("url")
            or content.get("mediaUrl")
            or content.get("fileUrl")
        )

        if not media_url:
            continue

        items.append({
            "media_url": media_url,
            "media_type": detect_infobip_media_type(message),
            "content_type": content.get("mimeType") or content.get("contentType"),
            "caption": content.get("caption") or content.get("filename"),
            "provider_message_id": item.get("messageId"),
            "raw": item,
        })

    return items
