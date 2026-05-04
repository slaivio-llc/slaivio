from app.services.intent_detector import detect_intent
from app.services.ai_understanding import understand_message_with_ai


def understand_message(text: str | None):
    text = text or ""

    rule_intent = detect_intent(text)

    ai_result = understand_message_with_ai(text)

    if ai_result:
        intent = ai_result.get("intent") or rule_intent

        if rule_intent != "UNKNOWN":
            intent = rule_intent

        return {
            "source": "rules+mistral" if rule_intent != "UNKNOWN" else "mistral",
            "intent": intent,
            "confidence": ai_result.get("confidence", 0.8),
            "ai_result": ai_result,
        }

    return {
        "source": "rules",
        "intent": rule_intent,
        "confidence": 1.0,
        "ai_result": None,
    }