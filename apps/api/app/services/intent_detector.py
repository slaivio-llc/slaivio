def contains_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def detect_intent(text: str | None) -> str:
    if not text:
        return "UNKNOWN"

    normalized_text = text.lower().strip()

    confirmation_keywords = [
        "ok je confirme",
        "je confirme",
        "c'est bon je confirme",
        "c’est bon je confirme",
        "d'accord je confirme",
        "d’accord je confirme",
        "oui je confirme",
        "confirm",
        "i confirm",
        "yes proceed",
        "go ahead",
    ]

    supplier_payment_keywords = [
        "payer mon fournisseur",
        "payer fournisseur",
        "paiement fournisseur",
        "alipay",
        "wechat",
        "wechat pay",
        "rmb",
        "yuan",
    ]

    tracking_keywords = [
        "tracking",
        "suivi",
        "numéro de suivi",
        "numero de suivi",
        "slaivo-",
        "mon colis",
        "où est mon colis",
        "ou est mon colis",
        "colis est où",
        "colis est ou",
        "statut colis",
        "track",
    ]

    price_keywords = [
        "prix",
        "tarif",
        "combien",
        "ça coûte",
        "ca coute",
        "coût",
        "cout",
        "cost",
        "price",
        "how much",
    ]

    warehouse_keywords = [
        "adresse",
        "entrepôt",
        "entrepot",
        "warehouse",
        "location",
        "bureau",
        "localisation",
        "situer",
        "situé",
        "where",
        "address",
    ]

    departure_keywords = [
        "départ",
        "depart",
        "prochain départ",
        "prochain depart",
        "vol",
        "bateau",
        "schedule",
        "next shipment",
    ]

    human_keywords = [
        "agent",
        "humain",
        "responsable",
        "appeler",
        "call",
        "parler",
        "manager",
        "gérant",
        "gerant",
    ]

    transitaire_keywords = [
        "acheter",
        "achat",
        "fournisseur",
        "supplier",
        "transitaire",
        "commande",
        "buy",
        "purchase",
        "quality control",
        "contrôle qualité",
        "controle qualite",
        "faire venir",
        "importer",
    ]

    send_cargo_keywords = [
        "envoyer",
        "expédier",
        "expedier",
        "ship",
        "shipping",
        "send",
        "colis",
        "cargo",
        "marchandise",
        "marchandises",
        "paquet",
    ]

    greeting_keywords = [
        "bonjour",
        "bonsoir",
        "salut",
        "hello",
        "hi",
        "good morning",
        "good day",
        "good evening",
    ]

    if contains_any(normalized_text, confirmation_keywords):
        return "CONFIRMATION"

    if contains_any(normalized_text, supplier_payment_keywords):
        return "SUPPLIER_PAYMENT_REQUEST"

    if contains_any(normalized_text, tracking_keywords):
        return "TRACKING_REQUEST"

    if contains_any(normalized_text, price_keywords):
        return "PRICING_REQUEST"

    if contains_any(normalized_text, warehouse_keywords):
        return "WAREHOUSE_ADDRESS_REQUEST"

    if contains_any(normalized_text, departure_keywords):
        return "DEPARTURE_SCHEDULE_REQUEST"

    if contains_any(normalized_text, human_keywords):
        return "HUMAN_HELP_REQUEST"

    if contains_any(normalized_text, transitaire_keywords):
        return "TRANSITAIRE_REQUEST"

    if contains_any(normalized_text, send_cargo_keywords):
        return "SEND_CARGO_REQUEST"

    if contains_any(normalized_text, greeting_keywords):
        return "GREETING"

    return "UNKNOWN"
