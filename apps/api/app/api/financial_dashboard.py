from fastapi import APIRouter, Depends

from app.financial.repositories.audit_repository import list_financial_audit_logs
from app.financial.repositories.financial_event_repository import list_financial_events
from app.financial.services.financial_dashboard_service import get_financial_dashboard
from app.core.permissions import require_permission


router = APIRouter()
ORG_ID = "demo_agency"


@router.get(
    "/financial/dashboard",
    dependencies=[
        Depends(require_permission("finance.read")),
    ],
)
def financial_dashboard():
    return {
        "status": "ok",
        "dashboard": get_financial_dashboard(ORG_ID),
    }


@router.get(
    "/financial/events",
    dependencies=[
        Depends(require_permission("finance.read")),
    ],
)
def financial_events():
    return {
        "status": "ok",
        "events": list_financial_events(ORG_ID),
    }


@router.get(
    "/financial/audit-logs",
    dependencies=[
        Depends(require_permission("audit.read")),
    ],
)
def financial_audit_logs():
    return {
        "status": "ok",
        "logs": list_financial_audit_logs(ORG_ID),
    }
