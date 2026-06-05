from sqlalchemy import text

from app.db.database import engine


def create_lifecycle_event(payload: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into shipment_lifecycle_events (
                    org_id,
                    shipment_id,
                    dossier_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    metadata,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :shipment_id,
                    :dossier_id,
                    :previous_status,
                    :new_status,
                    :event_type,
                    :event_source,
                    :event_message,
                    :metadata,
                    :actor_id,
                    :actor_name
                )
                returning *
            """),
            {
                **payload,
                "metadata": payload.get("metadata") or {},
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_lifecycle_events(
    org_id: str,
    shipment_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_lifecycle_events
                where org_id = :org_id
                  and shipment_id = :shipment_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_shipment_lifecycle_snapshot(
    org_id: str,
    shipment_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    id,
                    org_id,
                    dossier_id,
                    client_id,
                    tracking_id,
                    status,
                    current_status,
                    eta_at,
                    dispatched_at,
                    delivered_at,
                    current_warehouse_id,
                    current_batch_id,
                    batch_status,
                    customs_status,
                    delay_status,
                    inventory_status,
                    delivery_status,
                    final_release_status,
                    status_updated_at,
                    created_at,
                    updated_at
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

        return dict(row._mapping) if row else None

