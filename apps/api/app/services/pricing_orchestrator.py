from app.services.pricing_parser import extract_pricing_info
from app.services.pricing_engine import calculate_price


def handle_pricing_request(
    org_id: str,
    text: str,
    dossier: dict | None = None,
):
    parsed = extract_pricing_info(text)

    origin_country = parsed.get("origin_country")
    destination_country = parsed.get("destination_country")
    weight_kg = parsed.get("weight_kg")
    volume_cbm = parsed.get("volume_cbm")
    goods_type = parsed.get("goods_type")

    # mémoire dossier
    if dossier:
        origin_country = (
            origin_country
            or dossier.get("origin_country")
        )

        destination_country = (
            destination_country
            or dossier.get("destination_country")
        )

        weight_kg = (
            weight_kg
            or dossier.get("estimated_weight_kg")
        )

        volume_cbm = (
            volume_cbm
            or dossier.get("estimated_volume_cbm")
        )

        goods_type = (
            goods_type
            or dossier.get("goods_type")
        )

    parsed_result = {
        "origin_country": origin_country,
        "destination_country": destination_country,
        "weight_kg": weight_kg,
        "volume_cbm": volume_cbm,
        "goods_type": goods_type,
    }

    # route obligatoire
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

    # quantité obligatoire
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
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
        goods_type=goods_type,
    )

    if not result:
        return {
            "pricing_status": "NO_RULE_FOUND",
            "parsed": parsed_result,
            "result": None,
            "missing_fields": [],
        }

    return {
        "pricing_status": "CALCULATED",
        "parsed": parsed_result,
        "result": result,
        "missing_fields": [],
    }
