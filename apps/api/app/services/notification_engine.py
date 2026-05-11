CLIENT_FACING_ACTIONS = {
    "WAIT_FOR_CUSTOMER_NEED",
    "ASK_CLARIFICATION",
    "CONTINUE_SHIPPING_INTAKE",
    "CONTINUE_TRANSITAIRE_INTAKE",
    "CHECK_PRICING_REQUIREMENTS",
    "REQUIRE_TRACKING_ID",
    "CONTINUE_SUPPLIER_PAYMENT_INTAKE",
    "READY_FOR_SHIPPING_REVIEW",
    "READY_FOR_TRANSITAIRE_REVIEW",
    "READY_FOR_PRICING_LOOKUP",
    "NEEDS_AGENCY_KNOWLEDGE",
    "ESCALATE_TO_HUMAN",
}


def should_queue_notification(
    business_action: dict | None,
    reply: dict | None,
) -> bool:
    if not reply:
        return False

    message = reply.get("message")

    if not message:
        return False

    if not isinstance(message, str):
        return False

    if not message.strip():
        return False

    if not business_action:
        return True

    action_type = business_action.get("action_type")

    # v1:
    # toutes les réponses client-facing
    # créent une notification

    if action_type in CLIENT_FACING_ACTIONS:
        return True

    # fallback sécurité
    return True


def build_notification_type(
    intent: str,
    business_action: dict | None,
) -> str:
    action_type = "UNKNOWN_ACTION"

    if business_action:
        action_type = (
            business_action.get("action_type")
            or "UNKNOWN_ACTION"
        )

    safe_intent = intent or "UNKNOWN"

    return f"{safe_intent}:{action_type}"
