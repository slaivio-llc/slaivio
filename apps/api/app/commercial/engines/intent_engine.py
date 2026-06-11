import re


QUOTE_PATTERNS = [
    "prix",
    "tarif",
    "devis",
    "combien",
    "quote",
    "price",
]

PROCUREMENT_PATTERNS = [
    "acheter",
    "achat",
    "source",
    "sourcing",
    "fournisseur",
    "supplier",
    "procure",
]

RESTRICTION_PATTERNS = [
    "autorise",
    "interdit",
    "restriction",
    "prohibited",
    "allowed",
    "peut on envoyer",
    "peux envoyer",
]

KNOWN_LOCATIONS = {
    "chine": ("China", None),
    "china": ("China", None),
    "guangzhou": ("China", "Guangzhou"),
    "yiwu": ("China", "Yiwu"),
    "rdc": ("DRC", None),
    "congo": ("DRC", None),
    "kinshasa": ("DRC", "Kinshasa"),
    "dubai": ("UAE", "Dubai"),
    "uae": ("UAE", None),
    "france": ("France", None),
    "paris": ("France", "Paris"),
}

KNOWN_GOODS = [
    "lithium battery",
    "battery",
    "batterie",
    "telephone",
    "phone",
    "vetement",
    "clothes",
    "perfume",
    "parfum",
    "machine",
    "piece auto",
]


def detect_commercial_intent(message: str):
    normalized = message.lower()

    if any(pattern in normalized for pattern in PROCUREMENT_PATTERNS):
        return "PROCUREMENT_REQUEST"

    if any(pattern in normalized for pattern in RESTRICTION_PATTERNS):
        return "RESTRICTION_CHECK"

    if any(pattern in normalized for pattern in QUOTE_PATTERNS):
        return "QUOTE_REQUEST"

    return "QUOTE_REQUEST"


def extract_commercial_fields(message: str):
    normalized = message.lower()
    fields: dict[str, object] = {}

    weight_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram)", normalized)
    if weight_match:
        fields["weight_kg"] = float(weight_match.group(1).replace(",", "."))

    volume_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(cbm|m3)", normalized)
    if volume_match:
        fields["volume_cbm"] = float(volume_match.group(1).replace(",", "."))

    quantity_match = re.search(r"(\d+)\s*(pcs|pieces|pièces|unités|unites)", normalized)
    if quantity_match:
        fields["quantity"] = int(quantity_match.group(1))

    if "air" in normalized or "avion" in normalized:
        fields["shipping_mode"] = "AIR"
    elif "sea" in normalized or "bateau" in normalized or "maritime" in normalized:
        fields["shipping_mode"] = "SEA"

    mentioned_locations = [
        value
        for key, value in KNOWN_LOCATIONS.items()
        if key in normalized
    ]

    if mentioned_locations:
        fields["origin_country"] = mentioned_locations[0][0]
        fields["origin_city"] = mentioned_locations[0][1]

    if len(mentioned_locations) > 1:
        fields["destination_country"] = mentioned_locations[-1][0]
        fields["destination_city"] = mentioned_locations[-1][1]

    for goods in KNOWN_GOODS:
        if goods in normalized:
            fields["goods_description"] = goods
            break

    if "goods_description" not in fields:
        fields["goods_description"] = message[:180]

    return fields


def missing_quote_fields(fields: dict):
    required_fields = [
        "origin_country",
        "destination_country",
        "goods_description",
    ]

    if not fields.get("weight_kg") and not fields.get("volume_cbm"):
        required_fields.append("weight_kg_or_volume_cbm")

    return [
        field
        for field in required_fields
        if field == "weight_kg_or_volume_cbm"
        or not fields.get(field)
    ]
