from app.ai.repositories.response_decision_repository import (
    log_response_decision,
)
from app.ai.services.ai_pipeline import run_ai_pipeline
from app.ai.services.escalation_engine import evaluate_escalation
from app.ai.services.intent_detector import detect_intent
from app.ai.services.missing_info_response import build_missing_info_response
from app.ai.services.response_rules import decide_response_action


def orchestrate_ai_response(
    org_id: str,
    client_phone: str,
    user_message: str,
):
    intent_result = detect_intent(
        org_id=org_id,
        message=user_message,
    )
    intent = intent_result["intent"]
    confidence = intent_result["confidence"]
    entities = intent_result["entities"]

    escalation_result = evaluate_escalation(
        org_id=org_id,
        client_phone=client_phone,
        message=user_message,
        intent=intent,
        confidence=confidence,
    )

    if escalation_result["should_escalate"]:
        decision = "ESCALATE"
        reason = "AI escalation engine"
        response_text = (
            "Merci. Votre demande a été transférée à un responsable."
        )
    else:
        decision_result = decide_response_action(
            intent=intent,
            confidence=confidence,
            entities=entities,
        )
        decision = decision_result["decision"]
        reason = decision_result["reason"]
        response_text = None

        if decision == "ASK_MORE_INFO":
            response_text = build_missing_info_response(
                decision_result["missing_fields"]
            )
        elif decision in {"AUTO_REPLY", "DRAFT_ONLY"}:
            ai_result = run_ai_pipeline(
                org_id=org_id,
                client_phone=client_phone,
                user_message=user_message,
                intent_result=intent_result,
            )
            response_text = ai_result.get("content")
        elif decision == "ESCALATE":
            response_text = (
                "Merci pour votre message. "
                "Un membre de notre équipe va vous assister."
            )

    log = log_response_decision(
        org_id=org_id,
        client_phone=client_phone,
        message=user_message,
        intent=intent,
        confidence=confidence,
        decision=decision,
        reason=reason,
        response_text=response_text,
        entities=entities,
    )

    return {
        "status": "ok",
        "intent": intent_result,
        "escalation": escalation_result,
        "decision": decision,
        "reason": reason,
        "response_text": response_text,
        "log": log,
    }

