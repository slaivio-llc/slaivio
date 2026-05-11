
from fastapi import APIRouter, HTTPException

from app.db.followup_repository import (
    list_due_followups,
    mark_followup_executed,
    get_followup_with_client_phone,
)
from app.db.notification_repository import create_notification_outbox


router = APIRouter()

ORG_ID = "demo_agency"


@router.get("/followups/due")
def get_due_followups():
    followups = list_due_followups(
        org_id=ORG_ID,
    )

    return {
        "status": "ok",
        "count": len(followups),
        "followups": followups,
    }


@router.post("/followups/{followup_id}/execute")
def execute_followup(followup_id: str):
    followup = get_followup_with_client_phone(
        org_id=ORG_ID,
        followup_id=followup_id,
    )

    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")

    if followup["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Followup already processed")

    if not followup.get("client_phone"):
        raise HTTPException(status_code=400, detail="Client phone not found")

    notification = create_notification_outbox(
        org_id=ORG_ID,
        client_id=followup["client_id"],
        dossier_id=followup["dossier_id"],
        recipient_phone=followup["client_phone"],
        notification_type=f"FOLLOWUP:{followup['followup_type']}",
        message=followup["message"],
    )

    executed_followup = mark_followup_executed(
        org_id=ORG_ID,
        followup_id=followup_id,
    )

    return {
        "status": "ok",
        "followup": executed_followup,
        "notification": notification,
    }
