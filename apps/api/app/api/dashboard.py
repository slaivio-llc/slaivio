from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_manager
from app.dashboard.repository import get_dashboard_overview
from app.dashboard.home_repository import (
    get_home,
    mark_all_notifications_read,
    update_resource_preference,
)
from app.tenant.services.tenant_service import get_tenant_context
from app.core.tenant_context import get_current_tenant
from app.permissions.services.permission_service import list_permissions_for_user
from app.dashboard.search_repository import search_home


router = APIRouter()


@router.get('/dashboard/cargo')
def cargo_dashboard(preset: str = '30d', comparison: str = 'previous',
                    start: date | None = None, end: date | None = None,
                    compare_start: date | None = None, compare_end: date | None = None,
                    scope: str = Query('office', pattern='^(office|network)$'),
                    metric: str | None = None, page: int = Query(1, ge=1, le=100000),
                    tenant=Depends(get_current_tenant)):
    from app.dashboard.cargo_overview import cargo_overview
    permissions = list_permissions_for_user(user_id=tenant['user_id'], org_id=tenant['org_id'])
    return cargo_overview(tenant, permissions, preset=preset, comparison=comparison,
                          start=start, end=end, compare_start=compare_start, compare_end=compare_end,
                          scope=scope, metric=metric, page=page)


class ResourcePreferenceBody(BaseModel):
    is_starred: bool | None = None
    opened: bool = False


def _resolve_active_tenant(manager: dict) -> dict:
    user_id = manager.get("user_id") or manager.get("id")

    try:
        context = get_tenant_context(user_id)
        active = context.get("active_tenant")
        if active:
            if active.get("organization_status", "ACTIVE") != "ACTIVE":
                raise HTTPException(status_code=403, detail="organization_access_suspended")
            return {
                "org_id": active.get("org_id"),
                "organization_name": active.get("organization_name"),
            }
    except HTTPException:
        raise
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


@router.get("/dashboard/home")
def dashboard_home(scope: str = Query(default="office", pattern="^(office|network)$"), manager=Depends(get_current_manager)):
    tenant = _resolve_active_tenant(manager)
    return get_home(
        org_id=tenant.get("org_id"),
        user_id=str(manager.get("user_id") or manager.get("id")),
        organization_name=tenant.get("organization_name"),
        manager=manager,
        scope=scope,
    )


@router.patch("/dashboard/home/resources/{resource_key}")
def patch_home_resource(resource_key: str, body: ResourcePreferenceBody, manager=Depends(get_current_manager)):
    tenant = _resolve_active_tenant(manager)
    if not tenant.get("org_id"):
        raise HTTPException(status_code=409, detail="No active organization")
    preference = update_resource_preference(
        org_id=tenant["org_id"],
        user_id=str(manager.get("user_id") or manager.get("id")),
        resource_key=resource_key,
        is_starred=body.is_starred,
        opened=body.opened,
    )
    if not preference:
        raise HTTPException(status_code=404, detail="Unknown home resource")
    return {"status": "ok", "preference": preference}


@router.get("/dashboard/home/search")
def dashboard_home_search(q: str = Query(min_length=2, max_length=100), tenant=Depends(get_current_tenant)):
    permissions = list_permissions_for_user(user_id=tenant['user_id'], org_id=tenant['org_id'])
    return {"status": "ok", "results": search_home(tenant["org_id"], q, permissions)}


@router.patch("/dashboard/home/notifications/read-all")
def dashboard_home_read_all(manager=Depends(get_current_manager)):
    tenant = _resolve_active_tenant(manager)
    if not tenant.get("org_id"):
        raise HTTPException(status_code=409, detail="No active organization")
    return {"status": "ok", "updated": mark_all_notifications_read(tenant["org_id"])}
