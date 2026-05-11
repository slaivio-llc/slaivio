from app.services.intent_detector import detect_intent
from app.services.ai_understanding import (
    understand_message_with_ai,
)


HIGH_CONFIDENCE_RULE_INTENTS = {
    "GREETING",
    "TRACKING_REQUEST",
    "HUMAN_HELP_REQUEST",
    "CONFIRMATION",
}


def understand_message(text: str | None):
    text = (text or "").strip()

    rule_intent = detect_intent(text)

    ai_result = understand_message_with_ai(text)

    if not ai_result:
        return {
            "source": "rules",
            "intent": rule_intent,
            "confidence": 1.0 if rule_intent != "UNKNOWN" else 0.0,
            "ai_result": None,
        }

    ai_intent = ai_result.get("intent", "UNKNOWN")
    ai_confidence = ai_result.get("confidence", 0.0)

    final_intent = ai_intent
    source = "mistral"

    # règles prioritaires fortes
    if rule_intent in HIGH_CONFIDENCE_RULE_INTENTS:
        final_intent = rule_intent
        source = "rules"

    # fallback rules si AI inconnue
    elif ai_intent == "UNKNOWN" and rule_intent != "UNKNOWN":
        final_intent = rule_intent
        source = "rules_fallback"

    # fallback AI faible
    elif ai_confidence < 0.45 and rule_intent != "UNKNOWN":
        final_intent = rule_intent
        source = "rules_low_confidence_override"

    return {
        "source": source,
        "intent": final_intent,
        "confidence": ai_confidence,
        "rule_intent": rule_intent,
        "ai_result": ai_result,
    }
