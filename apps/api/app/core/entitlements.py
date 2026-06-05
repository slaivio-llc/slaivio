from fastapi import Depends

from app.core.tenant_context import get_current_tenant
from app.entitlements.services.entitlement_service import assert_entitlement_enabled


def require_entitlement(
    entitlement_key: str,
):
    def dependency(
        tenant=Depends(get_current_tenant),
    ):
        assert_entitlement_enabled(
            org_id=tenant["org_id"],
            entitlement_key=entitlement_key,
        )

        return True

    return dependency

