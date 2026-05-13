from app.db.broadcast_repository import (
    get_broadcast,
    add_broadcast_recipient,
    list_broadcast_recipients,
    attach_notification_to_recipient,
    mark_broadcast_queued,
    list_active_clients,
    list_clients_by_dossier_status,
)

from app.db.notification_repository import create_notification_outbox


def add_manual_recipients(
    org_id: str,
    broadcast_id: str,
    phones: list[str],
):
    recipients = []

    for phone in phones:
        clean_phone = phone.strip()

        if not clean_phone:
            continue

        recipient = add_broadcast_recipient(
            org_id=org_id,
            broadcast_id=broadcast_id,
            recipient_phone=clean_phone,
        )

        recipients.append(recipient)

    return recipients


def add_recipients_from_target(
    org_id: str,
    broadcast_id: str,
    target_type: str,
    status_global: str | None = None,
):
    target = target_type.strip().upper()

    recipients = []

    if target == "ALL_CLIENTS":
        clients = list_active_clients(org_id=org_id)

        for client in clients:
            recipient = add_broadcast_recipient(
                org_id=org_id,
                broadcast_id=broadcast_id,
                recipient_phone=client["phone"],
                client_id=str(client["id"]),
            )

            recipients.append(recipient)

    elif target == "DOSSIER_STATUS":
        if not status_global:
            return []

        clients = list_clients_by_dossier_status(
            org_id=org_id,
            status_global=status_global,
        )

        for client in clients:
            recipient = add_broadcast_recipient(
                org_id=org_id,
                broadcast_id=broadcast_id,
                recipient_phone=client["phone"],
                client_id=str(client["client_id"]),
                dossier_id=str(client["dossier_id"]),
            )

            recipients.append(recipient)

    return recipients


def queue_broadcast_notifications(
    org_id: str,
    broadcast_id: str,
):
    broadcast = get_broadcast(
        org_id=org_id,
        broadcast_id=broadcast_id,
    )

    if not broadcast:
        return {
            "status": "error",
            "message": "broadcast_not_found",
        }

    recipients = list_broadcast_recipients(
        org_id=org_id,
        broadcast_id=broadcast_id,
    )

    queued = []

    for recipient in recipients:
        if recipient.get("notification_id"):
            continue

        notification = create_notification_outbox(
            org_id=org_id,
            client_id=recipient.get("client_id"),
            dossier_id=recipient.get("dossier_id"),
            recipient_phone=recipient["recipient_phone"],
            notification_type=f"BROADCAST:{broadcast['broadcast_type']}",
            message=broadcast["message"],
        )

        updated_recipient = attach_notification_to_recipient(
            org_id=org_id,
            recipient_id=str(recipient["id"]),
            notification_id=str(notification["id"]),
        )

        queued.append(updated_recipient)

    updated_broadcast = mark_broadcast_queued(
        org_id=org_id,
        broadcast_id=broadcast_id,
    )

    return {
        "status": "ok",
        "broadcast": updated_broadcast,
        "queued_count": len(queued),
        "recipients": queued,
    }
