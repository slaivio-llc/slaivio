from app.commercial.resolvers.configuration_resolvers import (
    resolve_goods_rule,
)


def check_goods_restriction(
    org_id: str,
    goods_description: str | None,
    goods_category: str | None = None,
    shipping_service_id: str | None = None,
):
    rule = resolve_goods_rule(
        org_id=org_id,
        goods_description=goods_description,
        goods_category=goods_category,
        shipping_service_id=shipping_service_id,
    )

    if not rule:
        return {
            "decision": "MANUAL_REVIEW",
            "handling_instructions": "Aucune regle configuree. Verification commerciale requise.",
            "required_documents": [],
            "required_declarations": [],
            "escalation_required": True,
            "raw_rule": None,
        }

    return {
        "decision": rule["decision"],
        "handling_instructions": rule.get("handling_instructions"),
        "required_documents": rule.get("required_documents") or [],
        "required_declarations": rule.get("required_declarations") or [],
        "escalation_required": rule["decision"] in [
            "MANUAL_REVIEW",
            "RESTRICTED",
            "PROHIBITED",
        ],
        "raw_rule": rule,
    }
