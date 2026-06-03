from fastapi import APIRouter
from pydantic import BaseModel

from app.db.conversation_timeline_repository import (
    create_internal_note,
    create_timeline_event,
    list_internal_notes,
    list_timeline_events,
)


router = APIRouter()
ORG_ID = "demo_agency"


class CreateNoteRequest(BaseModel):
    note: str
    manager_id: str | None = None
    manager_name: str | None = None


@router.get("/inbox/conversations/{phone}/notes")
def get_notes(phone: str):
    return {
        "status": "ok",
        "notes": list_internal_notes(
            org_id=ORG_ID,
            client_phone=phone,
        ),
    }


@router.post("/inbox/conversations/{phone}/notes")
def add_note(
    phone: str,
    body: CreateNoteRequest,
):
    note = create_internal_note(
        org_id=ORG_ID,
        client_phone=phone,
        note=body.note,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )

    create_timeline_event(
        org_id=ORG_ID,
        client_phone=phone,
        event_type="NOTE_CREATED",
        event_title="Note interne ajoutee",
        event_payload={
            "note_id": str(note["id"]),
            "note": body.note,
        },
        created_by_id=body.manager_id,
        created_by_name=body.manager_name,
    )

    return {
        "status": "ok",
        "note": note,
    }


@router.get("/inbox/conversations/{phone}/timeline")
def get_timeline(phone: str):
    return {
        "status": "ok",
        "events": list_timeline_events(
            org_id=ORG_ID,
            client_phone=phone,
        ),
    }
