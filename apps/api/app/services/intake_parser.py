def normalize_shipping_mode(text: str | None) -> str | None:
    if not text:
        return None

    value = text.lower()

    if "avion" in value or "air" in value:
        return "AIR"

    if "maritime" in value or "bateau" in value or "sea" in value:
        return "SEA"

    return None


def extract_destination(text: str) -> dict:
    text_lower = text.lower()

    known_destinations = {
        "douala": ("Douala", "Cameroun"),
        "yaounde": ("Yaoundé", "Cameroun"),
        "yaoundé": ("Yaoundé", "Cameroun"),
        "kinshasa": ("Kinshasa", "RDC"),
        "goma": ("Goma", "RDC"),
        "bukavu": ("Bukavu", "RDC"),
        "kampala": ("Kampala", "Ouganda"),
        "accra": ("Accra", "Ghana"),
        "nairobi": ("Nairobi", "Kenya"),
        "cotonou": ("Cotonou", "Bénin"),
        "longueuil": ("Longueuil", "Canada"),
        "montreal": ("Montréal", "Canada"),
        "montréal": ("Montréal", "Canada"),
    }

    for key, value in known_destinations.items():
        if key in text_lower:
            city, country = value
            return {
                "destination_city": city,
                "destination_country": country,
            }

    return {
        "destination_city": None,
        "destination_country": None,
    }


def extract_goods_type(text: str) -> str | None:
    text_lower = text.lower()

    known_goods = [
        "vêtements",
        "vetements",
        "habits",
        "chaussures",
        "téléphone",
        "telephone",
        "phone",
        "laptop",
        "ordinateur",
        "cosmétiques",
        "cosmetiques",
        "parfum",
        "bijoux",
        "machine",
        "machines",
        "documents",
        "courrier",
        "médicaments",
        "medicaments",
    ]

    for item in known_goods:
        if item in text_lower:
            return item

    return None


def extract_full_name(text: str) -> str | None:
    # Version simple V1 :
    # Si le client écrit sous forme :
    # "Jean Mbala, Douala Cameroun, avion, vêtements"
    # on prend la première partie avant la virgule comme nom.
    parts = [part.strip() for part in text.split(",")]

    if len(parts) >= 2 and len(parts[0].split()) >= 2:
        return parts[0]

    return None


def parse_intake_message(text: str) -> dict:
    destination = extract_destination(text)

    return {
        "client_full_name": extract_full_name(text),
        "destination_country": destination["destination_country"],
        "destination_city": destination["destination_city"],
        "shipping_mode": normalize_shipping_mode(text),
        "goods_type": extract_goods_type(text),
    }