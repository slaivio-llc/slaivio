import json
from sqlalchemy import text

from app.db.database import engine


ALLOWED_BATCH_STATUSES = {
    "PLANNED",
    "COLLECTING",
    "READY_FOR_DEPARTURE",
    "DEPARTED",
    "IN_TRANSIT",
    "ARRIVED_HUB",
    "ARRIVED_DESTINATION",
    "PARTIALLY_DELIVERED",
    "COMPLETED",
    "DELAYED",
    "BLOCKED",
    "CANCELLED",
}


def create_batch(
    org_id: str,
    batch_name: str,
    origin_country: str | None = None,
    origin_city: str | None = None,
    destination_country: str | None = None,
    destination_city: str | None = None,
    shipping_mode: str | None = None,
    planned_departure_at: str | None = None,
    planned_arrival_at: str | None = None,
    public_note: str | None = None,
    internal_note: str | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into shipment_batches (
                    org_id,
                    batch_name,
                    origin_country,
                    origin_city,
                    destination_country,
                    destination_city,
                    shipping_mode,
                    planned_departure_at,
                    planned_arrival_at,
                    public_note,
                    internal_note
                )
                values (
                    :org_id,
                    :batch_name,
                    :origin_country,
                    :origin_city,
                    :destination_country,
                    :destination_city,
                    :shipping_mode,
                    :planned_departure_at,
                    :planned_arrival_at,
                    :public_note,
                    :internal_note
                )
                returning *
            """),
            {
                "org_id": org_id,
                "batch_name": batch_name.strip(),
                "origin_country": origin_country,
                "origin_city": origin_city,
                "destination_country": destination_country,
                "destination_city": destination_city,
                "shipping_mode": shipping_mode.strip().upper() if shipping_mode else None,
                "planned_departure_at": planned_departure_at,
                "planned_arrival_at": planned_arrival_at,
                "public_note": public_note,
                "internal_note": internal_note,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_batches(
    org_id: str,
    status: str | None = None,
    limit: int = 100,
):
    filters = ["org_id = :org_id"]

    params = {
        "org_id": org_id,
        "limit": limit,
    }

    if status:
        filters.append("status = :status")
        params["status"] = status.strip().upper()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from shipment_batches
                where {where_clause}
                order by created_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_batch(
    org_id: str,
    batch_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from shipment_batches
                where org_id = :org_id
                  and id = :batch_id
                limit 1
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def update_batch_status(
    org_id: str,
    batch_id: str,
    status: str,
    delay_reason: str | None = None,
    public_note: str | None = None,
    internal_note: str | None = None,
):
    new_status = status.strip().upper()

    if new_status not in ALLOWED_BATCH_STATUSES:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipment_batches
                set
                    status = :status,
                    delay_reason = coalesce(:delay_reason, delay_reason),
                    public_note = coalesce(:public_note, public_note),
                    internal_note = coalesce(:internal_note, internal_note),
                    actual_departure_at = case
                        when :status = 'DEPARTED' then coalesce(actual_departure_at, now())
                        else actual_departure_at
                    end,
                    actual_arrival_at = case
                        when :status = 'ARRIVED_DESTINATION' then coalesce(actual_arrival_at, now())
                        else actual_arrival_at
                    end,
                    updated_at = now()
                where org_id = :org_id
                  and id = :batch_id
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "status": new_status,
                "delay_reason": delay_reason,
                "public_note": public_note,
                "internal_note": internal_note,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def create_batch_event(
    org_id: str,
    batch_id: str,
    event_type: str,
    payload: dict,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into shipment_batch_events (
                    org_id,
                    batch_id,
                    event_type,
                    payload
                )
                values (
                    :org_id,
                    :batch_id,
                    :event_type,
                    CAST(:payload AS jsonb)
                )
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "event_type": event_type,
                "payload": json.dumps(payload),
            },
        )

        conn.commit()


def assign_shipment_to_batch(
    org_id: str,
    shipment_id: str,
    batch_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipments
                set
                    batch_id = :batch_id,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "batch_id": batch_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_batch_shipments(
    org_id: str,
    batch_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select
                    s.*,
                    c.phone as client_phone
                from shipments s
                join clients c on c.id = s.client_id
                where s.org_id = :org_id
                  and s.batch_id = :batch_id
                order by s.created_at desc
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def update_shipments_status_for_batch(
    org_id: str,
    batch_id: str,
    shipment_status: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update shipments
                set
                    status = :shipment_status,
                    updated_at = now()
                where org_id = :org_id
                  and batch_id = :batch_id
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "shipment_status": shipment_status,
            },
        )

        conn.commit()

        return [dict(row._mapping) for row in result.fetchall()]
