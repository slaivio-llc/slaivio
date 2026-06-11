from app.commercial.resolvers.configuration_resolvers import (
    resolve_pricing_components,
)


def calculate_quote_pricing(
    org_id: str,
    shipping_service_id: str,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
):
    components = resolve_pricing_components(
        org_id=org_id,
        shipping_service_id=shipping_service_id,
    )

    if not components:
        return {
            "pricing_available": False,
            "subtotal_minor": None,
            "total_minor": None,
            "currency_code": None,
            "breakdown": [],
        }

    breakdown = []
    total_minor = 0
    currency_code = components[0]["currency_code"]

    for component in components:
        calculation_type = component["calculation_type"]
        amount_minor = component.get("amount_minor") or 0
        line_total = 0

        if calculation_type == "FIXED":
            line_total = amount_minor
        elif calculation_type == "PER_KG":
            line_total = int(amount_minor * float(weight_kg or 0))
        elif calculation_type == "PER_CBM":
            line_total = int(amount_minor * float(volume_cbm or 0))
        elif calculation_type == "PERCENTAGE":
            line_total = int(total_minor * float(component.get("percentage") or 0) / 100)

        total_minor += line_total
        breakdown.append(
            {
                "component_code": component["component_code"],
                "component_name": component["component_name"],
                "calculation_type": calculation_type,
                "amount_minor": amount_minor,
                "line_total_minor": line_total,
                "currency_code": component["currency_code"],
            }
        )

    return {
        "pricing_available": True,
        "subtotal_minor": total_minor,
        "total_minor": total_minor,
        "currency_code": currency_code,
        "breakdown": breakdown,
    }
