from fastapi import APIRouter, Depends

from app.core.auth import get_current_manager
from app.permissions.services.permission_service import list_permissions_for_user


router = APIRouter()


@router.get("/permissions/me")
def my_permissions(
    manager=Depends(get_current_manager),
):
    user_id = (
        manager.get("user_id")
        or manager.get("id")
    )
    org_id = (
        manager.get("tenant_org_id")
        or manager.get("org_id")
    )

    return {
        "status": "ok",
        "user_id": user_id,
        "org_id": org_id,
        "legacy_org_id": manager.get("org_code"),
        "permissions": list_permissions_for_user(
            user_id=user_id,
            org_id=org_id,
        ),
    }

