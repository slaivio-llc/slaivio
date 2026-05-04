import re
from app.services.pricing_parser import extract_goods_type


def extract_pricing_info(text: str):
    text_lower = text.lower()

    # poids
    weight = None
    match = re.search(r"(\d+)\s?kg", text_lower)
    if match:
        weight = float(match.group(1))

    # villes/pays simples
    countries = [
        "chine",
        "rdc",
        "congo",
        "cameroun",
        "ghana",
        "canada",
        "dubai",
    ]

    detected = [c for c in countries if c in text_lower]

    origin = detected[0] if len(detected) > 0 else None
    destination = detected[1] if len(detected) > 1 else None


# ajouter :
    goods_type = extract_goods_type(text)



    return {
        "origin_country": origin,
        "destination_country": destination,
        "weight_kg": weight,
        "goods_type": goods_type,
    }

def extract_goods_type(text: str):
    text = text.lower()

    if "téléphone" in text or "phone" in text:
        return "phone"

    if "laptop" in text or "ordinateur" in text:
        return "laptop"

    if "cosmétique" in text:
        return "cosmetics"

    if "bijou" in text:
        return "jewelry"

    return None