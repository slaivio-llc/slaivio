from fastapi import APIRouter, HTTPException
from app.db.followup_repository import list_due_followups, mark_followup_executed
from app.db.notification_repository import create_notification_outbox

router = APIRouter()


@router.get("/followups/due")
def get_due_followups():
    followups = list_due_followups()

    return {
        "status": "ok",
        "count": len(followups),
        "followups": followups,
    }


@router.post("/followups/{followup_id}/execute")
def execute_followup(followup_id: str):
    followup = mark_followup_executed(followup_id)

    if not followup:
        raise HTTPException(status_code=404, detail="Followup not found")

    notification = create_notification_outbox(
        org_id=followup["org_id"],
        client_id=followup["client_id"],
        dossier_id=followup["dossier_id"],
        recipient_phone="",  # on améliorera en récupérant le téléphone client à l’étape suivante
        notification_type=f"FOLLOWUP:{followup['followup_type']}",
        message=followup["message"],
    )

    return {
        "status": "ok",
        "followup": followup,
        "notification": notification,
    }