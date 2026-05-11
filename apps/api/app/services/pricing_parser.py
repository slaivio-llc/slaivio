import re


KNOWN_COUNTRIES = {
    "chine": "Chine",
    "china": "Chine",
    "rdc": "RDC",
    "congo": "RDC",
    "cameroun": "Cameroun",
    "cameroon": "Cameroun",
    "ghana": "Ghana",
    "canada": "Canada",
    "dubai": "Dubai",
    "turquie": "Turquie",
    "turkey": "Turquie",
    "france": "France",
    "belgique": "Belgique",
    "belgium": "Belgique",
    "kenya": "Kenya",
    "ouganda": "Ouganda",
    "uganda": "Ouganda",
}


def extract_goods_type(text: str) -> str | None:
    text = text.lower()

    mapping = {
        "phone": ["téléphone", "telephone", "phone", "iphone", "samsung"],
        "laptop": ["laptop", "ordinateur", "pc", "macbook"],
        "cosmetics": ["cosmétique", "cosmetique", "maquillage", "parfum"],
        "jewelry": ["bijou", "bijoux", "jewelry"],
        "clothes": ["vêtement", "vetement", "habits", "chaussures"],
        "documents": ["document", "documents", "courrier"],
        "machines": ["machine", "machines"],
    }

    for normalized_type, keywords in mapping.items():
        for keyword in keywords:
            if keyword in text:
                return normalized_type

    return None


def extract_weight(text: str) -> float | None:
    text = text.lower()

    patterns = [
        r"(\d+(?:\.\d+)?)\s?kg",
        r"(\d+(?:\.\d+)?)\s?kilos?",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return None

    return None


def extract_volume(text: str) -> float | None:
    text = text.lower()

    patterns = [
        r"(\d+(?:\.\d+)?)\s?cbm",
        r"(\d+(?:\.\d+)?)\s?m3",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return None

    return None


def extract_countries(text: str) -> list[str]:
    text_lower = text.lower()

    detected = []

    for keyword, normalized in KNOWN_COUNTRIES.items():
        if keyword in text_lower and normalized not in detected:
            detected.append(normalized)

    return detected


def extract_pricing_info(text: str):
    detected = extract_countries(text)

    origin = detected[0] if len(detected) > 0 else None
    destination = detected[1] if len(detected) > 1 else None

    return {
        "origin_country": origin,
        "destination_country": destination,
        "weight_kg": extract_weight(text),
        "volume_cbm": extract_volume(text),
        "goods_type": extract_goods_type(text),
    }
