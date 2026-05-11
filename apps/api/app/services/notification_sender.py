from app.services.mock_whatsapp_provider import MockWhatsAppProvider

from app.db.notification_repository import (
    get_notification_by_id,
    mark_notification_as_sent,
    mark_notification_failed,
)

from app.db.message_repository import create_dossier_event


provider = MockWhatsAppProvider()


def send_notification(
    org_id: str,
    notification_id: str,
):
    notification = get_notification_by_id(
        org_id=org_id,
        notification_id=notification_id,
    )

    if not notification:
        return {
            "status": "error",
            "message": "notification_not_found",
        }

    if notification["status"] != "PENDING":
        return {
            "status": "error",
            "message": "already_processed",
        }

    try:
        result = provider.send_message(
            to=notification["recipient_phone"],
            message=notification["message"],
        )

        if result.get("success"):
            mark_notification_as_sent(
                org_id=org_id,
                notification_id=notification_id,
                provider_message_id=result.get("provider_message_id"),
            )

            if notification.get("dossier_id"):
                create_dossier_event(
                    org_id=org_id,
                    dossier_id=str(notification["dossier_id"]),
                    event_type="NOTIFICATION_SENT",
                    payload={
                        "notification_id": notification_id,
                        "provider_message_id": result.get("provider_message_id"),
                        "recipient_phone": notification["recipient_phone"],
                        "notification_type": notification["notification_type"],
                    },
                )

            return {
                "status": "sent",
                "provider_result": result,
            }

        mark_notification_failed(
            org_id=org_id,
            notification_id=notification_id,
            error="provider_error",
        )

        return {
            "status": "failed",
            "message": "provider_error",
        }

    except Exception as e:
        mark_notification_failed(
            org_id=org_id,
            notification_id=notification_id,
            error=str(e),
        )

        return {
            "status": "failed",
            "error": str(e),
        }