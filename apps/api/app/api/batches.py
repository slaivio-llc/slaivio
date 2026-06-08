from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.db.batch_repository import (
    create_batch,
    list_batches,
    get_batch,
    update_batch_status,
    create_batch_event,
    assign_shipment_to_batch,
    list_batch_shipments,
    update_shipments_status_for_batch,
)

from app.services.batch_notification_service import create_batch_notifications


router = APIRouter()


class CreateBatchRequest(BaseModel):
    batch_name: str
    origin_country: str | None = None
    origin_city: str | None = None
    destination_country: str | None = None
    destination_city: str | None = None
    shipping_mode: str | None = None
    planned_departure_at: str | None = None
    planned_arrival_at: str | None = None
    public_note: str | None = None
    internal_note: str | None = None


class UpdateBatchStatusRequest(BaseModel):
    status: str
    delay_reason: str | None = None
    public_note: str | None = None
    internal_note: str | None = None
    update_shipments: bool = True
    notify_clients: bool = True


class AssignShipmentRequest(BaseModel):
    shipment_id: str


def map_batch_status_to_shipment_status(batch_status: str) -> str | None:
    mapping = {
        "READY_FOR_DEPARTURE": "READY_FOR_DEPARTURE",
        "DEPARTED": "DEPARTED",
        "IN_TRANSIT": "IN_TRANSIT",
        "ARRIVED_HUB": "ARRIVED_HUB",
        "ARRIVED_DESTINATION": "ARRIVED_DESTINATION",
        "COMPLETED": "DELIVERED",
        "DELAYED": "IN_TRANSIT",
        "BLOCKED": "BLOCKED",
        "CANCELLED": "CANCELLED",
    }

    return mapping.get(batch_status.upper())


@router.post("/batches")
def create_new_batch(
    body: CreateBatchRequest,
    tenant: dict = Depends(get_current_tenant),
):
    batch = create_batch(
        org_id=tenant["org_id"],
        batch_name=body.batch_name,
        origin_country=body.origin_country,
        origin_city=body.origin_city,
        destination_country=body.destination_country,
        destination_city=body.destination_city,
        shipping_mode=body.shipping_mode,
        planned_departure_at=body.planned_departure_at,
        planned_arrival_at=body.planned_arrival_at,
        public_note=body.public_note,
        internal_note=body.internal_note,
    )

    create_batch_event(
        org_id=tenant["org_id"],
        batch_id=str(batch["id"]),
        event_type="BATCH_CREATED",
        payload={
            "batch_name": batch["batch_name"],
            "status": batch["status"],
        },
    )

    return {
        "status": "ok",
        "batch": batch,
    }


@router.get("/batches")
def get_batches(
    status: str | None = None,
    limit: int = 100,
    tenant: dict = Depends(get_current_tenant),
):
    batches = list_batches(
        org_id=tenant["org_id"],
        status=status,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(batches),
        "batches": batches,
    }


@router.get("/batches/{batch_id}")
def get_one_batch(
    batch_id: str,
    tenant: dict = Depends(get_current_tenant),
):
    batch = get_batch(
        org_id=tenant["org_id"],
        batch_id=batch_id,
    )

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Batch not found",
        )

    shipments = list_batch_shipments(
        org_id=tenant["org_id"],
        batch_id=batch_id,
    )

    return {
        "status": "ok",
        "batch": batch,
        "shipments_count": len(shipments),
        "shipments": shipments,
    }


@router.post("/batches/{batch_id}/shipments")
def assign_shipment(
    batch_id: str,
    body: AssignShipmentRequest,
    tenant: dict = Depends(get_current_tenant),
):
    batch = get_batch(
        org_id=tenant["org_id"],
        batch_id=batch_id,
    )

    if not batch:
        raise HTTPException(
            status_code=404,
            detail="Batch not found",
        )

    shipment = assign_shipment_to_batch(
        org_id=tenant["org_id"],
        shipment_id=body.shipment_id,
        batch_id=batch_id,
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    create_batch_event(
        org_id=tenant["org_id"],
        batch_id=batch_id,
        event_type="SHIPMENT_ASSIGNED_TO_BATCH",
        payload={
            "shipment_id": body.shipment_id,
            "tracking_id": shipment.get("tracking_id"),
        },
    )

    return {
        "status": "ok",
        "shipment": shipment,
    }


@router.patch("/batches/{batch_id}/status")
def change_batch_status(
    batch_id: str,
    body: UpdateBatchStatusRequest,
    tenant: dict = Depends(get_current_tenant),
):
    batch = update_batch_status(
        org_id=tenant["org_id"],
        batch_id=batch_id,
        status=body.status,
        delay_reason=body.delay_reason,
        public_note=body.public_note,
        internal_note=body.internal_note,
    )

    if not batch:
        raise HTTPException(
            status_code=400,
            detail="Invalid batch status or batch not found",
        )

    create_batch_event(
        org_id=tenant["org_id"],
        batch_id=batch_id,
        event_type="BATCH_STATUS_UPDATED",
        payload={
            "status": batch["status"],
            "delay_reason": body.delay_reason,
            "public_note": body.public_note,
        },
    )

    updated_shipments = []

    if body.update_shipments:
        shipment_status = map_batch_status_to_shipment_status(batch["status"])

        if shipment_status:
            updated_shipments = update_shipments_status_for_batch(
                org_id=tenant["org_id"],
                batch_id=batch_id,
                shipment_status=shipment_status,
            )

            create_batch_event(
                org_id=tenant["org_id"],
                batch_id=batch_id,
                event_type="BATCH_SHIPMENTS_STATUS_UPDATED",
                payload={
                    "shipment_status": shipment_status,
                    "count": len(updated_shipments),
                },
            )

    shipments = list_batch_shipments(
        org_id=tenant["org_id"],
        batch_id=batch_id,
    )

    notifications = []

    if body.notify_clients:
        notifications = create_batch_notifications(
            org_id=tenant["org_id"],
            batch=batch,
            shipments=shipments,
        )

        create_batch_event(
            org_id=tenant["org_id"],
            batch_id=batch_id,
            event_type="BATCH_NOTIFICATIONS_CREATED",
            payload={
                "count": len(notifications),
            },
        )

    return {
        "status": "ok",
        "batch": batch,
        "updated_shipments_count": len(updated_shipments),
        "notifications_count": len(notifications),
    }
