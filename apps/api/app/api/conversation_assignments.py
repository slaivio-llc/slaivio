from fastapi import APIRouter
from pydantic import BaseModel

from app.db.conversation_assignment_repository import (
    get_assignment,
    upsert_assignment,
)
from app.db.conversation_timeline_repository import create_timeline_event


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
    previous = get_assignment(
        org_id=ORG_ID,
        client_phone=phone,
    )

    assignment = upsert_assignment(
        org_id=ORG_ID,
        client_phone=phone,
        assigned_manager_id=body.assigned_manager_id,
        assigned_manager_name=body.assigned_manager_name,
        status=body.status,
        priority=body.priority,
        last_note=body.last_note,
    )

    if previous is None:
        create_timeline_event(
            org_id=ORG_ID,
            client_phone=phone,
            event_type="ASSIGNED",
            event_title="Conversation assignee",
            event_payload={
                "assigned_manager_id": body.assigned_manager_id,
                "assigned_manager_name": body.assigned_manager_name,
                "status": body.status,
                "priority": body.priority,
            },
            created_by_id=body.assigned_manager_id,
            created_by_name=body.assigned_manager_name,
        )
    else:
        if previous.get("assigned_manager_id") != body.assigned_manager_id:
            create_timeline_event(
                org_id=ORG_ID,
                client_phone=phone,
                event_type="ASSIGNED",
                event_title="Responsable modifie",
                event_payload={
                    "previous_manager_id": previous.get(
                        "assigned_manager_id"
                    ),
                    "new_manager_id": body.assigned_manager_id,
                    "previous_manager_name": previous.get(
                        "assigned_manager_name"
                    ),
                    "new_manager_name": body.assigned_manager_name,
                },
                created_by_id=body.assigned_manager_id,
                created_by_name=body.assigned_manager_name,
            )

        if previous.get("status") != body.status:
            create_timeline_event(
                org_id=ORG_ID,
                client_phone=phone,
                event_type="STATUS_CHANGED",
                event_title="Statut modifie",
                event_payload={
                    "previous_status": previous.get("status"),
                    "new_status": body.status,
                },
                created_by_id=body.assigned_manager_id,
                created_by_name=body.assigned_manager_name,
            )

        if previous.get("priority") != body.priority:
            create_timeline_event(
                org_id=ORG_ID,
                client_phone=phone,
                event_type="PRIORITY_CHANGED",
                event_title="Priorite modifiee",
                event_payload={
                    "previous_priority": previous.get("priority"),
                    "new_priority": body.priority,
                },
                created_by_id=body.assigned_manager_id,
                created_by_name=body.assigned_manager_name,
            )

    return {
        "status": "ok",
        "assignment": assignment,
    }
