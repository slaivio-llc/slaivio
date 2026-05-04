from fastapi import APIRouter, HTTPException
from app.db.message_repository import get_dossier_full, create_dossier_event
from app.db.shipment_repository import create_shipment

router = APIRouter()


@router.post("/shipments/{dossier_id}")
def create_shipment_from_dossier(dossier_id: str):
    dossier = get_dossier_full(
        org_id="demo_agency",
        dossier_id=dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    shipment = create_shipment(
        org_id="demo_agency",
        dossier=dossier,
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=dossier_id,
        event_type="SHIPMENT_CREATED",
        payload={
            "shipment_id": str(shipment["id"]),
            "tracking_id": shipment["tracking_id"],
        },
    )

    return {
        "status": "ok",
        "shipment": shipment,
    }