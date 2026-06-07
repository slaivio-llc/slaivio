from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.ai.repositories.draft_response_repository import (
    list_ai_drafts,
    mark_ai_draft_used,
)
from app.ai.services.draft_assistant import generate_inbox_draft


router = APIRouter()


class GenerateDraftRequest(BaseModel):
    source_message: str
    manager_id: str | None = None
    manager_name: str | None = None


@router.post("/inbox/conversations/{phone}/ai-draft")
def create_draft(
    phone: str,
    body: GenerateDraftRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return generate_inbox_draft(
        org_id=org_id,
        client_phone=phone,
        source_message=body.source_message,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )


@router.get("/inbox/conversations/{phone}/ai-drafts")
def get_drafts(
    phone: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "drafts": list_ai_drafts(
            org_id=org_id,
            client_phone=phone,
        ),
    }


@router.patch("/ai-drafts/{draft_id}/used")
def mark_used(draft_id: str):
    return {
        "status": "ok",
        "draft": mark_ai_draft_used(draft_id),
    }
