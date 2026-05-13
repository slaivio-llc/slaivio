from fastapi import APIRouter

from app.db.shipment_repository import list_shipments_by_phone


router = APIRouter()

ORG_ID = "demo_agency"


@router.get("/clients/by-phone/{phone}/shipments")
def get_client_shipments(
    phone: str,
    include_completed: bool = True,
    limit: int = 20,
):
    shipments = list_shipments_by_phone(
        org_id=ORG_ID,
        phone=phone,
        include_completed=include_completed,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(shipments),
        "shipments": shipments,
    }
