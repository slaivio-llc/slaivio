from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.tenant_context import get_current_tenant
from app.core.permissions import require_permission
from app.db.notification_repository import (
    list_pending_notifications,
    list_dispatch_reconciliation,
)
from app.services.notification_sender import send_notification


router = APIRouter()


@router.get("/notifications/reconciliation", dependencies=[Depends(require_permission("inbox.manage"))])
def get_reconciliation_queue(limit: int = Query(default=50, ge=1, le=100), tenant=Depends(get_current_tenant)):
    return {"status": "ok", "notifications": list_dispatch_reconciliation(tenant["org_id"], limit)}


@router.get("/notifications/pending", dependencies=[Depends(require_permission("inbox.read"))])
def get_pending_notifications(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    notifications = list_pending_notifications(
        org_id=org_id,
    )

    return {
        "status": "ok",
        "count": len(notifications),
        "notifications": notifications,
    }


@router.post("/notifications/{notification_id}/mark-sent", dependencies=[Depends(require_permission("inbox.reply"))])
def mark_notification_sent_endpoint(notification_id: str, tenant=Depends(get_current_tenant)):
    # Provider callbacks/dispatch acknowledgements are the only delivery evidence.
    raise HTTPException(status_code=410, detail="manual_delivery_status_not_supported")


@router.post("/notifications/{notification_id}/send", dependencies=[Depends(require_permission("inbox.reply"))])
def send_notification_endpoint(
    notification_id: str,
    tenant=Depends(get_current_tenant),
):
    result = send_notification(
        org_id=tenant["org_id"],
        notification_id=notification_id,
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    return result
