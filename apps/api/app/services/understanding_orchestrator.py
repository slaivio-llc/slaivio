from app.services.intent_detector import detect_intent
from app.services.ai_understanding import understand_message_with_ai


def understand_message(text: str | None, force_ai: bool = False) -> dict:
    rule_intent = detect_intent(text)

    if rule_intent != "UNKNOWN" and not force_ai:
        return {
            "source": "rules",
            "intent": rule_intent,
            "confidence": 1.0,
            "ai_result": None,
        }

    ai_result = understand_message_with_ai(text or "")

    return {
        "source": "mistral",
        "intent": ai_result["intent"],
        "confidence": ai_result["confidence"],
        "ai_result": ai_result,
    }