from fastapi import APIRouter, Depends

from app.financial.repositories.audit_repository import list_financial_audit_logs
from app.financial.repositories.financial_event_repository import list_financial_events
from app.financial.services.financial_dashboard_service import get_financial_dashboard
from app.core.permissions import require_permission
from app.core.entitlements import require_entitlement
from app.core.features import require_feature
from app.core.tenant_context import get_current_tenant


router = APIRouter()


@router.get(
    "/financial/dashboard",
    dependencies=[
        Depends(require_permission("finance.read")),
        Depends(require_feature("finance_dashboard")),
        Depends(require_entitlement("finance_dashboard")),
    ],
)
def financial_dashboard(
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "dashboard": get_financial_dashboard(org_id),
    }


@router.get(
    "/financial/events",
    dependencies=[
        Depends(require_permission("finance.read")),
        Depends(require_feature("finance_dashboard")),
        Depends(require_entitlement("finance_dashboard")),
    ],
)
def financial_events(
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "events": list_financial_events(org_id),
    }


@router.get(
    "/financial/audit-logs",
    dependencies=[
        Depends(require_permission("audit.read")),
    ],
)
def financial_audit_logs(
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "logs": list_financial_audit_logs(org_id),
    }
