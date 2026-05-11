from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.db.database import engine
from app.db.message_repository import (
    create_dossier_event,
    get_dossier_full,
    update_dossier_final_pricing,
)
from app.db.shipment_repository import (
    create_shipment,
    get_shipment_by_dossier,
    update_shipment_status,
)
from app.db.notification_repository import create_notification_outbox
from app.db.office_repository import find_office
from app.services.final_pricing_service import calculate_final_price


router = APIRouter()

ORG_ID = "demo_agency"


class ConfirmPackageRequest(BaseModel):
    dossier_id: str
    weight_kg: float | None = None
    volume_cbm: float | None = None
    notes: str | None = None


class ConfirmPaymentRequest(BaseModel):
    dossier_id: str
    payment_method: str | None = None
    notes: str | None = None


class ConfirmDepartureRequest(BaseModel):
    dossier_id: str
    departure_note: str | None = None


class ConfirmArrivalHubRequest(BaseModel):
    dossier_id: str
    hub_name: str | None = None


class ConfirmArrivalDestinationRequest(BaseModel):
    dossier_id: str


class ReadyForPickupRequest(BaseModel):
    dossier_id: str


class ConfirmDeliveredRequest(BaseModel):
    dossier_id: str


def update_dossier_status(dossier_id: str, status_global: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    status_global = :status_global,
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": ORG_ID,
                "dossier_id": dossier_id,
                "status_global": status_global,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_client_phone_from_dossier(dossier_full: dict) -> str | None:
    if dossier_full.get("client"):
        return dossier_full["client"].get("phone")

    return None


@router.post("/manager/confirm-package")
def confirm_package(body: ConfirmPackageRequest):
    dossier = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    shipment = create_shipment(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
    )

    if not shipment:
        raise HTTPException(status_code=500, detail="Shipment creation failed")

    updated_package_dossier = update_dossier_status(
        dossier_id=body.dossier_id,
        status_global="PACKAGE_RECEIVED",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="PACKAGE_RECEIVED",
        payload={
            "weight_kg": body.weight_kg,
            "volume_cbm": body.volume_cbm,
            "notes": body.notes,
            "shipment_id": str(shipment["id"]),
            "tracking_id": shipment["tracking_id"],
        },
    )

    dossier = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    final_price = calculate_final_price(
        org_id=ORG_ID,
        dossier=dossier,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
    )

    updated_pricing_dossier = None

    if final_price:
        updated_pricing_dossier = update_dossier_final_pricing(
            org_id=ORG_ID,
            dossier_id=body.dossier_id,
            total=final_price["total"],
            currency=final_price["currency"],
        )

        create_dossier_event(
            org_id=ORG_ID,
            dossier_id=body.dossier_id,
            event_type="FINAL_PRICE_CALCULATED",
            payload={
                "total": final_price["total"],
                "currency": final_price["currency"],
                "tracking_id": shipment["tracking_id"],
            },
        )

    return {
        "status": "ok",
        "shipment": shipment,
        "updated_package_dossier": updated_package_dossier,
        "final_price": final_price,
        "updated_pricing_dossier": updated_pricing_dossier,
    }


@router.post("/manager/confirm-payment")
def confirm_payment(body: ConfirmPaymentRequest):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    payment_status = 'PAID',
                    status_global = 'READY_FOR_DEPARTURE',
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": ORG_ID,
                "dossier_id": body.dossier_id,
            },
        )

        conn.commit()
        row = result.fetchone()
        updated_dossier = dict(row._mapping) if row else None

    if not updated_dossier:
        raise HTTPException(status_code=404, detail="Dossier not found")

    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if shipment:
        update_shipment_status(
            org_id=ORG_ID,
            shipment_id=str(shipment["id"]),
            new_status="READY_FOR_DEPARTURE",
        )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="PAYMENT_CONFIRMED",
        payload={
            "payment_method": body.payment_method,
            "notes": body.notes,
        },
    )

    return {
        "status": "ok",
        "updated_dossier": updated_dossier,
    }


@router.post("/manager/confirm-departure")
def confirm_departure(body: ConfirmDepartureRequest):
    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    updated_shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=str(shipment["id"]),
        new_status="DEPARTED",
    )

    updated_dossier = update_dossier_status(
        dossier_id=body.dossier_id,
        status_global="IN_TRANSIT",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_DEPARTED",
        payload={
            "shipment_id": str(updated_shipment["id"]),
            "tracking_id": updated_shipment["tracking_id"],
            "departure_note": body.departure_note,
        },
    )

    dossier_full = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    client_phone = get_client_phone_from_dossier(dossier_full)
    notification = None

    if client_phone:
        notification = create_notification_outbox(
            org_id=ORG_ID,
            client_id=updated_shipment["client_id"],
            dossier_id=body.dossier_id,
            recipient_phone=client_phone,
            notification_type="SHIPMENT_DEPARTED",
            message=(
                f"Votre colis ({updated_shipment['tracking_id']}) a quitté le pays d’origine.\n\n"
                "Il est maintenant en cours d’acheminement. "
                "Nous vous informerons dès qu’il arrivera à la prochaine étape."
            ),
        )

        create_dossier_event(
            org_id=ORG_ID,
            dossier_id=body.dossier_id,
            event_type="SHIPMENT_DEPARTURE_NOTIFICATION_CREATED",
            payload={
                "notification_id": str(notification["id"]),
                "tracking_id": updated_shipment["tracking_id"],
            },
        )

    return {
        "status": "ok",
        "shipment": updated_shipment,
        "dossier": updated_dossier,
        "notification": notification,
    }


