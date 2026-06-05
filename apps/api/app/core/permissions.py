from fastapi import Depends

from app.core.auth import get_current_manager
from app.core.tenant_context import get_current_tenant
from app.permissions.services.permission_service import assert_permission


def require_permission(
    permission_code: str,
):
    def dependency(
        manager=Depends(get_current_manager),
        tenant=Depends(get_current_tenant),
    ):
        user_id = (
            manager.get("user_id")
            or manager.get("id")
        )
        org_id = tenant["org_id"]

        assert_permission(
            user_id=user_id,
            org_id=org_id,
            permission_code=permission_code,
        )

        return manager

    return dependency
