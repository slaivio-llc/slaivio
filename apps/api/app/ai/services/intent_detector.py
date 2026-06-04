import json
import re

from app.ai.prompts.intent_prompt import INTENT_SYSTEM_PROMPT
from app.ai.providers.provider_factory import get_provider
from app.ai.repositories.ai_settings_repository import get_ai_settings


def _extract_json(text_value: str):
    try:
        return json.loads(text_value)
    except Exception:
        pass

    match = re.search(
        r"\{.*\}",
        text_value,
        re.DOTALL,
    )

    if not match:
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "entities": {},
        }

    try:
        return json.loads(match.group(0))
    except Exception:
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "entities": {},
        }


def detect_intent(
    org_id: str,
    message: str,
):
    settings = get_ai_settings(org_id)
    provider = get_provider(settings["provider"])
    messages = [
        {
            "role": "system",
            "content": INTENT_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    result = provider.generate(
        messages=messages,
        model_name=settings["model_name"],
        temperature=0.0,
        max_tokens=300,
    )

    if not result.get("success"):
        return {
            "intent": "UNKNOWN",
            "confidence": 0.0,
            "entities": {},
            "raw_response": result,
        }

    parsed = _extract_json(result.get("content") or "")

    return {
        "intent": parsed.get("intent", "UNKNOWN"),
        "confidence": float(parsed.get("confidence", 0.0)),
        "entities": parsed.get("entities", {}),
        "raw_response": result,
    }

