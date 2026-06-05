from fastapi import Depends

from app.core.tenant_context import get_current_tenant
from app.features.services.feature_service import assert_feature_enabled


def require_feature(
    flag_key: str,
):
    def dependency(
        tenant=Depends(get_current_tenant),
    ):
        assert_feature_enabled(
            org_id=tenant["org_id"],
            flag_key=flag_key,
        )

        return True

    return dependency

