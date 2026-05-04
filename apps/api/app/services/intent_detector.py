def detect_intent(text: str | None) -> str:
    if not text:
        return "UNKNOWN"

    normalized_text = text.lower().strip()

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

    tracking_keywords = [
        "tracking",
        "suivi",
        "mon colis",
        "où est",
        "ou est",
        "colis est où",
        "colis est ou",
        "track",
        "statut colis",
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
        "paiement fournisseur",
        "wechat",
        "alipay",
        "rmb",
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

    warehouse_keywords = [
        "adresse",
        "entrepôt",
        "entrepot",
        "warehouse",
        "location",
        "bureau",
        "localisation",
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

    if any(phrase in text.lower() for phrase in [
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
    ]):
        return "CONFIRMATION"

    if any(keyword in normalized_text for keyword in tracking_keywords):
        return "TRACKING_REQUEST"

    if any(keyword in normalized_text for keyword in price_keywords):
        return "PRICE_REQUEST"
    
    if any(word in text.lower() for word in [
        "tracking",
        "suivi",
        "numéro de suivi",
        "numero de suivi",
        "slaivo-",
    ]):
        return "TRACKING_REQUEST"


    if any(word in text.lower() for word in [
        "payer mon fournisseur",
        "payer fournisseur",
        "paiement fournisseur",
        "alipay",
        "wechat",
        "wechat pay",
        "rmb",
        "yuan",
    ]):
        return "SUPPLIER_PAYMENT_REQUEST"

    if any(keyword in normalized_text for keyword in transitaire_keywords):
        return "TRANSITAIRE_REQUEST"

    if any(keyword in normalized_text for keyword in warehouse_keywords):
        return "WAREHOUSE_ADDRESS_REQUEST"

    if any(keyword in normalized_text for keyword in departure_keywords):
        return "DEPARTURE_SCHEDULE_REQUEST"

    if any(keyword in normalized_text for keyword in human_keywords):
        return "HUMAN_HELP_REQUEST"

    if any(keyword in normalized_text for keyword in send_cargo_keywords):
        return "SEND_CARGO_REQUEST"

    if any(keyword in normalized_text for keyword in greeting_keywords):
        return "GREETING"
    
    if any(word in text.lower() for word in [
        "où", "ou", "adresse", "localisation", "situer", "situé",
        "where", "location", "address"]):
        return "ADDRESS_REQUEST"
    
    if any(word in text.lower() for word in [
        "combien",
        "prix",
        "coût",
        "tarif",
        "cost",
        "price"
    ]):
        return "PRICING_REQUEST"

    return "UNKNOWN"