@router.post("/manager/confirm-arrival-hub")
def confirm_arrival_hub(body: ConfirmArrivalHubRequest):
    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    updated_shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=str(shipment["id"]),
        new_status="ARRIVED_HUB",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_ARRIVED_HUB",
        payload={
            "hub_name": body.hub_name,
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    client_phone = get_client_phone_from_dossier(dossier_full)
    notification = None

    if client_phone:
        notification = create_notification_outbox(
            org_id=ORG_ID,
            client_id=updated_shipment["client_id"],
            dossier_id=body.dossier_id,
            recipient_phone=client_phone,
            notification_type="ARRIVED_HUB",
            message=(
                f"Votre colis ({updated_shipment['tracking_id']}) est arrivé à un centre logistique.\n\n"
                f"{'Lieu : ' + body.hub_name if body.hub_name else ''}\n"
                "Il poursuit son acheminement vers la destination."
            ),
        )

    return {
        "status": "ok",
        "shipment": updated_shipment,
        "notification": notification,
    }


@router.post("/manager/confirm-arrival-destination")
def confirm_arrival_destination(body: ConfirmArrivalDestinationRequest):
    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    updated_shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=str(shipment["id"]),
        new_status="ARRIVED_DESTINATION",
    )

    updated_dossier = update_dossier_status(
        dossier_id=body.dossier_id,
        status_global="ARRIVED_DESTINATION",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_ARRIVED_DESTINATION",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    office = find_office(
        org_id=ORG_ID,
        country=dossier_full.get("destination_country"),
        city=dossier_full.get("destination_city"),
    )

    office_text = ""

    if office:
        office_text = f"\n\n📍 Adresse : {office.get('address')}"

    client_phone = get_client_phone_from_dossier(dossier_full)
    notification = None

    if client_phone:
        notification = create_notification_outbox(
            org_id=ORG_ID,
            client_id=updated_shipment["client_id"],
            dossier_id=body.dossier_id,
            recipient_phone=client_phone,
            notification_type="ARRIVED_DESTINATION",
            message=(
                f"Votre colis ({updated_shipment['tracking_id']}) est arrivé à destination.\n"
                f"{office_text}\n\n"
                "Nous vous informerons lorsqu’il sera prêt pour retrait."
            ),
        )

    return {
        "status": "ok",
        "shipment": updated_shipment,
        "dossier": updated_dossier,
        "notification": notification,
    }


@router.post("/manager/ready-for-pickup")
def ready_for_pickup(body: ReadyForPickupRequest):
    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    updated_shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=str(shipment["id"]),
        new_status="READY_FOR_PICKUP",
    )

    updated_dossier = update_dossier_status(
        dossier_id=body.dossier_id,
        status_global="READY_FOR_PICKUP",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="READY_FOR_PICKUP",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    office = find_office(
        org_id=ORG_ID,
        country=dossier_full.get("destination_country"),
        city=dossier_full.get("destination_city"),
    )

    office_text = ""

    if office:
        office_text = f"\n\n📍 Adresse : {office.get('address')}"

    client_phone = get_client_phone_from_dossier(dossier_full)
    notification = None

    if client_phone:
        notification = create_notification_outbox(
            org_id=ORG_ID,
            client_id=updated_shipment["client_id"],
            dossier_id=body.dossier_id,
            recipient_phone=client_phone,
            notification_type="READY_FOR_PICKUP",
            message=(
                f"📦 Votre colis ({updated_shipment['tracking_id']}) est prêt pour retrait.\n"
                f"{office_text}\n\n"
                "Merci de passer au bureau avec une pièce d’identité."
            ),
        )

    return {
        "status": "ok",
        "shipment": updated_shipment,
        "dossier": updated_dossier,
        "notification": notification,
    }


@router.post("/manager/confirm-delivered")
def confirm_delivered(body: ConfirmDeliveredRequest):
    shipment = get_shipment_by_dossier(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
    )

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    updated_shipment = update_shipment_status(
        org_id=ORG_ID,
        shipment_id=str(shipment["id"]),
        new_status="DELIVERED",
    )

    updated_dossier = update_dossier_status(
        dossier_id=body.dossier_id,
        status_global="COMPLETED",
    )

    create_dossier_event(
        org_id=ORG_ID,
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_DELIVERED",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    return {
        "status": "ok",
        "shipment": updated_shipment,
        "dossier": updated_dossier,
    }
