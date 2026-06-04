from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.repositories.draft_response_repository import (
    list_ai_drafts,
    mark_ai_draft_used,
)
from app.ai.services.draft_assistant import generate_inbox_draft


router = APIRouter()
ORG_ID = "demo_agency"


class GenerateDraftRequest(BaseModel):
    source_message: str
    manager_id: str | None = None
    manager_name: str | None = None


@router.post("/inbox/conversations/{phone}/ai-draft")
def create_draft(
    phone: str,
    body: GenerateDraftRequest,
):
    return generate_inbox_draft(
        org_id=ORG_ID,
        client_phone=phone,
        source_message=body.source_message,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )


@router.get("/inbox/conversations/{phone}/ai-drafts")
def get_drafts(phone: str):
    return {
        "status": "ok",
        "drafts": list_ai_drafts(
            org_id=ORG_ID,
            client_phone=phone,
        ),
    }


@router.patch("/ai-drafts/{draft_id}/used")
def mark_used(draft_id: str):
    return {
        "status": "ok",
        "draft": mark_ai_draft_used(draft_id),
    }

