from fastapi import APIRouter, Depends

from app.core.tenant_context import get_current_tenant
from app.db.presence_repository import list_presence


router = APIRouter()


@router.get("/presence")
def get_presence(
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "agents": list_presence(org_id),
    }
