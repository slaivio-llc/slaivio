from app.ai.repositories.ai_settings_repository import get_ai_settings
from app.ai.repositories.escalation_repository import log_escalation_event
from app.ai.services.escalation_rules import compute_escalation_score


def evaluate_escalation(
    org_id: str,
    client_phone: str,
    message: str,
    intent: str,
    confidence: float,
):
    settings = get_ai_settings(org_id)

    if not settings.get("auto_escalation_enabled", True):
        return {
            "should_escalate": False,
            "score": 0.0,
            "rules": [],
            "event": None,
        }

    threshold = float(settings.get("escalation_threshold") or 0.60)
    result = compute_escalation_score(
        message=message,
        intent=intent,
        confidence=confidence,
    )
    should_escalate = result["score"] >= threshold
    reason = "AUTO_ESCALATED" if should_escalate else "SAFE"

    event = log_escalation_event(
        org_id=org_id,
        client_phone=client_phone,
        message=message,
        intent=intent,
        escalation_score=result["score"],
        escalation_reason=reason,
        triggered_rules=result["rules"],
        decision="ESCALATE" if should_escalate else "CONTINUE",
    )

    return {
        "should_escalate": should_escalate,
        "score": result["score"],
        "rules": result["rules"],
        "event": event,
    }

