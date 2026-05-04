def should_queue_notification(business_action: dict, reply: dict) -> bool:
    if not reply:
        return False

    if not reply.get("message"):
        return False

    action_type = business_action.get("action_type") if business_action else None

    # Pour l’instant, on prépare une réponse pour toutes les actions client-facing.
    # On évite seulement les cas où aucune réponse n’est utile.
    if action_type in [
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
    ]:
        return True

    return True


def build_notification_type(intent: str, business_action: dict) -> str:
    action_type = business_action.get("action_type") if business_action else "UNKNOWN_ACTION"

    return f"{intent}:{action_type}"