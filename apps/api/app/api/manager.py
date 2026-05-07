from fastapi import APIRouter
from pydantic import BaseModel
from app.db.message_repository import create_dossier_event
from app.db.shipment_repository import create_shipment
from app.db.database import engine
from sqlalchemy import text
from app.services.final_pricing_service import calculate_final_price
from app.db.message_repository import update_dossier_final_pricing
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