from fastapi import APIRouter, HTTPException

from app.db.notification_repository import list_retryable_notifications
from app.services.notification_retry_service import (
    retry_notification,
    retry_due_notifications,
)


router = APIRouter()

ORG_ID = "demo_agency"


@router.get("/notifications/retryable")
def get_retryable_notifications(limit: int = 50):
    notifications = list_retryable_notifications(
        org_id=ORG_ID,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(notifications),
        "notifications": notifications,
    }


@router.post("/notifications/{notification_id}/retry")
def retry_one_notification(notification_id: str):
    result = retry_notification(notification_id)

    if result.get("status") == "error":
        raise HTTPException(
            status_code=404,
            detail=result.get("message"),
        )

    return result


@router.post("/notifications/retry-due")
def retry_due():
    return retry_due_notifications(
        org_id=ORG_ID,
        limit=50,
    )
