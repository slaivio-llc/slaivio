import json
from mistralai import Mistral
from app.core.config import settings


client = (
    Mistral(api_key=settings.mistral_api_key)
    if settings.mistral_api_key
    else None
)


ALLOWED_INTENTS = {
    "GREETING",
    "SEND_CARGO_REQUEST",
    "TRANSITAIRE_REQUEST",
    "PRICE_REQUEST",
    "PRICING_REQUEST",
    "TRACKING_REQUEST",
    "WAREHOUSE_ADDRESS_REQUEST",
    "DEPARTURE_SCHEDULE_REQUEST",
    "HUMAN_HELP_REQUEST",
    "SUPPLIER_PAYMENT_REQUEST",
    "CONFIRMATION",
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
    "client_full_name": None,
}


SYSTEM_PROMPT = """
You are SLAIVO Understanding Engine.

You NEVER reply to customers.

You ONLY:
- classify intent
- extract structured logistics information

Return ONLY valid JSON.

JSON format:
{
  "intent": "",
  "confidence": 0.0,
  "language": "",
  "extracted_fields": {},
  "missing_fields": [],
  "should_escalate": false,
  "reason": ""
}

Allowed intents:
- GREETING
- SEND_CARGO_REQUEST
- TRANSITAIRE_REQUEST
- PRICE_REQUEST
- PRICING_REQUEST
- TRACKING_REQUEST
- WAREHOUSE_ADDRESS_REQUEST
- DEPARTURE_SCHEDULE_REQUEST
- HUMAN_HELP_REQUEST
- SUPPLIER_PAYMENT_REQUEST
- CONFIRMATION
- UNKNOWN

Rules:
- NEVER invent data
- NEVER invent pricing
- NEVER invent addresses
- NEVER invent shipment status
- extract ONLY explicit information

Intent mapping:
- greeting => GREETING
- shipping cargo => SEND_CARGO_REQUEST
- import via supplier/china => TRANSITAIRE_REQUEST
- asking price/tarif/cost => PRICING_REQUEST
- asking shipment status => TRACKING_REQUEST
- asking office/warehouse address => WAREHOUSE_ADDRESS_REQUEST
- asking departure schedule => DEPARTURE_SCHEDULE_REQUEST
- supplier payment/wechat/alipay/rmb => SUPPLIER_PAYMENT_REQUEST
- confirmation/ok/yes/i confirm => CONFIRMATION

Escalate ONLY:
- angry customer
- legal issue
- impossible to understand
- fraud/risk
- human decision required
"""


def default_unknown_result(
    reason: str = "mistral_unavailable",
):
    return {
        "intent": "UNKNOWN",
        "confidence": 0.0,
        "language": "UNKNOWN",
        "extracted_fields": DEFAULT_EXTRACTED_FIELDS.copy(),
        "missing_fields": [],
        "should_escalate": False,
        "reason": reason,
    }


def safe_parse_json(text: str):
    try:
        return json.loads(text)

    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start == -1 or end == -1:
            raise

        return json.loads(text[start:end + 1])


def normalize_ai_result(result: dict):
    intent = result.get("intent", "UNKNOWN")

    if intent not in ALLOWED_INTENTS:
        intent = "UNKNOWN"

    confidence = result.get("confidence", 0)

    try:
        confidence = float(confidence)
    except Exception:
        confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))

    language = result.get("language", "UNKNOWN")

    if language not in {"FR", "EN", "UNKNOWN"}:
        language = "UNKNOWN"

    extracted_fields = DEFAULT_EXTRACTED_FIELDS.copy()

    raw_fields = result.get("extracted_fields") or {}

    if isinstance(raw_fields, dict):
        for key in extracted_fields:
            if key in raw_fields:
                extracted_fields[key] = raw_fields[key]

    missing_fields = result.get("missing_fields", [])

    if not isinstance(missing_fields, list):
        missing_fields = []

    return {
        "intent": intent,
        "confidence": confidence,
        "language": language,
        "extracted_fields": extracted_fields,
        "missing_fields": missing_fields,
        "should_escalate": bool(
            result.get("should_escalate", False)
        ),
        "reason": str(result.get("reason", "")),
    }


def understand_message_with_ai(text: str):
    if not client:
        return default_unknown_result()

    try:
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
            temperature=0,
            response_format={
                "type": "json_object",
            },
        )

        content = response.choices[0].message.content

        parsed = safe_parse_json(content)

        return normalize_ai_result(parsed)

    except Exception as error:
        return default_unknown_result(
            reason=f"mistral_error: {str(error)}"
        )