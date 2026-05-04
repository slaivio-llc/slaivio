from app.services.mock_whatsapp_provider import MockWhatsAppProvider
from app.db.notification_repository import (
    get_notification_by_id,
    mark_notification_sent,
    mark_notification_failed,
)

provider = MockWhatsAppProvider()


def send_notification(notification_id: str):
    notification = get_notification_by_id(notification_id)

    if not notification:
        return {"status": "error", "message": "not found"}

    if notification["status"] != "PENDING":
        return {"status": "error", "message": "already processed"}

    try:
        result = provider.send_message(
            to=notification["recipient_phone"],
            message=notification["message"],
        )

        if result.get("success"):
            mark_notification_sent(
                notification_id,
                result.get("provider_message_id"),
            )

            return {"status": "sent"}

        else:
            mark_notification_failed(notification_id, "provider_error")
            return {"status": "failed"}

    except Exception as e:
        mark_notification_failed(notification_id, str(e))
        return {"status": "failed", "error": str(e)}