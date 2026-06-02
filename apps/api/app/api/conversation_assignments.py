from fastapi import APIRouter
from pydantic import BaseModel

from app.db.conversation_assignment_repository import (
    upsert_assignment,
    get_assignment,
)


router = APIRouter()
ORG_ID = "demo_agency"


class AssignmentRequest(BaseModel):
    assigned_manager_id: str | None = None
    assigned_manager_name: str | None = None
    status: str = "OPEN"
    priority: str = "NORMAL"
    last_note: str | None = None


@router.get("/inbox/conversations/{phone}/assignment")
def read_assignment(phone: str):
    assignment = get_assignment(
        org_id=ORG_ID,
        client_phone=phone,
    )

    return {
        "status": "ok",
        "assignment": assignment,
    }


@router.patch("/inbox/conversations/{phone}/assignment")
def update_assignment(
    phone: str,
    body: AssignmentRequest,
):
    assignment = upsert_assignment(
        org_id=ORG_ID,
        client_phone=phone,
        assigned_manager_id=body.assigned_manager_id,
        assigned_manager_name=body.assigned_manager_name,
        status=body.status,
        priority=body.priority,
        last_note=body.last_note,
    )

    return {
        "status": "ok",
        "assignment": assignment,
    }
