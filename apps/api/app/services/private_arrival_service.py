from app.db.media_repository import create_shipment_media
from app.db.notification_repository import create_notification_outbox
from app.db.message_repository import create_dossier_event


def build_private_arrival_message(
    org_name: str,
    shipment: dict,
    media: dict | None = None,
    weight_kg: float | None = None,
    arrival_note: str | None = None,
) -> str:
    tracking_id = shipment.get("tracking_id") or "N/A"

    lines = [
        f"Bonjour chef 🙏",
        "",
        f"Votre colis ({tracking_id}) est bien arrivé chez {org_name}.",
    ]

    if weight_kg:
        lines.append(f"Poids confirmé : {weight_kg} kg")

    if media:
        lines.append("")
        lines.append("Une preuve/photo du colis a été attachée à votre dossier.")

    if arrival_note:
        lines.append("")
        lines.append(f"Note de l’agence : {arrival_note}")

    lines.extend([
        "",
        "L’équipe va maintenant vérifier la suite : paiement, retrait ou expédition selon votre dossier.",
    ])

    return "\n".join(lines)


def create_private_arrival_media_and_notification(
    org_id: str,
    org_name: str,
    shipment: dict,
    client_phone: str,
    media_url: str | None = None,
    media_type: str = "ARRIVAL_PROOF",
    caption: str | None = None,
    uploaded_by: str | None = None,
    weight_kg: float | None = None,
    arrival_note: str | None = None,
):
    media = None

    if media_url:
        media = create_shipment_media(
            org_id=org_id,
            shipment_id=str(shipment["id"]),
            dossier_id=str(shipment["dossier_id"]) if shipment.get("dossier_id") else None,
            client_id=str(shipment["client_id"]) if shipment.get("client_id") else None,
            media_url=media_url,
            media_type=media_type,
            caption=caption,
            public_note=arrival_note,
            uploaded_by=uploaded_by,
            is_private=True,
        )

    message = build_private_arrival_message(
        org_name=org_name,
        shipment=shipment,
        media=media,
        weight_kg=weight_kg,
        arrival_note=arrival_note,
    )

    notification = create_notification_outbox(
        org_id=org_id,
        client_id=shipment["client_id"],
        dossier_id=shipment["dossier_id"],
        recipient_phone=client_phone,
        notification_type="PRIVATE_PACKAGE_ARRIVAL",
        message=message,
    )

    create_dossier_event(
        org_id=org_id,
        dossier_id=str(shipment["dossier_id"]),
        event_type="PRIVATE_ARRIVAL_NOTIFICATION_CREATED",
        payload={
            "shipment_id": str(shipment["id"]),
            "tracking_id": shipment.get("tracking_id"),
            "media_id": str(media["id"]) if media else None,
            "notification_id": str(notification["id"]) if notification else None,
        },
    )

    return {
        "media": media,
        "notification": notification,
        "message": message,
    }
