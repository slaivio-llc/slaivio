from app.services.pricing_engine import calculate_price


def calculate_final_price(
    org_id: str,
    dossier: dict,
    weight_kg: float | None,
    volume_cbm: float | None,
):
    return calculate_price(
        org_id=org_id,
        origin_country=dossier.get("origin_country"),
        destination_country=dossier.get("destination_country"),
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
        goods_type=dossier.get("goods_type"),
    )