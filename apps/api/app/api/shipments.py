from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.message_repository import (
    get_dossier_full,
    create_dossier_event,
)
from app.db.shipment_repository import (
    create_shipment,
    update_shipment_status,
    set_shipment_total,
)
from app.services.shipment_notification import (
    create_shipment_notification,
    create_payment_reminder_notification,
)


router = APIRouter()

ORG_ID = "demo_agency"


class UpdateShipmentStatusRequest(BaseModel):
    status: str


class SetTotalRequest(BaseModel):
    total: float
    currency: str


class CreateShipmentRequest(BaseModel):
    weight_kg: float | None = None
    volume_cbm: float | None = None


def get_client_phone_from_dossier(dossier_full: dict) -> str | None:
    if dossier_full and dossier_full.get("client"):
        return dossier_full["client"].get("phone")

    return None


@router.post("/shipments/{dossier_id}")
def create_shipment_from_dossier(
    dossier_id: str,
    body: CreateShipmentRequest | None = None,
):
    dossier = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    weight_kg = body.weight_kg if body else None
    volume_cbm = body.volume_cbm if body else None

    shipment = create_shipment(
        org_id=ORG_ID,
        dossier_id=dossier_id,
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
    )

    if not shipment:
        raise HTTPException(status_code=500, detail="Shipment creation failed")

    create_dossier_event(
        org_id=ORG_ID,
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


@router.patch("/shipments/{shipment_id}/status")
def update_status(shipment_id: str, body: UpdateShipmentStatusRequest):
    shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=shipment_id,
        new_status=body.status,
    )

    if not shipment:
        raise HTTPException(
            status_code=400,
            detail="Invalid status or shipment not found",
        )

    dossier_id = str(shipment["dossier_id"])

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=dossier_id,
        event_type="SHIPMENT_STATUS_UPDATED",
        payload={
            "shipment_id": str(shipment["id"]),
            "tracking_id": shipment["tracking_id"],
            "new_status": shipment["status"],
        },
    )

    dossier = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=dossier_id,
    )

    client_phone = get_client_phone_from_dossier(dossier)

    notification = None

    if client_phone:
        notification = create_shipment_notification(
            org_id=ORG_ID,
            shipment=shipment,
            client_phone=client_phone,
        )

        if notification:
            create_dossier_event(
                org_id=ORG_ID,
                dossier_id=dossier_id,
                event_type="SHIPMENT_NOTIFICATION_CREATED",
                payload={
                    "shipment_id": str(shipment["id"]),
                    "status": shipment["status"],
                    "notification_id": str(notification["id"]),
                },
            )

    payment_notification = None

    if shipment["status"] == "READY_FOR_PICKUP" and client_phone:
        payment_notification = create_payment_reminder_notification(
            org_id=ORG_ID,
            shipment=shipment,
            client_phone=client_phone,
        )

        if payment_notification:
            create_dossier_event(
                org_id=ORG_ID,
                dossier_id=dossier_id,
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


@router.post("/shipments/{shipment_id}/set-total")
def set_total(shipment_id: str, body: SetTotalRequest):
    shipment = set_shipment_total(
        org_id=ORG_ID,
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
