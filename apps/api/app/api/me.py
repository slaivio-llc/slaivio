from fastapi import APIRouter, Depends

from app.core.auth import get_current_manager
from app.core.tenant_context import get_current_tenant
from app.permissions.repositories.permission_repository import get_user_permissions


router = APIRouter()


@router.get("/me/permissions")
def my_permissions(
    manager=Depends(get_current_manager),
    tenant=Depends(get_current_tenant),
):
    user_id = manager.get("user_id") or manager.get("id")

    return {
        "status": "ok",
        "user_id": user_id,
        "org_id": tenant["org_id"],
        "permissions": get_user_permissions(
            user_id=user_id,
            org_id=tenant["org_id"],
        ),
    }

