from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai.repositories.dossier_draft_repository import (
    get_dossier_draft,
    list_dossier_drafts,
    update_dossier_draft_status,
)
from app.ai.services.dossier_draft_service import (
    prepare_dossier_draft_from_message,
)
from app.ai.services.dossier_execution_service import execute_dossier_draft


router = APIRouter()
ORG_ID = "demo_agency"


class PrepareDossierDraftRequest(BaseModel):
    source_message: str
    workflow_id: str | None = None
    manager_id: str | None = None
    manager_name: str | None = None


class UpdateDraftStatusRequest(BaseModel):
    status: str


@router.post("/inbox/conversations/{phone}/ai-dossier-draft")
def create_ai_dossier_draft(
    phone: str,
    body: PrepareDossierDraftRequest,
):
    return prepare_dossier_draft_from_message(
        org_id=ORG_ID,
        client_phone=phone,
        source_message=body.source_message,
        workflow_id=body.workflow_id,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )


@router.get("/inbox/conversations/{phone}/ai-dossier-drafts")
def get_ai_dossier_drafts(phone: str):
    return {
        "status": "ok",
        "drafts": list_dossier_drafts(
            org_id=ORG_ID,
            client_phone=phone,
        ),
    }


@router.patch("/ai-dossier-drafts/{draft_id}/status")
def change_ai_dossier_draft_status(
    draft_id: str,
    body: UpdateDraftStatusRequest,
):
    return {
        "status": "ok",
        "draft": update_dossier_draft_status(
            draft_id=draft_id,
            status=body.status,
        ),
    }


@router.post("/ai-dossier-drafts/{draft_id}/execute")
def execute_draft(draft_id: str):
    draft = get_dossier_draft(draft_id)

    if not draft:
        raise HTTPException(
            status_code=404,
            detail="AI dossier draft not found",
        )

    return execute_dossier_draft(draft)

