from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.core.tenant_context import get_current_tenant
from app.db.database import engine
from app.db.message_repository import (
    get_dossier_full,
    create_dossier_event,
)
from app.db.shipment_repository import (
    create_shipment,
    set_shipment_total,
)
from app.services.shipment_notification import (
    create_shipment_notification,
    create_payment_reminder_notification,
)
from app.shipment_lifecycle.services.lifecycle_service import (
    change_shipment_status,
)


router = APIRouter()


class UpdateShipmentStatusRequest(BaseModel):
    status: str
    notes: str | None = None


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


@router.get("/shipments")
def list_shipments(
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    s.id,
                    s.org_id,
                    s.client_id,
                    s.dossier_id,
                    s.tracking_id,
                    s.status,
                    s.current_status,
                    s.eta_at,
                    s.current_batch_id,
                    s.batch_status,
                    s.customs_status,
                    s.delay_status,
                    s.inventory_status,
                    s.delivery_status,
                    s.final_release_status,
                    s.origin_country,
                    s.origin_city,
                    s.destination_country,
                    s.destination_city,
                    s.goods_type,

                    s.weight_kg as estimated_weight_kg,
                    s.weight_kg as actual_weight_kg,
                    s.volume_cbm as estimated_volume_cbm,
                    s.volume_cbm as actual_volume_cbm,

                    s.fees_total as final_total,
                    s.currency as final_currency,

                    c.phone as client_phone,
                    c.name as client_name,

                    d.case_type,
                    d.status_global as dossier_status,

                    s.created_at,
                    s.updated_at
                from shipments s
                left join clients c
                    on c.id = s.client_id
                left join dossiers d
                    on d.id = s.dossier_id
                where s.org_id = :org_id
                order by s.created_at desc
            """),
            {"org_id": org_id},
        ).fetchall()

    return {
        "status": "ok",
        "shipments": [dict(row._mapping) for row in rows],
    }


@router.get("/shipments/{shipment_id}")
def get_shipment(
    shipment_id: str,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    with engine.connect() as conn:
        shipment_row = conn.execute(
            text("""
                select
                    s.id,
                    s.org_id,
                    s.client_id,
                    s.dossier_id,
                    s.tracking_id,
                    s.status,
                    s.current_status,
                    s.eta_at,
                    s.current_batch_id,
                    s.batch_status,
                    s.customs_status,
                    s.delay_status,
                    s.inventory_status,
                    s.delivery_status,
                    s.final_release_status,
                    s.origin_country,
                    s.origin_city,
                    s.destination_country,
                    s.destination_city,
                    s.goods_type,

                    s.weight_kg as estimated_weight_kg,
                    s.weight_kg as actual_weight_kg,
                    s.volume_cbm as estimated_volume_cbm,
                    s.volume_cbm as actual_volume_cbm,

                    s.fees_total as final_total,
                    s.currency as final_currency,

                    c.phone as client_phone,
                    c.name as client_name,

                    d.case_type,
                    d.status_global as dossier_status,

                    s.created_at,
                    s.updated_at
                from shipments s
                left join clients c
                    on c.id = s.client_id
                left join dossiers d
                    on d.id = s.dossier_id
                where s.org_id = :org_id
                  and s.id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        ).fetchone()

        if not shipment_row:
            raise HTTPException(status_code=404, detail="Shipment not found")

        timeline_rows = conn.execute(
            text("""
                select
                    id,
                    event_type,
                    event_payload,
                    created_at
                from shipment_timeline_events
                where shipment_id = :shipment_id
                order by created_at desc
            """),
            {"shipment_id": shipment_id},
        ).fetchall()

        media_rows = conn.execute(
            text("""
                select
                    id,
                    media_type,
                    media_url,
                    caption,
                    content_type,
                    created_at
                from shipment_media
                where shipment_id = :shipment_id
                order by created_at desc
            """),
            {"shipment_id": shipment_id},
        ).fetchall()

    return {
        "status": "ok",
        "shipment": dict(shipment_row._mapping),
        "timeline": [dict(row._mapping) for row in timeline_rows],
        "media": [dict(row._mapping) for row in media_rows],
    }


@router.post("/shipments/{dossier_id}")
def create_shipment_from_dossier(
    dossier_id: str,
    body: CreateShipmentRequest | None = None,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    dossier = get_dossier_full(
        org_id=org_id,
        dossier_id=dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    weight_kg = body.weight_kg if body else None
    volume_cbm = body.volume_cbm if body else None

    shipment = create_shipment(
        org_id=org_id,
        dossier_id=dossier_id,
        weight_kg=weight_kg,
        volume_cbm=volume_cbm,
    )

    if not shipment:
        raise HTTPException(status_code=500, detail="Shipment creation failed")

    create_dossier_event(
        org_id=org_id,
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
def update_status(
    shipment_id: str,
    body: UpdateShipmentStatusRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    lifecycle_result = change_shipment_status(
        org_id=org_id,
        shipment_id=shipment_id,
        next_status=body.status,
        event_type="STATUS_CHANGE",
        event_source="MANAGER",
        event_message=body.notes or "Shipment updated",
        metadata={
            "legacy_endpoint": "/shipments/{shipment_id}/status",
        },
        actor_id="demo_manager",
        actor_name="Demo Manager",
    )
    shipment = lifecycle_result["shipment"]

    if not shipment:
        raise HTTPException(
            status_code=400,
            detail="Invalid status or shipment not found",
        )

    dossier_id = str(shipment["dossier_id"])

    create_dossier_event(
        org_id=org_id,
        dossier_id=dossier_id,
        event_type="SHIPMENT_STATUS_UPDATED",
        payload={
            "shipment_id": str(shipment["id"]),
            "tracking_id": shipment["tracking_id"],
            "new_status": shipment["status"],
            "notes": body.notes,
        },
    )

    dossier = get_dossier_full(
        org_id=org_id,
        dossier_id=dossier_id,
    )

    client_phone = get_client_phone_from_dossier(dossier)

    notification = None

    if client_phone:
        notification = create_shipment_notification(
            org_id=org_id,
            shipment=shipment,
            client_phone=client_phone,
        )

        if notification:
            create_dossier_event(
                org_id=org_id,
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
            org_id=org_id,
            shipment=shipment,
            client_phone=client_phone,
        )

        if payment_notification:
            create_dossier_event(
                org_id=org_id,
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
def set_total(
    shipment_id: str,
    body: SetTotalRequest,
    tenant=Depends(get_current_tenant),
):
    org_id = tenant["org_id"]

    shipment = set_shipment_total(
        org_id=org_id,
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
