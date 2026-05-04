import re


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

    return {
        "origin_country": origin,
        "destination_country": destination,
        "weight_kg": weight,
    }