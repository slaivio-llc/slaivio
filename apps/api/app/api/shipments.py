from fastapi import APIRouter, HTTPException
from app.db.message_repository import get_dossier_full, create_dossier_event
from app.db.shipment_repository import create_shipment, update_shipment_status
from pydantic import BaseModel
from app.db.shipment_repository import create_shipment, update_shipment_status

router = APIRouter()

class UpdateShipmentStatusRequest(BaseModel):
    status: str


@router.patch("/shipments/{shipment_id}/status")
def update_status(shipment_id: str, body: UpdateShipmentStatusRequest):
    shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=shipment_id,
        new_status=body.status,
    )

    if not shipment:
        raise HTTPException(status_code=400, detail="Invalid status or shipment not found")

    if shipment.get("dossier_id"):
        create_dossier_event(
            org_id="demo_agency",
            dossier_id=str(shipment["dossier_id"]),
            event_type="SHIPMENT_STATUS_UPDATED",
            payload={
                "shipment_id": str(shipment["id"]),
                "tracking_id": shipment["tracking_id"],
                "new_status": shipment["status"],
            },
        )

    return {
        "status": "ok",
        "shipment": shipment,
    }

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