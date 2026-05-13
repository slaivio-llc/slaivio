from app.services.knowledge_service import (
    find_best_knowledge_answer,
    build_knowledge_reply,
)


KNOWLEDGE_RELATED_INTENTS = {
    "WAREHOUSE_ADDRESS_REQUEST",
    "DEPARTURE_SCHEDULE_REQUEST",
    "UNKNOWN",
}


def should_route_to_knowledge(
    intent: str,
    understanding: dict | None,
) -> bool:
    if intent in KNOWLEDGE_RELATED_INTENTS:
        return True

    if not understanding:
        return False

    ai_result = understanding.get("ai_result") or {}

    if ai_result.get("should_escalate"):
        return False

    reason = (ai_result.get("reason") or "").lower()

    knowledge_signals = [
        "agency",
        "service",
        "address",
        "office",
        "warehouse",
        "schedule",
        "delay",
        "delivery",
        "coverage",
        "condition",
        "rule",
        "information",
        "question",
    ]

    return any(signal in reason for signal in knowledge_signals)


def route_knowledge_answer(
    org_id: str,
    org_name: str,
    intent: str,
    text: str | None,
    understanding: dict | None = None,
) -> dict:
    if not text or not text.strip():
        return {
            "found": False,
            "reply": None,
            "knowledge": None,
            "reason": "empty_text",
        }

    if not should_route_to_knowledge(
        intent=intent,
        understanding=understanding,
    ):
        return {
            "found": False,
            "reply": None,
            "knowledge": None,
            "reason": "not_knowledge_related",
        }

    knowledge = find_best_knowledge_answer(
        org_id=org_id,
        text=text,
    )

    if not knowledge.get("found"):
        return {
            "found": False,
            "reply": {
                "reply_type": "KNOWLEDGE_NOT_FOUND",
                "should_escalate": True,
                "message": (
                    f"Merci d’avoir contacté {org_name}.\n\n"
                    "Je dois vérifier cette information avec l’équipe afin de vous répondre correctement."
                ),
            },
            "knowledge": knowledge,
            "reason": "knowledge_not_found",
        }

    reply_message = build_knowledge_reply(
        org_name=org_name,
        answer=knowledge["answer"],
    )

    return {
        "found": True,
        "reply": {
            "reply_type": "AI_KNOWLEDGE_RESPONSE",
            "should_escalate": False,
            "message": reply_message,
        },
        "knowledge": knowledge,
        "reason": "knowledge_found",
    }
