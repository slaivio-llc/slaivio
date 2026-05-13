from app.db.escalation_repository import (
    create_escalation_case,
    create_escalation_event,
)


HIGH_RISK_SIGNALS = [
    "perdu",
    "volé",
    "vole",
    "remboursement",
    "rembourser",
    "arnaque",
    "plainte",
    "police",
    "tribunal",
    "bloqué depuis",
    "bloque depuis",
    "trop de retard",
    "je suis fâché",
    "je suis faché",
    "je suis énervé",
    "je suis enerve",
]


def detect_escalation_priority(
    text: str | None,
    reply: dict | None = None,
) -> str:
    normalized = (text or "").lower()

    if any(signal in normalized for signal in HIGH_RISK_SIGNALS):
        return "HIGH"

    if reply and reply.get("should_escalate"):
        return "NORMAL"

    return "LOW"


def should_create_escalation(
    reply: dict | None,
    business_action: dict | None = None,
    understanding: dict | None = None,
) -> bool:
    if reply and reply.get("should_escalate"):
        return True

    if business_action and business_action.get("action_type") == "ESCALATE_TO_HUMAN":
        return True

    ai_result = understanding.get("ai_result") if understanding else None

    if ai_result and ai_result.get("should_escalate"):
        return True

    return False


def build_escalation_reason(
    reply: dict | None,
    business_action: dict | None = None,
    understanding: dict | None = None,
) -> str:
    if reply and reply.get("reply_type"):
        return f"reply_requires_escalation:{reply['reply_type']}"

    if business_action and business_action.get("action_type"):
        return f"business_action:{business_action['action_type']}"

    ai_result = understanding.get("ai_result") if understanding else None

    if ai_result and ai_result.get("reason"):
        return f"ai_escalation:{ai_result['reason']}"

    return "manual_review_required"


def create_escalation_from_context(
    org_id: str,
    client_id: str | None,
    dossier_id: str | None,
    shipment_id: str | None,
    text: str | None,
    reply: dict | None,
    business_action: dict | None = None,
    understanding: dict | None = None,
):
    priority = detect_escalation_priority(
        text=text,
        reply=reply,
    )

    reason = build_escalation_reason(
        reply=reply,
        business_action=business_action,
        understanding=understanding,
    )

    escalation = create_escalation_case(
        org_id=org_id,
        client_id=client_id,
        dossier_id=dossier_id,
        shipment_id=shipment_id,
        reason=reason,
        priority=priority,
        customer_message=text,
        internal_note=reply.get("message") if reply else None,
    )

    if escalation:
        create_escalation_event(
            org_id=org_id,
            escalation_id=str(escalation["id"]),
            event_type="ESCALATION_CREATED",
            payload={
                "reason": reason,
                "priority": priority,
                "reply_type": reply.get("reply_type") if reply else None,
                "business_action": business_action,
            },
        )

    return escalation
