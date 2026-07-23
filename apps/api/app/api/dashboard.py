from fastapi import APIRouter, Depends

from app.core.auth import get_current_manager
from app.dashboard.repository import get_dashboard_overview
from app.tenant.services.tenant_service import get_tenant_context


router = APIRouter()


def _resolve_active_tenant(manager: dict) -> dict:
    user_id = manager.get("user_id") or manager.get("id")

    try:
        context = get_tenant_context(user_id)
        active = context.get("active_tenant")
        if active:
            return {
                "org_id": active.get("org_id"),
                "organization_name": active.get("organization_name"),
            }
    except Exception:
        pass

    return {
        "org_id": manager.get("tenant_org_id") or manager.get("org_id"),
        "organization_name": manager.get("org_code") or manager.get("org_id"),
    }


@router.get("/dashboard/overview")
def dashboard_overview(manager=Depends(get_current_manager)):
    tenant = _resolve_active_tenant(manager)
    return get_dashboard_overview(
        org_id=tenant.get("org_id"),
        organization_name=tenant.get("organization_name"),
        manager=manager,
    )
