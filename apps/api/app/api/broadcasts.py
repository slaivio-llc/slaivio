from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.broadcast_repository import (
    create_broadcast,
    get_broadcast,
    list_broadcasts,
    list_broadcast_recipients,
)

from app.services.broadcast_service import (
    add_manual_recipients,
    add_recipients_from_target,
    queue_broadcast_notifications,
)


router = APIRouter()

ORG_ID = "demo_agency"


class CreateBroadcastRequest(BaseModel):
    title: str
    message: str
    broadcast_type: str = "GENERAL"
    target_type: str = "MANUAL"
    created_by: str | None = None
    scheduled_at: str | None = None


class AddManualRecipientsRequest(BaseModel):
    phones: list[str]


class AddTargetRecipientsRequest(BaseModel):
    target_type: str
    status_global: str | None = None


@router.post("/broadcasts")
def create_new_broadcast(body: CreateBroadcastRequest):
    broadcast = create_broadcast(
        org_id=ORG_ID,
        title=body.title,
        message=body.message,
        broadcast_type=body.broadcast_type,
        target_type=body.target_type,
        created_by=body.created_by,
        scheduled_at=body.scheduled_at,
    )

    return {
        "status": "ok",
        "broadcast": broadcast,
    }


@router.get("/broadcasts")
def get_broadcasts(
    status: str | None = None,
    limit: int = 100,
):
    broadcasts = list_broadcasts(
        org_id=ORG_ID,
        status=status,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(broadcasts),
        "broadcasts": broadcasts,
    }


@router.get("/broadcasts/{broadcast_id}")
def get_one_broadcast(broadcast_id: str):
    broadcast = get_broadcast(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
    )

    if not broadcast:
        raise HTTPException(
            status_code=404,
            detail="Broadcast not found",
        )

    recipients = list_broadcast_recipients(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
    )

    return {
        "status": "ok",
        "broadcast": broadcast,
        "recipients_count": len(recipients),
        "recipients": recipients,
    }


@router.post("/broadcasts/{broadcast_id}/recipients/manual")
def add_manual(
    broadcast_id: str,
    body: AddManualRecipientsRequest,
):
    broadcast = get_broadcast(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
    )

    if not broadcast:
        raise HTTPException(
            status_code=404,
            detail="Broadcast not found",
        )

    recipients = add_manual_recipients(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
        phones=body.phones,
    )

    return {
        "status": "ok",
        "count": len(recipients),
        "recipients": recipients,
    }


@router.post("/broadcasts/{broadcast_id}/recipients/target")
def add_target(
    broadcast_id: str,
    body: AddTargetRecipientsRequest,
):
    broadcast = get_broadcast(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
    )

    if not broadcast:
        raise HTTPException(
            status_code=404,
            detail="Broadcast not found",
        )

    recipients = add_recipients_from_target(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
        target_type=body.target_type,
        status_global=body.status_global,
    )

    return {
        "status": "ok",
        "count": len(recipients),
        "recipients": recipients,
    }


@router.post("/broadcasts/{broadcast_id}/queue")
def queue_broadcast(broadcast_id: str):
    result = queue_broadcast_notifications(
        org_id=ORG_ID,
        broadcast_id=broadcast_id,
    )

    if result["status"] == "error":
        raise HTTPException(
            status_code=404,
            detail=result["message"],
        )

    return result
