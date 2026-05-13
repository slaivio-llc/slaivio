import uuid
from sqlalchemy import text
from app.db.database import engine


ALLOWED_SHIPMENT_STATUSES = {
    "CREATED",
    "RECEIVED_AT_ORIGIN",
    "SCHEDULED_FOR_DEPARTURE",
    "READY_FOR_DEPARTURE",
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


def generate_tracking_id():
    return "SLAIVO-" + str(uuid.uuid4())[:8].upper()


def create_shipment(
    org_id: str,
    dossier_id: str,
    weight_kg: float | None = None,
    volume_cbm: float | None = None,
):
    tracking_id = generate_tracking_id()

    with engine.connect() as conn:
        dossier = conn.execute(
            text("""
                select *
                from dossiers
                where org_id = :org_id
                  and id = :dossier_id
                limit 1
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        ).fetchone()

        if not dossier:
            return None

        dossier_dict = dict(dossier._mapping)

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
                    shipping_mode,
                    status
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
                    :shipping_mode,
                    'RECEIVED_AT_ORIGIN'
                )
                returning *
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "client_id": dossier_dict["client_id"],
                "tracking_id": tracking_id,

                "origin_country": dossier_dict.get("origin_country"),
                "origin_city": dossier_dict.get("origin_city"),
                "destination_country": dossier_dict.get("destination_country"),
                "destination_city": dossier_dict.get("destination_city"),

                "goods_type": dossier_dict.get("goods_type"),
                "weight_kg": weight_kg or dossier_dict.get("estimated_weight_kg"),
                "volume_cbm": volume_cbm or dossier_dict.get("estimated_volume_cbm"),
                "shipping_mode": dossier_dict.get("shipping_mode"),
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_shipment_by_dossier(org_id: str, dossier_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipments
                where org_id = :org_id
                  and dossier_id = :dossier_id
                order by created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def get_shipment_by_id(org_id: str, shipment_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipments
                where org_id = :org_id
                  and id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


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

def list_shipments_by_client(
    org_id: str,
    client_id: str,
    include_completed: bool = True,
    limit: int = 20,
):
    filters = [
        "s.org_id = :org_id",
        "s.client_id = :client_id",
    ]

    params = {
        "org_id": org_id,
        "client_id": client_id,
        "limit": limit,
    }

    if not include_completed:
        filters.append("s.status not in ('DELIVERED', 'CANCELLED')")

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select
                    s.*,
                    d.status_global as dossier_status_global,
                    d.intake_status as dossier_intake_status,
                    d.validation_status as dossier_validation_status
                from shipments s
                left join dossiers d on d.id = s.dossier_id
                where {where_clause}
                order by s.created_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def list_shipments_by_phone(
    org_id: str,
    phone: str,
    include_completed: bool = True,
    limit: int = 20,
):
    with engine.connect() as conn:
        client = conn.execute(
            text("""
                select id
                from clients
                where org_id = :org_id
                  and phone = :phone
                limit 1
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        ).fetchone()

        if not client:
            return []

        client_id = str(client[0])

    return list_shipments_by_client(
        org_id=org_id,
        client_id=client_id,
        include_completed=include_completed,
        limit=limit,
    )
