from fastapi import Depends, HTTPException

from app.core.auth import get_current_manager
from app.tenant.services.tenant_service import get_tenant_context


def get_current_tenant(
    manager=Depends(get_current_manager),
):
    user_id = (
        manager.get("user_id")
        or manager.get("id")
    )
    context = get_tenant_context(user_id)
    active = context.get("active_tenant")

    if not active:
        fallback_org_id = (
            manager.get("tenant_org_id")
            or manager.get("org_id")
        )

        if fallback_org_id:
            return {
                "org_id": fallback_org_id,
                "organization_name": manager.get("org_code") or fallback_org_id,
                "clerk_org_id": manager.get("clerk_org_id"),
                "user_id": user_id,
            }

        raise HTTPException(
            status_code=403,
            detail="No active tenant",
        )

    return {
        "org_id": active["org_id"],
        "organization_name": active.get("organization_name"),
        "clerk_org_id": active.get("clerk_org_id"),
        "user_id": user_id,
    }

