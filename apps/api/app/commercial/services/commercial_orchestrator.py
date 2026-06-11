from app.commercial.engines.intent_engine import (
    detect_commercial_intent,
    extract_commercial_fields,
)
from app.commercial.services.procurement_service import create_procurement_flow
from app.commercial.services.quote_service import create_quote_flow
from app.commercial.services.restriction_service import create_restriction_flow


def handle_commercial_message(
    org_id: str,
    phone: str,
    message: str,
    source_channel: str = "whatsapp",
):
    intent = detect_commercial_intent(message)
    fields = extract_commercial_fields(message)
    fields["phone"] = phone

    if intent == "PROCUREMENT_REQUEST":
        fields["product_description"] = fields.get("goods_description") or message[:180]
        return {
            "intent": intent,
            **create_procurement_flow(
                org_id=org_id,
                fields=fields,
                source_channel=source_channel,
                last_customer_message=message,
            ),
        }

    if intent == "RESTRICTION_CHECK":
        return {
            "intent": intent,
            **create_restriction_flow(
                org_id=org_id,
                fields=fields,
                source_channel=source_channel,
                last_customer_message=message,
            ),
        }

    return {
        "intent": intent,
        **create_quote_flow(
            org_id=org_id,
            fields=fields,
            source_channel=source_channel,
            last_customer_message=message,
        ),
    }
