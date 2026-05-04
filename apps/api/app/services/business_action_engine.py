def _has_value(value) -> bool:
    return value is not None and value != ""


def _shipping_missing_fields(dossier: dict | None) -> list[str]:
    if not dossier:
        return [
            "origin",
            "destination",
            "goods_type",
            "weight_or_volume",
        ]

    missing = []

    origin = dossier.get("origin_country") or dossier.get("origin_city")
    destination = dossier.get("destination_country") or dossier.get("destination_city")
    goods_type = dossier.get("goods_type")
    weight = dossier.get("estimated_weight_kg")
    volume = dossier.get("estimated_volume_cbm")

    if not _has_value(origin):
        missing.append("origin")

    if not _has_value(destination):
        missing.append("destination")

    if not _has_value(goods_type):
        missing.append("goods_type")

    if not _has_value(weight) and not _has_value(volume):
        missing.append("weight_or_volume")

    return missing


def decide_business_action(intent: str, dossier: dict | None) -> dict:
    if intent == "SEND_CARGO_REQUEST":
        missing = _shipping_missing_fields(dossier)

        if missing:
            return {
                "action_type": "CONTINUE_SHIPPING_INTAKE",
                "ready_for_manager_review": False,
                "missing_fields": missing,
                "reason": "Shipping request needs more information.",
            }

        return {
            "action_type": "READY_FOR_SHIPPING_REVIEW",
            "ready_for_manager_review": True,
            "missing_fields": [],
            "reason": "Shipping intake has minimum required fields.",
        }

    if intent == "TRANSITAIRE_REQUEST":
        missing = _shipping_missing_fields(dossier)

        if missing:
            return {
                "action_type": "CONTINUE_TRANSITAIRE_INTAKE",
                "ready_for_manager_review": False,
                "missing_fields": missing,
                "reason": "Transitaire request needs more information.",
            }

        return {
            "action_type": "READY_FOR_TRANSITAIRE_REVIEW",
            "ready_for_manager_review": True,
            "missing_fields": [],
            "reason": "Transitaire intake has minimum required fields.",
        }

    if intent == "PRICE_REQUEST":
        missing = _shipping_missing_fields(dossier)

        if missing:
            return {
                "action_type": "CHECK_PRICING_REQUIREMENTS",
                "ready_for_manager_review": False,
                "missing_fields": missing,
                "reason": "Pricing needs route, goods, and quantity information.",
            }

        return {
            "action_type": "READY_FOR_PRICING_LOOKUP",
            "ready_for_manager_review": False,
            "missing_fields": [],
            "reason": "Enough information exists to look up pricing rules later.",
        }

    if intent == "TRACKING_REQUEST":
        tracking_id = dossier.get("tracking_id") if dossier else None

        if not tracking_id:
            return {
                "action_type": "REQUIRE_TRACKING_ID",
                "ready_for_manager_review": False,
                "missing_fields": ["tracking_id"],
                "reason": "Tracking request requires tracking ID.",
            }

        return {
            "action_type": "READY_FOR_TRACKING_LOOKUP",
            "ready_for_manager_review": False,
            "missing_fields": [],
            "reason": "Tracking ID is available.",
        }

    if intent == "SUPPLIER_PAYMENT_REQUEST":
        amount = dossier.get("supplier_payment_amount") if dossier else None
        currency = dossier.get("supplier_payment_currency") if dossier else None

        missing = []
        if not _has_value(amount):
            missing.append("supplier_payment_amount")
        if not _has_value(currency):
            missing.append("supplier_payment_currency")

        if missing:
            return {
                "action_type": "CONTINUE_SUPPLIER_PAYMENT_INTAKE",
                "ready_for_manager_review": False,
                "missing_fields": missing,
                "reason": "Supplier payment request needs amount and currency.",
            }

        return {
            "action_type": "READY_FOR_SUPPLIER_PAYMENT_REVIEW",
            "ready_for_manager_review": True,
            "missing_fields": [],
            "reason": "Supplier payment request has minimum required fields.",
        }

    if intent in ["WAREHOUSE_ADDRESS_REQUEST", "DEPARTURE_SCHEDULE_REQUEST"]:
        return {
            "action_type": "NEEDS_AGENCY_KNOWLEDGE",
            "ready_for_manager_review": False,
            "missing_fields": [],
            "reason": "Answer depends on agency configuration/knowledge base.",
        }

    if intent == "HUMAN_HELP_REQUEST":
        return {
            "action_type": "ESCALATE_TO_HUMAN",
            "ready_for_manager_review": True,
            "missing_fields": [],
            "reason": "Customer requested human assistance.",
        }

    if intent == "GREETING":
        return {
            "action_type": "WAIT_FOR_CUSTOMER_NEED",
            "ready_for_manager_review": False,
            "missing_fields": [],
            "reason": "Greeting only; wait for customer request.",
        }

    return {
        "action_type": "ASK_CLARIFICATION",
        "ready_for_manager_review": False,
        "missing_fields": [],
        "reason": "Intent is unknown or not actionable.",
    }