from fastapi import APIRouter
from pydantic import BaseModel
from app.db.message_repository import create_dossier_event
from app.db.shipment_repository import create_shipment
from app.db.database import engine
from sqlalchemy import text
from app.services.final_pricing_service import calculate_final_price
from app.db.message_repository import update_dossier_final_pricing
from app.db.message_repository import get_dossier_full
from app.db.shipment_repository import get_shipment_by_dossier, update_shipment_status
from app.db.notification_repository import create_notification_outbox
from app.db.message_repository import get_dossier_full

router = APIRouter()


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



@router.post("/manager/confirm-package")
def confirm_package(body: ConfirmPackageRequest):
    shipment = create_shipment(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="PACKAGE_RECEIVED",
        payload={
            "weight_kg": body.weight_kg,
            "volume_cbm": body.volume_cbm,
            "notes": body.notes,
            "shipment_id": shipment.get("id") if shipment else None,
        },
    )

    # récupérer dossier

    dossier = get_dossier_full(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    final_price = calculate_final_price(
        org_id="demo_agency",
        dossier=dossier,
        weight_kg=body.weight_kg,
        volume_cbm=body.volume_cbm,
    )

    updated_dossier = None

    if final_price:
        updated_dossier = update_dossier_final_pricing(
            org_id="demo_agency",
            dossier_id=body.dossier_id,
            total=final_price["total"],
            currency=final_price["currency"],
        )

        create_dossier_event(
            org_id="demo_agency",
            dossier_id=body.dossier_id,
            event_type="FINAL_PRICE_CALCULATED",
            payload={
                "total": final_price["total"],
                "currency": final_price["currency"],
            },
        )

    return {
        "status": "ok",
        "shipment": shipment,
    }

with engine.connect() as conn:
    conn.execute(
        text("""
            update dossiers
            set status_global = 'PACKAGE_RECEIVED'
            where id = :dossier_id
              and org_id = :org_id
        """),
        {
            "org_id": "demo_agency",
            "dossier_id": body.dossier_id,
        },
    )
    conn.commit()


@router.post("/manager/confirm-payment")
def confirm_payment(body: ConfirmPaymentRequest):
    from app.db.database import engine
    from sqlalchemy import text
    from app.db.message_repository import create_dossier_event

    updated_dossier = None

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
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )

        conn.commit()
        row = result.fetchone()
        updated_dossier = dict(row._mapping) if row else None

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="PAYMENT_CONFIRMED",
        payload={
            "payment_method": body.payment_method,
            "notes": body.notes,
        },
    )

    # update shipment status
    with engine.connect() as conn:
        conn.execute(
            text("""
                update shipments
                set status = 'READY_FOR_DEPARTURE'
                where dossier_id = :dossier_id
                and org_id = :org_id
            """),
            {
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )
        conn.commit()

    return {
        "status": "ok",
        "updated_dossier": updated_dossier,
    }

@router.post("/manager/confirm-departure")
def confirm_departure(body: ConfirmDepartureRequest):
    from app.db.database import engine
    from sqlalchemy import text

    shipment = get_shipment_by_dossier(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    if not shipment:
        return {
            "status": "error",
            "message": "Shipment not found",
        }

    updated_shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=str(shipment["id"]),
        new_status="DEPARTED",
    )

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update dossiers
                set
                    status_global = 'IN_TRANSIT',
                    updated_at = now()
                where id = :dossier_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )

        conn.commit()
        row = result.fetchone()
        updated_dossier = dict(row._mapping) if row else None

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_DEPARTED",
        payload={
            "shipment_id": str(updated_shipment["id"]),
            "tracking_id": updated_shipment["tracking_id"],
            "departure_note": body.departure_note,
        },
    )

    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    client_phone = None

    if dossier_full.get("client"):
        client_phone = dossier_full["client"]["phone"]

    notification = None

    if not client_phone:
        client_phone = dossier_full.get("client_phone") or dossier_full.get("phone")

    if client_phone:
        notification = create_notification_outbox(
            org_id="demo_agency",
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
            org_id="demo_agency",
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
    from app.db.database import engine
    from sqlalchemy import text
    from app.db.shipment_repository import get_shipment_by_dossier, update_shipment_status
    from app.db.notification_repository import create_notification_outbox
    from app.db.message_repository import get_dossier_full, create_dossier_event

    shipment = get_shipment_by_dossier(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    if not shipment:
        return {"status": "error", "message": "Shipment not found"}

    updated_shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=str(shipment["id"]),
        new_status="ARRIVED_HUB",
    )

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_ARRIVED_HUB",
        payload={
            "hub_name": body.hub_name,
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    client_phone = dossier_full["client"]["phone"]

    notification = create_notification_outbox(
        org_id="demo_agency",
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
    from app.db.database import engine
    from sqlalchemy import text
    from app.db.shipment_repository import get_shipment_by_dossier, update_shipment_status
    from app.db.notification_repository import create_notification_outbox
    from app.db.message_repository import get_dossier_full, create_dossier_event
    from app.db.office_repository import find_office

    shipment = get_shipment_by_dossier(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    if not shipment:
        return {"status": "error", "message": "Shipment not found"}

    updated_shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=str(shipment["id"]),
        new_status="ARRIVED_DESTINATION",
    )

    with engine.connect() as conn:
        conn.execute(
            text("""
                update dossiers
                set status_global = 'ARRIVED_DESTINATION'
                where id = :dossier_id
                  and org_id = :org_id
            """),
            {
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )
        conn.commit()

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_ARRIVED_DESTINATION",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    office = find_office(
        org_id="demo_agency",
        country=dossier_full.get("destination_country"),
        city=dossier_full.get("destination_city"),
    )

    office_text = ""

    if office:
        office_text = f"\n\n📍 Adresse : {office.get('address')}"

    client_phone = dossier_full["client"]["phone"]

    notification = create_notification_outbox(
        org_id="demo_agency",
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
        "notification": notification,
    }


@router.post("/manager/ready-for-pickup")
def ready_for_pickup(body: ReadyForPickupRequest):
    from app.db.database import engine
    from sqlalchemy import text
    from app.db.shipment_repository import get_shipment_by_dossier, update_shipment_status
    from app.db.notification_repository import create_notification_outbox
    from app.db.message_repository import get_dossier_full, create_dossier_event
    from app.db.office_repository import find_office

    shipment = get_shipment_by_dossier(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    if not shipment:
        return {"status": "error", "message": "Shipment not found"}

    updated_shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=str(shipment["id"]),
        new_status="READY_FOR_PICKUP",
    )

    with engine.connect() as conn:
        conn.execute(
            text("""
                update dossiers
                set status_global = 'READY_FOR_PICKUP'
                where id = :dossier_id
                  and org_id = :org_id
            """),
            {
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )
        conn.commit()

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="READY_FOR_PICKUP",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    dossier_full = get_dossier_full(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    office = find_office(
        org_id="demo_agency",
        country=dossier_full.get("destination_country"),
        city=dossier_full.get("destination_city"),
    )

    office_text = ""

    if office:
        office_text = f"\n\n📍 Adresse : {office.get('address')}"

    client_phone = dossier_full["client"]["phone"]

    notification = create_notification_outbox(
        org_id="demo_agency",
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
        "notification": notification,
    }


@router.post("/manager/confirm-delivered")
def confirm_delivered(body: ConfirmDeliveredRequest):
    from app.db.database import engine
    from sqlalchemy import text
    from app.db.shipment_repository import get_shipment_by_dossier, update_shipment_status
    from app.db.message_repository import create_dossier_event

    shipment = get_shipment_by_dossier(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
    )

    if not shipment:
        return {"status": "error", "message": "Shipment not found"}

    updated_shipment = update_shipment_status(
        org_id="demo_agency",
        shipment_id=str(shipment["id"]),
        new_status="DELIVERED",
    )

    with engine.connect() as conn:
        conn.execute(
            text("""
                update dossiers
                set status_global = 'COMPLETED'
                where id = :dossier_id
                  and org_id = :org_id
            """),
            {
                "org_id": "demo_agency",
                "dossier_id": body.dossier_id,
            },
        )
        conn.commit()

    create_dossier_event(
        org_id="demo_agency",
        dossier_id=body.dossier_id,
        event_type="SHIPMENT_DELIVERED",
        payload={
            "tracking_id": updated_shipment["tracking_id"],
        },
    )

    return {
        "status": "ok",
        "shipment": updated_shipment,
    }