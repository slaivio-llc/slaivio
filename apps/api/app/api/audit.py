from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.audit.repositories.audit_repository import list_audit_logs
from app.audit.services.audit_service import audit_event
from app.core.auth import get_current_manager
from app.core.permissions import require_permission


router = APIRouter()


class AuditRequest(BaseModel):
    entity_type: str
    entity_id: str | None = None
    action: str
    old_data: dict | None = None
    new_data: dict | None = None
    metadata: dict | None = None
    severity: str = "INFO"


@router.post("/audit/test")
def test_audit(
    body: AuditRequest,
    request: Request,
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "log": audit_event(
            org_id=manager["tenant_org_id"],
            actor_id=manager.get("user_id") or manager["id"],
            actor_name=manager.get("full_name") or manager.get("name"),
            actor_role=manager.get("role"),
            entity_type=body.entity_type,
            entity_id=body.entity_id,
            action=body.action,
            old_data=body.old_data,
            new_data=body.new_data,
            metadata=body.metadata,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            severity=body.severity,
        ),
    }


@router.get(
    "/audit/logs",
    dependencies=[
        Depends(require_permission("audit.read")),
    ],
)
def get_audit_logs(
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "logs": list_audit_logs(
            org_id=manager["tenant_org_id"],
        ),
    }

