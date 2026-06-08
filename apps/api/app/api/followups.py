
from fastapi import APIRouter, Depends, HTTPException

from app.core.tenant_context import get_current_tenant
from app.db.followup_repository import (
    list_due_followups,
    mark_followup_executed,
    get_followup_with_client_phone,
)
from app.db.notification_repository import create_notification_outbox


router = APIRouter()


@router.get("/followups/due")
def get_due_followups(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    followups = list_due_followups(
        org_id=org_id,
    )

    return {
        "status": "ok",
        "count": len(followups),
        "followups": followups,
    }


@router.post("/followups/{followup_id}/execute")
def execute_followup(followup_id: str, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    followup = get_followup_with_client_phone(
        org_id=org_id,
        followup_id=followup_id,
    )

    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")

    if followup["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Followup already processed")

    if not followup.get("client_phone"):
        raise HTTPException(status_code=400, detail="Client phone not found")

    notification = create_notification_outbox(
        org_id=org_id,
        client_id=followup["client_id"],
        dossier_id=followup["dossier_id"],
        recipient_phone=followup["client_phone"],
        notification_type=f"FOLLOWUP:{followup['followup_type']}",
        message=followup["message"],
    )

    executed_followup = mark_followup_executed(
        org_id=org_id,
        followup_id=followup_id,
    )

    return {
        "status": "ok",
        "followup": executed_followup,
        "notification": notification,
    }
