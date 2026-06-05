from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.shipment_lifecycle.repositories.lifecycle_repository import (
    create_lifecycle_event,
)
from app.shipment_lifecycle.repositories.transition_repository import (
    transition_allowed,
)


def validate_transition(
    previous_status: str | None,
    next_status: str,
):
    if previous_status == next_status:
        return True

    if not transition_allowed(previous_status, next_status):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_transition",
                "from": previous_status,
                "to": next_status,
            },
        )

    return True


def change_shipment_status(
    org_id: str,
    shipment_id: str,
    next_status: str,
    event_type: str = "STATUS_CHANGE",
    event_source: str = "MANAGER",
    event_message: str | None = "Shipment status changed",
    metadata: dict | None = None,
    actor_id: str | None = None,
    actor_name: str | None = None,
    validate: bool = True,
):
    with engine.connect() as conn:
        current = conn.execute(
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

        if not current:
            raise HTTPException(status_code=404, detail="Shipment not found")

        current_dict = dict(current._mapping)
        previous_status = (
            current_dict.get("current_status")
            or current_dict.get("status")
            or "DRAFT"
        )

        if validate:
            validate_transition(previous_status, next_status)

        row = conn.execute(
            text("""
                update shipments
                set
                    current_status = :next_status,
                    status = :next_status,
                    status_updated_at = now(),
                    dispatched_at = case
                        when :next_status = 'IN_TRANSIT' then now()
                        else dispatched_at
                    end,
                    delivered_at = case
                        when :next_status = 'DELIVERED' then now()
                        else delivered_at
                    end,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "next_status": next_status,
            },
        ).fetchone()

        conn.commit()

    shipment = dict(row._mapping) if row else None
    event = create_lifecycle_event(
        {
            "org_id": org_id,
            "shipment_id": shipment_id,
            "dossier_id": current_dict.get("dossier_id"),
            "previous_status": previous_status,
            "new_status": next_status,
            "event_type": event_type,
            "event_source": event_source,
            "event_message": event_message,
            "metadata": metadata or {},
            "actor_id": actor_id,
            "actor_name": actor_name,
        }
    )

    return {
        "shipment": shipment,
        "event": event,
    }

