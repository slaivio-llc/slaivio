from app.services.pricing_parser import extract_pricing_info_from_ai_or_text
from app.services.pricing_engine import calculate_price


def handle_pricing_request(
    org_id: str,
    text: str,
    dossier: dict | None = None,
    ai_fields: dict | None = None,
):
    parsed = extract_pricing_info_from_ai_or_text(
        text=text,
        ai_fields=ai_fields,
    )

    origin_country = parsed.get("origin_country")
    origin_city = parsed.get("origin_city")
    destination_country = parsed.get("destination_country")
    destination_city = parsed.get("destination_city")
    weight_kg = parsed.get("weight_kg")
    volume_cbm = parsed.get("volume_cbm")
    goods_type = parsed.get("goods_type")
    shipping_mode = parsed.get("shipping_mode")

    if dossier:
        origin_country = origin_country or dossier.get("origin_country")
        origin_city = origin_city or dossier.get("origin_city")
        destination_country = destination_country or dossier.get("destination_country")
        destination_city = destination_city or dossier.get("destination_city")
        weight_kg = weight_kg or dossier.get("estimated_weight_kg")
        volume_cbm = volume_cbm or dossier.get("estimated_volume_cbm")
        goods_type = goods_type or dossier.get("goods_type")
        shipping_mode = shipping_mode or dossier.get("shipping_mode")

    parsed_result = {
        "origin_country": origin_country,
        "origin_city": origin_city,
        "destination_country": destination_country,
        "destination_city": destination_city,
        "weight_kg": weight_kg,
        "volume_cbm": volume_cbm,
        "goods_type": goods_type,
        "shipping_mode": shipping_mode,
    }

    if not origin_country or not destination_country:
        return {
            "pricing_status": "MISSING_ROUTE",
            "parsed": parsed_result,
            "result": None,
            "missing_fields": [
                "origin_country",
                "destination_country",
            ],
        }

    if weight_kg is None and volume_cbm is None:
        return {
            "pricing_status": "MISSING_QUANTITY",
            "parsed": parsed_result,
            "result": None,
            "missing_fields": [
                "weight_kg_or_volume_cbm",
            ],
        }

    result = calculate_price(
        org_id=org_id,
        origin_country=origin_country,
        destination_country=destination_country,
        origin_city=origin_city,
        destination_city=destination_city,
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
        goods_type=goods_type,
        shipping_mode=shipping_mode,
    )

    if not result:
        return {
            "pricing_status": "NO_RULE_FOUND",
            "parsed": parsed_result,
            "result": None,
            "missing_fields": [],
        }

    if result.get("requires_manual_confirmation"):
        return {
            "pricing_status": "MANUAL_CONFIRMATION_REQUIRED",
            "parsed": parsed_result,
            "result": result,
            "missing_fields": [],
        }

    return {
        "pricing_status": "CALCULATED",
        "parsed": parsed_result,
        "result": result,
        "missing_fields": [],
    }
