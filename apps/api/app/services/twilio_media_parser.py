def is_audio_content_type(content_type: str | None) -> bool:
    value = (content_type or "").lower()

    return (
        value.startswith("audio/")
        or "ogg" in value
        or "opus" in value
    )


def detect_media_type(content_type: str | None) -> str:
    value = (content_type or "").lower()

    if is_audio_content_type(value):
        return "VOICE_NOTE"

    if value.startswith("image/"):
        return "PHOTO"

    if value.startswith("video/"):
        return "VIDEO"

    if value in {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        return "ARRIVAL_PROOF"

    return "PHOTO"


def extract_twilio_media_items(form: dict) -> list[dict]:
    try:
        num_media = int(form.get("NumMedia") or 0)
    except (TypeError, ValueError):
        num_media = 0

    items = []

    for index in range(num_media):
        media_url = form.get(f"MediaUrl{index}")
        content_type = form.get(f"MediaContentType{index}")

        if not media_url:
            continue

        items.append({
            "index": index,
            "media_url": media_url,
            "content_type": content_type,
            "media_type": detect_media_type(content_type),
            "is_audio": is_audio_content_type(content_type),
        })

    return items
