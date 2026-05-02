import json
from mistralai.client import Mistral

from app.core.config import settings


client = Mistral(api_key=settings.mistral_api_key) if settings.mistral_api_key else None


ALLOWED_INTENTS = {
    "GREETING",
    "SEND_CARGO_REQUEST",
    "TRANSITAIRE_REQUEST",
    "PRICE_REQUEST",
    "TRACKING_REQUEST",
    "WAREHOUSE_ADDRESS_REQUEST",
    "DEPARTURE_SCHEDULE_REQUEST",
    "HUMAN_HELP_REQUEST",
    "SUPPLIER_PAYMENT_REQUEST",
    "UNKNOWN",
}

DEFAULT_EXTRACTED_FIELDS = {
    "origin_country": None,
    "origin_city": None,
    "destination_country": None,
    "destination_city": None,
    "goods_type": None,
    "estimated_weight_kg": None,
    "estimated_volume_cbm": None,
    "tracking_id": None,
    "shipping_mode": None,
    "supplier_mentioned": False,
    "supplier_payment_amount": None,
    "supplier_payment_currency": None,
}


SYSTEM_PROMPT = """
You are SLAIVO Understanding Engine.

You do NOT reply to the customer.
You only classify the customer message and extract information.

Return ONLY valid JSON with this exact shape:
{
  "intent": "GREETING | SEND_CARGO_REQUEST | TRANSITAIRE_REQUEST | PRICE_REQUEST | TRACKING_REQUEST | WAREHOUSE_ADDRESS_REQUEST | DEPARTURE_SCHEDULE_REQUEST | HUMAN_HELP_REQUEST | SUPPLIER_PAYMENT_REQUEST | UNKNOWN",
  "confidence": 0.0,
  "language": "FR | EN | UNKNOWN",
  "extracted_fields": {
    "origin_country": null,
    "origin_city": null,
    "destination_country": null,
    "destination_city": null,
    "goods_type": null,
    "estimated_weight_kg": null,
    "estimated_volume_cbm": null,
    "tracking_id": null,
    "shipping_mode": null,
    "supplier_mentioned": false,
    "supplier_payment_amount": null,
    "supplier_payment_currency": null
  },
  "missing_fields": [],
  "should_escalate": false,
  "reason": ""
}

Rules:
- Never invent price, address, schedule, shipment status, discount, payment condition, or exchange rate.
- Extract only information explicitly present in the message.
- If message is only greeting, intent = GREETING.
- If customer wants to send or ship cargo, intent = SEND_CARGO_REQUEST.
- If customer wants to buy/import through supplier/China and use agency as forwarder, intent = TRANSITAIRE_REQUEST.
- If customer asks cost/how much/tariff, intent = PRICE_REQUEST.
- If customer asks where the package is, intent = TRACKING_REQUEST.
- If customer asks agency office or warehouse location, intent = WAREHOUSE_ADDRESS_REQUEST.
- If customer asks departure/flight/boat schedule, intent = DEPARTURE_SCHEDULE_REQUEST.
- If customer wants to pay supplier via WeChat/Alipay/RMB, intent = SUPPLIER_PAYMENT_REQUEST.
- If unsure, return UNKNOWN.
- Escalate only if message is angry, risky, sensitive, impossible to understand, or requires human judgment.
"""


def default_unknown_result(reason: str = "Mistral disabled or unavailable") -> dict:
    return {
        "intent": "UNKNOWN",
        "confidence": 0,
        "language": "UNKNOWN",
        "extracted_fields": DEFAULT_EXTRACTED_FIELDS.copy(),
        "missing_fields": [],
        "should_escalate": False,
        "reason": reason,
    }


def safe_parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1 or end <= start:
            raise

        return json.loads(text[start:end + 1])


def normalize_ai_result(result: dict) -> dict:
    intent = result.get("intent", "UNKNOWN")

    if intent not in ALLOWED_INTENTS:
        intent = "UNKNOWN"

    extracted_fields = DEFAULT_EXTRACTED_FIELDS.copy()
    raw_fields = result.get("extracted_fields") or {}

    if isinstance(raw_fields, dict):
        for key in extracted_fields:
            if key in raw_fields:
                extracted_fields[key] = raw_fields[key]

    confidence = result.get("confidence", 0)

    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0

    confidence = max(0, min(1, confidence))

    language = result.get("language", "UNKNOWN")
    if language not in {"FR", "EN", "UNKNOWN"}:
        language = "UNKNOWN"

    missing_fields = result.get("missing_fields", [])
    if not isinstance(missing_fields, list):
        missing_fields = []

    return {
        "intent": intent,
        "confidence": confidence,
        "language": language,
        "extracted_fields": extracted_fields,
        "missing_fields": missing_fields,
        "should_escalate": bool(result.get("should_escalate", False)),
        "reason": str(result.get("reason", "")),
    }


def understand_message_with_ai(text: str) -> dict:
    if not client:
        return default_unknown_result()

    try:
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        parsed = safe_parse_json(content)

        return normalize_ai_result(parsed)

    except Exception as error:
        return default_unknown_result(reason=f"Mistral error: {str(error)}")