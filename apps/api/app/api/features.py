from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_manager
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.features.repositories.feature_repository import (
    get_org_feature_flags,
    list_feature_flags,
    set_org_feature_flag,
)


router = APIRouter()


class SetFeatureFlagRequest(BaseModel):
    flag_key: str
    enabled: bool
    rollout_percentage: int = 100


@router.get("/features")
def features(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "features": get_org_feature_flags(
            org_id=tenant["org_id"],
        ),
    }


@router.get(
    "/features/all",
    dependencies=[
        Depends(require_permission("settings.read")),
    ],
)
def all_features():
    return {
        "status": "ok",
        "features": list_feature_flags(),
    }


@router.post(
    "/features/set",
    dependencies=[
        Depends(require_permission("settings.write")),
    ],
)
def set_feature(
    body: SetFeatureFlagRequest,
    manager=Depends(get_current_manager),
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "feature": set_org_feature_flag(
            org_id=tenant["org_id"],
            flag_key=body.flag_key,
            enabled=body.enabled,
            rollout_percentage=body.rollout_percentage,
            updated_by_id=manager.get("user_id") or manager.get("id"),
            updated_by_name=manager.get("name") or manager.get("email"),
        ),
    }

