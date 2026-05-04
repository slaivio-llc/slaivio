from app.db.notification_repository import create_notification_outbox


def get_shipment_status_message(status: str, shipment: dict) -> str | None:
    tracking_id = shipment.get("tracking_id")

    messages = {
        "RECEIVED_AT_ORIGIN": f"Votre colis ({tracking_id}) a été reçu à notre entrepôt.",
        "SCHEDULED_FOR_DEPARTURE": f"Votre colis ({tracking_id}) est programmé pour expédition.",
        "DEPARTED": f"Votre colis ({tracking_id}) a quitté le pays d’origine.",
        "IN_TRANSIT": f"Votre colis ({tracking_id}) est en transit.",
        "ARRIVED_HUB": f"Votre colis ({tracking_id}) est arrivé à un hub logistique.",
        "ARRIVED_DESTINATION": f"Votre colis ({tracking_id}) est arrivé dans le pays de destination.",
        "READY_FOR_PICKUP": f"Votre colis ({tracking_id}) est prêt pour retrait.",
        "DELIVERED": f"Votre colis ({tracking_id}) a été livré.",
        "BLOCKED": f"Votre colis ({tracking_id}) est temporairement bloqué. Veuillez contacter l’agence.",
        "ISSUE": f"Un problème est survenu avec votre colis ({tracking_id}). Contactez l’agence.",
    }

    return messages.get(status)


def create_shipment_notification(
    org_id: str,
    shipment: dict,
    client_phone: str,
):
    message = get_shipment_status_message(
        shipment["status"],
        shipment,
    )

    if not message:
        return None

    return create_notification_outbox(
        org_id=org_id,
        client_id=shipment["client_id"],
        dossier_id=shipment["dossier_id"],
        recipient_phone=client_phone,
        notification_type=f"SHIPMENT_STATUS:{shipment['status']}",
        message=message,
    )