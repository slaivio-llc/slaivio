from fastapi import APIRouter
from app.db.notification_repository import list_pending_notifications
from fastapi import HTTPException
from app.db.notification_repository import mark_notification_as_sent
from app.db.message_repository import create_dossier_event

router = APIRouter()


@router.get("/notifications/pending")
def get_pending_notifications():
    notifications = list_pending_notifications()

    return {
        "status": "ok",
        "count": len(notifications),
        "notifications": notifications,
    }

@router.post("/notifications/{notification_id}/mark-sent")
def mark_notification_sent(notification_id: str):
    result = mark_notification_as_sent(notification_id)

    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    create_dossier_event(
        org_id="demo_agency",
        dossier_id=None,  # optionnel ici si tu ne récupères pas dossier_id
        event_type="NOTIFICATION_MARKED_SENT",
        payload={
            "notification_id": notification_id,
            "status": "SENT"
        },
    )

    return {
        "status": "ok",
        "notification": result
    }