from fastapi import APIRouter
from app.db.notification_repository import list_pending_notifications

router = APIRouter()


@router.get("/notifications/pending")
def get_pending_notifications():
    notifications = list_pending_notifications()

    return {
        "status": "ok",
        "count": len(notifications),
        "notifications": notifications,
    }