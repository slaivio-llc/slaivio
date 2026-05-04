from fastapi import APIRouter, HTTPException
from app.db.message_repository import get_dossier_full, create_dossier_event
from app.db.shipment_repository import create_shipment, update_shipment_status
from pydantic import BaseModel
from app.db.shipment_repository import create_shipment, update_shipment_status
from app.services.shipment_notification import create_shipment_notification
from app.db.message_repository import get_dossier_full
from app.services.shipment_notification import create_payment_reminder_notification

router = APIRouter()

class UpdateShipmentStatusRequest(BaseModel):
    status: str

class SetTotalRequest(BaseModel):
    total: float
    currency: str

class RecordPaymentRequest(BaseModel):
    amount: float


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

    # récupérer téléphone client
    dossier = get_dossier_full(
        org_id="demo_agency",
        dossier_id=str(shipment["dossier_id"]),
    )

    client_phone = dossier.get("client_phone") or dossier.get("phone")

    notification = None

    if client_phone:
        notification = create_shipment_notification(
            org_id="demo_agency",
            shipment=shipment,
            client_phone=client_phone,
        )

        if notification:
            create_dossier_event(
                org_id="demo_agency",
                dossier_id=str(shipment["dossier_id"]),
                event_type="SHIPMENT_NOTIFICATION_CREATED",
                payload={
                    "shipment_id": str(shipment["id"]),
                    "status": shipment["status"],
                    "notification_id": str(notification["id"]),
                },
            )

    payment_notification = None

    if shipment["status"] == "READY_FOR_PICKUP":
        dossier = get_dossier_full(
            org_id="demo_agency",
            dossier_id=str(shipment["dossier_id"]),
        )

        client_phone = dossier.get("client_phone") or dossier.get("phone")

        if client_phone:
            payment_notification = create_payment_reminder_notification(
                org_id="demo_agency",
                shipment=shipment,
                client_phone=client_phone,
            )

            if payment_notification:
                create_dossier_event(
                    org_id="demo_agency",
                    dossier_id=str(shipment["dossier_id"]),
                    event_type="PAYMENT_REMINDER_CREATED",
                    payload={
                        "shipment_id": str(shipment["id"]),
                        "notification_id": str(payment_notification["id"]),
                    },
                )

    return {
        "status": "ok",
        "shipment": shipment,
        "notification": notification,
        "payment_notification": payment_notification,
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

@router.post("/shipments/{shipment_id}/set-total")
def set_total(shipment_id: str, body: SetTotalRequest):
    shipment = set_shipment_total(
        org_id="demo_agency",
        shipment_id=shipment_id,
        total=body.total,
        currency=body.currency,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return {
        "status": "ok",
        "shipment": shipment,
    }