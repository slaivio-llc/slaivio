import uuid
from sqlalchemy import text
from app.db.database import engine


def generate_tracking_id():
    return "SLAIVO-" + str(uuid.uuid4())[:8].upper()


def create_shipment(
    org_id: str,
    dossier: dict,
):
    tracking_id = generate_tracking_id()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into shipments (
                    org_id,
                    dossier_id,
                    client_id,
                    tracking_id,

                    origin_country,
                    origin_city,
                    destination_country,
                    destination_city,

                    goods_type,
                    weight_kg,
                    volume_cbm,
                    shipping_mode
                )
                values (
                    :org_id,
                    :dossier_id,
                    :client_id,
                    :tracking_id,

                    :origin_country,
                    :origin_city,
                    :destination_country,
                    :destination_city,

                    :goods_type,
                    :weight_kg,
                    :volume_cbm,
                    :shipping_mode
                )
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier["id"],
                "client_id": dossier["client_id"],
                "tracking_id": tracking_id,

                "origin_country": dossier.get("origin_country"),
                "origin_city": dossier.get("origin_city"),
                "destination_country": dossier.get("destination_country"),
                "destination_city": dossier.get("destination_city"),

                "goods_type": dossier.get("goods_type"),
                "weight_kg": dossier.get("estimated_weight_kg"),
                "volume_cbm": dossier.get("estimated_volume_cbm"),
                "shipping_mode": dossier.get("shipping_mode"),
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping)
    
ALLOWED_SHIPMENT_STATUSES = {
    "CREATED",
    "RECEIVED_AT_ORIGIN",
    "SCHEDULED_FOR_DEPARTURE",
    "DEPARTED",
    "IN_TRANSIT",
    "ARRIVED_HUB",
    "IN_LOCAL_TRANSIT",
    "ARRIVED_DESTINATION",
    "READY_FOR_PICKUP",
    "DELIVERED",
    "BLOCKED",
    "ISSUE",
    "CANCELLED",
}


def update_shipment_status(
    org_id: str,
    shipment_id: str,
    new_status: str,
):
    if new_status not in ALLOWED_SHIPMENT_STATUSES:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipments
                set
                    status = :new_status,
                    updated_at = now()
                where id = :shipment_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "new_status": new_status,
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping) if row else None
    
def set_shipment_total(
    org_id: str,
    shipment_id: str,
    total: float,
    currency: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipments
                set
                    fees_total = :total,
                    currency = :currency,
                    updated_at = now()
                where id = :shipment_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "total": total,
                "currency": currency,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
    
def record_shipment_payment(
    org_id: str,
    shipment_id: str,
    amount: float,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipments
                set
                    fees_paid = coalesce(fees_paid, 0) + :amount,
                    updated_at = now()
                where id = :shipment_id
                  and org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "amount": amount,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None