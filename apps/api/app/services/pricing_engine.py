from app.db.pricing_repository import find_pricing_rules


def _to_float(value):
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def calculate_price(
    org_id: str,
    origin_country: str,
    destination_country: str,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
    goods_type: str | None = None,
    declared_value: float | None = None,
):
    rules = find_pricing_rules(
        org_id=org_id,
        origin_country=origin_country,
        destination_country=destination_country,
        goods_type=goods_type,
    )

    weight = _to_float(weight_kg)
    volume = _to_float(volume_cbm)
    declared = _to_float(declared_value)

    for rule in rules:
        price = _to_float(rule.get("price"))
        rule_type = rule.get("rule_type")

        if price is None:
            continue

        min_value = _to_float(rule.get("min_value"))
        max_value = _to_float(rule.get("max_value"))

        if rule_type == "PER_KG" and weight is not None:
            if min_value is not None and weight < min_value:
                continue

            if max_value is not None and weight > max_value:
                continue

            total = weight * price

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": weight,
                    "unit_price": price,
                },
            }

        if rule_type == "PER_CBM" and volume is not None:
            if min_value is not None and volume < min_value:
                continue

            if max_value is not None and volume > max_value:
                continue

            total = volume * price

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": volume,
                    "unit_price": price,
                },
            }

        if rule_type == "FIXED":
            return {
                "total": price,
                "currency": rule["currency"],
                "applied_rule": rule,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": 1,
                    "unit_price": price,
                },
            }

        if rule_type == "PERCENTAGE" and declared is not None:
            total = declared * (price / 100)

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
                "calculation": {
                    "rule_type": rule_type,
                    "declared_value": declared,
                    "percentage": price,
                },
            }

    return None
