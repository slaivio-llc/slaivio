from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.repositories.workflow_repository import (
    list_workflow_runs,
    update_workflow_status,
)
from app.ai.services.workflow_engine import prepare_ai_workflow


router = APIRouter()
ORG_ID = "demo_agency"


class PrepareWorkflowRequest(BaseModel):
    source_message: str
    manager_id: str | None = None
    manager_name: str | None = None


class UpdateWorkflowStatusRequest(BaseModel):
    status: str
    result_payload: dict | None = None


@router.post("/inbox/conversations/{phone}/ai-workflow")
def create_workflow(
    phone: str,
    body: PrepareWorkflowRequest,
):
    return prepare_ai_workflow(
        org_id=ORG_ID,
        client_phone=phone,
        source_message=body.source_message,
        manager_id=body.manager_id,
        manager_name=body.manager_name,
    )


@router.get("/inbox/conversations/{phone}/ai-workflows")
def get_workflows(phone: str):
    return {
        "status": "ok",
        "workflows": list_workflow_runs(
            org_id=ORG_ID,
            client_phone=phone,
        ),
    }


@router.patch("/ai-workflows/{workflow_id}/status")
def change_workflow_status(
    workflow_id: str,
    body: UpdateWorkflowStatusRequest,
):
    return {
        "status": "ok",
        "workflow": update_workflow_status(
            workflow_id=workflow_id,
            status=body.status,
            result_payload=body.result_payload,
        ),
    }

