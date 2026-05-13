from app.db.notification_repository import create_notification_outbox


def build_batch_status_message(
    batch: dict,
    shipment: dict,
) -> str:
    status = batch.get("status")
    tracking_id = shipment.get("tracking_id") or "N/A"
    batch_name = batch.get("batch_name") or "votre lot"
    public_note = batch.get("public_note")
    delay_reason = batch.get("delay_reason")

    if status == "DEPARTED":
        message = (
            f"Votre colis ({tracking_id}) fait partie du lot {batch_name}.\n\n"
            "Ce lot a quitté le point d’origine."
        )

    elif status == "IN_TRANSIT":
        message = (
            f"Votre colis ({tracking_id}) est en cours d’acheminement avec le lot {batch_name}."
        )

    elif status == "ARRIVED_DESTINATION":
        message = (
            f"Votre colis ({tracking_id}) est arrivé à destination avec le lot {batch_name}."
        )

    elif status == "DELAYED":
        message = (
            f"Votre colis ({tracking_id}) fait partie du lot {batch_name}.\n\n"
            "Ce lot connaît actuellement un retard."
        )

        if delay_reason:
            message += f"\n\nRaison communiquée : {delay_reason}"

    elif status == "BLOCKED":
        message = (
            f"Votre colis ({tracking_id}) fait partie du lot {batch_name}.\n\n"
            "Ce lot est temporairement bloqué. L’équipe suit la situation."
        )

    else:
        message = (
            f"Mise à jour du lot {batch_name} pour votre colis ({tracking_id}).\n\n"
            f"Statut actuel : {status}"
        )

    if public_note:
        message += f"\n\nNote de l’agence : {public_note}"

    return message


def create_batch_notifications(
    org_id: str,
    batch: dict,
    shipments: list[dict],
):
    notifications = []

    for shipment in shipments:
        client_phone = shipment.get("client_phone") or shipment.get("phone")

        if not client_phone:
            continue

        message = build_batch_status_message(
            batch=batch,
            shipment=shipment,
        )

        notification = create_notification_outbox(
            org_id=org_id,
            client_id=shipment["client_id"],
            dossier_id=shipment["dossier_id"],
            recipient_phone=client_phone,
            notification_type=f"BATCH_STATUS:{batch['status']}",
            message=message,
        )

        notifications.append(notification)

    return notifications
