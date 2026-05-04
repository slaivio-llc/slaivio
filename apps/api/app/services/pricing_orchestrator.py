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

    if dossier:
        origin_country = origin_country or dossier.get("origin_country")
        destination_country = destination_country or dossier.get("destination_country")
        weight_kg = weight_kg or dossier.get("estimated_weight_kg")

    if not origin_country or not destination_country:
        return {
            "pricing_status": "MISSING_ROUTE",
            "parsed": parsed,
            "result": None,
            "missing_fields": ["origin_country", "destination_country"],
        }

    if not weight_kg:
        return {
            "pricing_status": "MISSING_WEIGHT",
            "parsed": parsed,
            "result": None,
            "missing_fields": ["weight_kg"],
        }

    result = calculate_price(
        org_id=org_id,
        origin_country=origin_country.capitalize(),
        destination_country=destination_country.capitalize(),
        weight_kg=weight_kg,
    )

    if not result:
        return {
            "pricing_status": "NO_RULE_FOUND",
            "parsed": {
                **parsed,
                "origin_country": origin_country,
                "destination_country": destination_country,
                "weight_kg": weight_kg,
            },
            "result": None,
            "missing_fields": [],
        }

    return {
        "pricing_status": "CALCULATED",
        "parsed": {
            **parsed,
            "origin_country": origin_country,
            "destination_country": destination_country,
            "weight_kg": weight_kg,
        },
        "result": result,
        "missing_fields": [],
    }