from fastapi import APIRouter
from pydantic import BaseModel
from app.db.message_repository import create_dossier_event
from app.db.shipment_repository import create_shipment
from app.db.database import engine
from sqlalchemy import text


router = APIRouter()


class ConfirmPackageRequest(BaseModel):
    dossier_id: str
    weight_kg: float | None = None
    volume_cbm: float | None = None
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