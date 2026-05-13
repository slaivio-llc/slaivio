import re


def extract_weight(text: str) -> float | None:
    text = text.lower()

    patterns = [
        r"(\d+(?:\.\d+)?)\s?kg",
        r"(\d+(?:\.\d+)?)\s?kilos?",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return float(match.group(1))

    return None


def extract_volume(text: str) -> float | None:
    text = text.lower()

    patterns = [
        r"(\d+(?:\.\d+)?)\s?cbm",
        r"(\d+(?:\.\d+)?)\s?m3",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return float(match.group(1))

    return None


def extract_shipping_mode(text: str) -> str | None:
    value = text.lower()

    if "avion" in value or "aérien" in value or "aerien" in value or "air" in value:
        return "AIR"

    if "maritime" in value or "bateau" in value or "sea" in value:
        return "SEA"

    return None


def extract_pricing_info_from_ai_or_text(
    text: str,
    ai_fields: dict | None = None,
) -> dict:
    ai_fields = ai_fields or {}

    return {
        "origin_country": ai_fields.get("origin_country"),
        "origin_city": ai_fields.get("origin_city"),
        "destination_country": ai_fields.get("destination_country"),
        "destination_city": ai_fields.get("destination_city"),
        "goods_type": ai_fields.get("goods_type"),
        "weight_kg": ai_fields.get("estimated_weight_kg") or extract_weight(text),
        "volume_cbm": ai_fields.get("estimated_volume_cbm") or extract_volume(text),
        "shipping_mode": ai_fields.get("shipping_mode") or extract_shipping_mode(text),
    }
