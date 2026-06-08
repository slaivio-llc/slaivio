from fastapi import APIRouter, Depends

from app.core.tenant_context import get_current_tenant
from app.db.shipment_repository import list_shipments_by_phone


router = APIRouter()


@router.get("/clients/by-phone/{phone}/shipments")
def get_client_shipments(
    phone: str,
    include_completed: bool = True,
    limit: int = 20,
    tenant: dict = Depends(get_current_tenant),
):
    shipments = list_shipments_by_phone(
        org_id=tenant["org_id"],
        phone=phone,
        include_completed=include_completed,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(shipments),
        "shipments": shipments,
    }
