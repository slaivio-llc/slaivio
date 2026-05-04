from app.db.pricing_repository import find_pricing_rules


def calculate_price(
    org_id: str,
    origin_country: str,
    destination_country: str,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
    goods_type: str | None = None,
):
    rules = find_pricing_rules(
        org_id=org_id,
        origin_country=origin_country,
        destination_country=destination_country,
        goods_type=goods_type,
    )

    if not rules:
        return None

    rule = rules[0]

    if rule["rule_type"] == "PER_KG" and weight_kg:
        total = weight_kg * float(rule["price"])

    elif rule["rule_type"] == "PER_CBM" and volume_cbm:
        total = volume_cbm * float(rule["price"])

    elif rule["rule_type"] == "FIXED":
        total = float(rule["price"])

    else:
        return None

    return {
        "total": total,
        "currency": rule["currency"],
        "rule": rule,
    }