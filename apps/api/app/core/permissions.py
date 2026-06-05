from fastapi import Depends

from app.core.auth import get_current_manager
from app.permissions.services.permission_service import assert_permission


def require_permission(
    permission_code: str,
):
    def dependency(
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

        assert_permission(
            user_id=user_id,
            org_id=org_id,
            permission_code=permission_code,
        )

        return manager

    return dependency

