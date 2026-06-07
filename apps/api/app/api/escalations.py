from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.db.escalation_repository import (
    list_escalation_cases,
    get_escalation_case,
    update_escalation_case,
    list_escalation_events,
    create_escalation_event,
)


router = APIRouter()


class UpdateEscalationRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_to: str | None = None
    internal_note: str | None = None


@router.get("/escalations")
def get_escalations(
    status: str | None = None,
    priority: str | None = None,
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    escalations = list_escalation_cases(
        org_id=org_id,
        status=status,
        priority=priority,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(escalations),
        "escalations": escalations,
    }


@router.get("/escalations/{escalation_id}")
def get_escalation(
    escalation_id: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    escalation = get_escalation_case(
        org_id=org_id,
        escalation_id=escalation_id,
    )

    if not escalation:
        raise HTTPException(
            status_code=404,
            detail="Escalation not found",
        )

    events = list_escalation_events(
        org_id=org_id,
        escalation_id=escalation_id,
    )

    return {
        "status": "ok",
        "escalation": escalation,
        "events": events,
    }


@router.patch("/escalations/{escalation_id}")
def update_escalation(
    escalation_id: str,
    body: UpdateEscalationRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    escalation_before = get_escalation_case(
        org_id=org_id,
        escalation_id=escalation_id,
    )

    if not escalation_before:
        raise HTTPException(
            status_code=404,
            detail="Escalation not found",
        )

    escalation = update_escalation_case(
        org_id=org_id,
        escalation_id=escalation_id,
        status=body.status,
        priority=body.priority,
        assigned_to=body.assigned_to,
        internal_note=body.internal_note,
    )

    if not escalation:
        raise HTTPException(
            status_code=400,
            detail="Invalid escalation update",
        )

    create_escalation_event(
        org_id=org_id,
        escalation_id=escalation_id,
        event_type="ESCALATION_UPDATED",
        payload={
            "before_status": escalation_before.get("status"),
            "after_status": escalation.get("status"),
            "priority": escalation.get("priority"),
            "assigned_to": escalation.get("assigned_to"),
        },
    )

    return {
        "status": "ok",
        "escalation": escalation,
    }
