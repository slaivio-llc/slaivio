def detect_meta_media_type(message: dict) -> str:
    message_type = (message.get("type") or "").lower()

    if message_type == "image":
        return "PHOTO"

    if message_type == "video":
        return "VIDEO"

    if message_type == "audio":
        return "VOICE_NOTE"

    if message_type == "document":
        return "DOCUMENT"

    return "PHOTO"


def extract_meta_media_items(payload: dict) -> list[dict]:
    entries = payload.get("entry") or []

    items = []

    for entry in entries:
        changes = entry.get("changes") or []

        for change in changes:
            value = change.get("value") or {}
            messages = value.get("messages") or []

            for message in messages:
                message_type = (message.get("type") or "").lower()

                if message_type not in {
                    "image",
                    "video",
                    "audio",
                    "document",
                }:
                    continue

                content = message.get(message_type) or {}

                media_id = content.get("id")

                if not media_id:
                    continue

                items.append({
                    "provider": "meta",
                    "provider_message_id": message.get("id"),
                    "provider_media_id": media_id,
                    "media_type": detect_meta_media_type(message),
                    "content_type": content.get("mime_type"),
                    "caption": content.get("caption") or content.get("filename"),
                    "sha256": content.get("sha256"),
                    "raw": message,
                })

    return items
