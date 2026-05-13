from app.db.shipment_repository import list_shipments_by_phone


SHIPMENT_STATUS_LABELS = {
    "CREATED": "créé",
    "RECEIVED_AT_ORIGIN": "reçu à l’entrepôt d’origine",
    "SCHEDULED_FOR_DEPARTURE": "programmé pour départ",
    "READY_FOR_DEPARTURE": "prêt pour départ",
    "DEPARTED": "parti",
    "IN_TRANSIT": "en transit",
    "ARRIVED_HUB": "arrivé dans un hub logistique",
    "ARRIVED_DESTINATION": "arrivé à destination",
    "READY_FOR_PICKUP": "prêt pour retrait",
    "DELIVERED": "livré",
    "BLOCKED": "bloqué",
    "ISSUE": "en anomalie",
    "CANCELLED": "annulé",
}


def is_multiple_shipments_question(text: str | None) -> bool:
    if not text:
        return False

    normalized = text.lower()

    signals = [
        "mes colis",
        "mes paquets",
        "tous mes colis",
        "combien de colis",
        "j'ai 2 colis",
        "j’ai 2 colis",
        "j'ai deux colis",
        "j’ai deux colis",
        "plusieurs colis",
        "mes marchandises",
        "mes commandes",
    ]

    return any(signal in normalized for signal in signals)


def format_shipment_line(index: int, shipment: dict) -> str:
    tracking_id = shipment.get("tracking_id") or "sans tracking"
    status = shipment.get("status") or "UNKNOWN"
    label = SHIPMENT_STATUS_LABELS.get(status, status)

    destination_city = shipment.get("destination_city")
    destination_country = shipment.get("destination_country")

    destination = ""

    if destination_city or destination_country:
        destination_parts = [
            part
            for part in [destination_city, destination_country]
            if part
        ]
        destination = " — " + ", ".join(destination_parts)

    return f"{index}. {tracking_id} — {label}{destination}"


def build_client_shipments_reply(
    org_name: str,
    shipments: list[dict],
) -> dict:
    if not shipments:
        return {
            "reply_type": "CLIENT_SHIPMENTS_NOT_FOUND",
            "should_escalate": True,
            "message": (
                f"Merci d’avoir contacté {org_name}.\n\n"
                "Je n’ai pas trouvé de colis lié à votre numéro pour le moment.\n"
                "Merci d’envoyer votre numéro de tracking ou le nom utilisé pour l’expédition afin que l’équipe vérifie."
            ),
        }

    lines = [
        f"{org_name} a retrouvé les colis liés à votre numéro :",
        "",
    ]

    for index, shipment in enumerate(shipments, start=1):
        lines.append(format_shipment_line(index, shipment))

    lines.extend([
        "",
        "Si un colis manque dans cette liste, envoyez le numéro de tracking ou le nom utilisé lors du dépôt."
    ])

    return {
        "reply_type": "CLIENT_MULTIPLE_SHIPMENTS_RESPONSE",
        "should_escalate": False,
        "message": "\n".join(lines),
    }


def get_client_shipments_reply(
    org_id: str,
    org_name: str,
    phone: str,
    include_completed: bool = True,
) -> dict:
    shipments = list_shipments_by_phone(
        org_id=org_id,
        phone=phone,
        include_completed=include_completed,
        limit=20,
    )

    return build_client_shipments_reply(
        org_name=org_name,
        shipments=shipments,
    )
