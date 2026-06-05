from fastapi import APIRouter, Depends

from app.core.tenant_context import get_current_tenant
from app.entitlements.repositories.entitlement_repository import get_org_entitlements


router = APIRouter()


@router.get("/entitlements")
def read_entitlements(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        **get_org_entitlements(
            org_id=tenant["org_id"],
        ),
    }

