from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.db.conversation_timeline_repository import (
    create_internal_note,
    create_timeline_event,
    list_internal_notes,
    list_timeline_events,
)


router = APIRouter()


class CreateNoteRequest(BaseModel):
    note: str
    manager_id: str | None = None
    manager_name: str | None = None


@router.get("/inbox/conversations/{phone}/notes")
def get_notes(
    phone: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "notes": list_internal_notes(
            org_id=org_id,
            client_phone=phone,
        ),
    }


@router.post("/inbox/conversations/{phone}/notes")
def add_note(
    phone: str,
    body: CreateNoteRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    note = create_internal_note(
        org_id=org_id,
        client_phone=phone,
        note=body.note,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )

    create_timeline_event(
        org_id=org_id,
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
def get_timeline(
    phone: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "events": list_timeline_events(
            org_id=org_id,
            client_phone=phone,
        ),
    }
