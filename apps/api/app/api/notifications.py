from fastapi import APIRouter, HTTPException
from app.db.notification_repository import (
    list_pending_notifications,
    mark_notification_sent,
)
from app.db.message_repository import create_dossier_event
from app.services.notification_sender import send_notification


router = APIRouter()

ORG_ID = "demo_agency"


@router.get("/notifications/pending")
def get_pending_notifications():
    notifications = list_pending_notifications(
        org_id=ORG_ID,
    )

    return {
        "status": "ok",
        "count": len(notifications),
        "notifications": notifications,
    }


@router.post("/notifications/{notification_id}/mark-sent")
def mark_notification_sent(notification_id: str):
    notification = mark_notification_as_sent(
        org_id=ORG_ID,
        notification_id=notification_id,
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    if notification.get("dossier_id"):
        create_dossier_event(
            org_id=ORG_ID,
            dossier_id=str(notification["dossier_id"]),
            event_type="NOTIFICATION_MARKED_SENT",
            payload={
                "notification_id": notification_id,
                "status": "SENT",
            },
        )

    return {
        "status": "ok",
        "notification": notification,
    }


@router.post("/notifications/{notification_id}/send")
def send_notification_endpoint(notification_id: str):
    result = send_notification(
        notification_id=notification_id,
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    return result