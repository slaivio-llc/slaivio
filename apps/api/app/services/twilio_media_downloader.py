import tempfile
import requests

from app.core.config import settings


def guess_audio_suffix(content_type: str | None) -> str:
    value = (content_type or "").lower()

    if "ogg" in value:
        return ".ogg"

    if "mpeg" in value or "mp3" in value:
        return ".mp3"

    if "wav" in value:
        return ".wav"

    if "mp4" in value:
        return ".mp4"

    return ".audio"


def download_twilio_media_to_tempfile(
    media_url: str,
    content_type: str | None = None,
) -> str:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise ValueError("Twilio credentials are missing")

    response = requests.get(
        media_url,
        auth=(
            settings.twilio_account_sid,
            settings.twilio_auth_token,
        ),
        timeout=30,
    )

    response.raise_for_status()

    suffix = guess_audio_suffix(content_type)

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix,
    ) as temp_file:
        temp_file.write(response.content)
        return temp_file.name
