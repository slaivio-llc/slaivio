from mistralai.client import Mistral

from app.core.config import settings


def transcribe_audio_file(file_path: str) -> dict:
    if not settings.mistral_api_key:
        raise ValueError("MISTRAL_API_KEY is missing")

    client = Mistral(
        api_key=settings.mistral_api_key,
    )

    with open(file_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="voxtral-mini-latest",
            file=audio_file,
        )

    result = response.model_dump() if hasattr(response, "model_dump") else dict(response)

    text = (
        result.get("text")
        or result.get("transcript")
        or ""
    )

    return {
        "text": text,
        "language": result.get("language"),
        "confidence": result.get("confidence"),
        "raw": result,
    }
