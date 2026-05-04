from app.db.pricing_repository import find_pricing_rules


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

    for rule in rules:
        price = float(rule["price"])
        rule_type = rule["rule_type"]

        # PER KG
        if rule_type == "PER_KG" and weight_kg:
            if rule["min_value"] and weight_kg < rule["min_value"]:
                continue
            if rule["max_value"] and weight_kg > rule["max_value"]:
                continue

            total = weight_kg * price

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
            }

        # PER CBM
        if rule_type == "PER_CBM" and volume_cbm:
            total = volume_cbm * price

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
            }

        # FIXED (ex: téléphone)
        if rule_type == "FIXED":
            return {
                "total": price,
                "currency": rule["currency"],
                "applied_rule": rule,
            }

        # PERCENTAGE (ex: bijoux)
        if rule_type == "PERCENTAGE" and declared_value:
            total = declared_value * (price / 100)

            return {
                "total": total,
                "currency": rule["currency"],
                "applied_rule": rule,
            }

    return None