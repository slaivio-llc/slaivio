from fastapi import APIRouter, Depends, HTTPException

from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.operations_intelligence.repositories.insight_repository import (
    dismiss_insight,
    list_insights,
    mark_acknowledged,
    mark_resolved,
)
from app.operations_intelligence.services.detection_service import (
    run_operations_detection,
)


router = APIRouter()


@router.get(
    "/operations/insights",
    dependencies=[
        Depends(require_permission("dashboard.view")),
    ],
)
def get_operations_insights(
    status: str | None = None,
    severity: str | None = None,
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]
    insights = list_insights(
        org_id=org_id,
        status=status,
        severity=severity,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(insights),
        "insights": insights,
    }


@router.post(
    "/operations/insights/run-detection",
    dependencies=[
        Depends(require_permission("operations.write")),
    ],
)
def run_detection(
    tenant=Depends(get_current_tenant),
):
    return run_operations_detection(
        org_id=tenant["org_id"],
    )


@router.post(
    "/operations/insights/{insight_id}/acknowledge",
    dependencies=[
        Depends(require_permission("dashboard.view")),
    ],
)
def acknowledge_insight(
    insight_id: str,
    tenant=Depends(get_current_tenant),
):
    insight = mark_acknowledged(
        org_id=tenant["org_id"],
        insight_id=insight_id,
    )

    if not insight:
        raise HTTPException(
            status_code=404,
            detail="Insight not found",
        )

    return {
        "status": "ok",
        "insight": insight,
    }


@router.post(
    "/operations/insights/{insight_id}/resolve",
    dependencies=[
        Depends(require_permission("dashboard.view")),
    ],
)
def resolve_insight(
    insight_id: str,
    tenant=Depends(get_current_tenant),
):
    insight = mark_resolved(
        org_id=tenant["org_id"],
        insight_id=insight_id,
    )

    if not insight:
        raise HTTPException(
            status_code=404,
            detail="Insight not found",
        )

    return {
        "status": "ok",
        "insight": insight,
    }


@router.post(
    "/operations/insights/{insight_id}/dismiss",
    dependencies=[
        Depends(require_permission("dashboard.view")),
    ],
)
def dismiss_operations_insight(
    insight_id: str,
    tenant=Depends(get_current_tenant),
):
    insight = dismiss_insight(
        org_id=tenant["org_id"],
        insight_id=insight_id,
    )

    if not insight:
        raise HTTPException(
            status_code=404,
            detail="Insight not found",
        )

    return {
        "status": "ok",
        "insight": insight,
    }
