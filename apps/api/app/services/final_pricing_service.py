from app.services.pricing_engine import calculate_price


def calculate_final_price(
    org_id: str,
    dossier: dict | None,
    weight_kg: float | None,
    volume_cbm: float | None,
):
    if not dossier:
        return None

    origin_country = dossier.get("origin_country")
    destination_country = dossier.get("destination_country")
    goods_type = dossier.get("goods_type")

    if not origin_country or not destination_country:
        return None

    if weight_kg is None and volume_cbm is None:
        weight_kg = dossier.get("estimated_weight_kg")
        volume_cbm = dossier.get("estimated_volume_cbm")

    if weight_kg is None and volume_cbm is None:
        return None

    return calculate_price(
        org_id=org_id,
        origin_country=origin_country,
        destination_country=destination_country,
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
        goods_type=goods_type,
    )
