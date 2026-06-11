from fastapi import APIRouter, Depends

from app.commercial.repositories.commercial_repository import (
    list_commercial_cases,
    list_commercial_tasks,
    list_procurements,
    list_quotations,
    list_restrictions,
)
from app.commercial.schemas.commercial_schemas import (
    CommercialMessageRequest,
    ProcurementRequestIn,
    QuoteRequestIn,
    RestrictionCheckRequestIn,
)
from app.commercial.services.commercial_orchestrator import (
    handle_commercial_message,
)
from app.commercial.services.procurement_service import create_procurement_flow
from app.commercial.services.quote_service import create_quote_flow
from app.commercial.services.restriction_service import create_restriction_flow
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant


router = APIRouter()


@router.post(
    "/commercial/message",
    dependencies=[
        Depends(require_permission("commercial.manage")),
    ],
)
def process_commercial_message(
    body: CommercialMessageRequest,
    tenant=Depends(get_current_tenant),
):
    result = handle_commercial_message(
        org_id=tenant["org_id"],
        phone=body.phone,
        message=body.message,
        source_channel=body.source_channel,
    )

    return {
        "status": "ok",
        "result": result,
    }


@router.post(
    "/commercial/quotes",
    dependencies=[
        Depends(require_permission("commercial.manage")),
    ],
)
def create_quote(
    body: QuoteRequestIn,
    tenant=Depends(get_current_tenant),
):
    result = create_quote_flow(
        org_id=tenant["org_id"],
        fields=body.model_dump(),
        source_channel="dashboard",
    )

    return {
        "status": "ok",
        "result": result,
    }


@router.post(
    "/commercial/procurements",
    dependencies=[
        Depends(require_permission("commercial.manage")),
    ],
)
def create_procurement(
    body: ProcurementRequestIn,
    tenant=Depends(get_current_tenant),
):
    result = create_procurement_flow(
        org_id=tenant["org_id"],
        fields=body.model_dump(),
        source_channel="dashboard",
    )

    return {
        "status": "ok",
        "result": result,
    }


@router.post(
    "/commercial/restrictions",
    dependencies=[
        Depends(require_permission("commercial.manage")),
    ],
)
def create_restriction_check(
    body: RestrictionCheckRequestIn,
    tenant=Depends(get_current_tenant),
):
    result = create_restriction_flow(
        org_id=tenant["org_id"],
        fields=body.model_dump(),
        source_channel="dashboard",
    )

    return {
        "status": "ok",
        "result": result,
    }


@router.get(
    "/commercial/cases",
    dependencies=[
        Depends(require_permission("commercial.read")),
    ],
)
def get_commercial_cases(
    status: str | None = None,
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    cases = list_commercial_cases(
        org_id=tenant["org_id"],
        status=status,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(cases),
        "cases": cases,
    }


@router.get(
    "/commercial/quotes",
    dependencies=[
        Depends(require_permission("commercial.read")),
    ],
)
def get_commercial_quotes(
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    quotations = list_quotations(
        org_id=tenant["org_id"],
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(quotations),
        "quotes": quotations,
    }


@router.get(
    "/commercial/procurements",
    dependencies=[
        Depends(require_permission("commercial.read")),
    ],
)
def get_procurements(
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    procurements = list_procurements(
        org_id=tenant["org_id"],
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(procurements),
        "procurements": procurements,
    }


@router.get(
    "/commercial/restrictions",
    dependencies=[
        Depends(require_permission("commercial.read")),
    ],
)
def get_restrictions(
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    restrictions = list_restrictions(
        org_id=tenant["org_id"],
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(restrictions),
        "restrictions": restrictions,
    }


@router.get(
    "/commercial/tasks",
    dependencies=[
        Depends(require_permission("commercial.read")),
    ],
)
def get_commercial_tasks(
    status: str | None = None,
    limit: int = 100,
    tenant=Depends(get_current_tenant),
):
    tasks = list_commercial_tasks(
        org_id=tenant["org_id"],
        status=status,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(tasks),
        "tasks": tasks,
    }
