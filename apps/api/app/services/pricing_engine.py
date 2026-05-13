from app.db.pricing_repository import find_pricing_rules


def _to_float(value):
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _rule_matches_quantity(
    rule: dict,
    quantity: float | None,
) -> bool:
    if quantity is None:
        return False

    min_value = _to_float(rule.get("min_value"))
    max_value = _to_float(rule.get("max_value"))

    if min_value is not None and quantity < min_value:
        return False

    if max_value is not None and quantity > max_value:
        return False

    return True


def calculate_price(
    org_id: str,
    origin_country: str | None,
    destination_country: str | None,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
    goods_type: str | None = None,
    declared_value: float | None = None,
    origin_city: str | None = None,
    destination_city: str | None = None,
    shipping_mode: str | None = None,
):
    if not origin_country or not destination_country:
        return None

    rules = find_pricing_rules(
        org_id=org_id,
        origin_country=origin_country,
        destination_country=destination_country,
        origin_city=origin_city,
        destination_city=destination_city,
        shipping_mode=shipping_mode,
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

        if rule.get("requires_manual_confirmation"):
            return {
                "total": None,
                "currency": rule.get("currency"),
                "applied_rule": rule,
                "requires_manual_confirmation": True,
                "message": rule.get("note") or "Tarif à confirmer avec l’agence.",
            }

        if rule_type == "PER_KG":
            if not _rule_matches_quantity(rule, weight):
                continue

            return {
                "total": weight * price,
                "currency": rule["currency"],
                "applied_rule": rule,
                "requires_manual_confirmation": False,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": weight,
                    "unit_price": price,
                    "unit": "KG",
                },
            }

        if rule_type == "PER_CBM":
            if not _rule_matches_quantity(rule, volume):
                continue

            return {
                "total": volume * price,
                "currency": rule["currency"],
                "applied_rule": rule,
                "requires_manual_confirmation": False,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": volume,
                    "unit_price": price,
                    "unit": "CBM",
                },
            }

        if rule_type in ["FIXED", "PER_PIECE"]:
            return {
                "total": price,
                "currency": rule["currency"],
                "applied_rule": rule,
                "requires_manual_confirmation": False,
                "calculation": {
                    "rule_type": rule_type,
                    "quantity": 1,
                    "unit_price": price,
                    "unit": rule.get("unit") or "PIECE",
                },
            }

        if rule_type == "PERCENTAGE":
            if declared is None:
                continue

            return {
                "total": declared * (price / 100),
                "currency": rule["currency"],
                "applied_rule": rule,
                "requires_manual_confirmation": False,
                "calculation": {
                    "rule_type": rule_type,
                    "declared_value": declared,
                    "percentage": price,
                },
            }

    return None
