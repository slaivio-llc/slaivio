import json
from sqlalchemy import text

from app.db.database import engine


ALLOWED_ESCALATION_PRIORITIES = {
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT",
}

ALLOWED_ESCALATION_STATUSES = {
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "CANCELLED",
}


def create_escalation_case(
    org_id: str,
    reason: str,
    client_id: str | None = None,
    dossier_id: str | None = None,
    shipment_id: str | None = None,
    source: str = "WHATSAPP",
    priority: str = "NORMAL",
    customer_message: str | None = None,
    internal_note: str | None = None,
    assigned_to: str | None = None,
):
    normalized_priority = priority.strip().upper()

    if normalized_priority not in ALLOWED_ESCALATION_PRIORITIES:
        normalized_priority = "NORMAL"

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into escalation_cases (
                    org_id,
                    client_id,
                    dossier_id,
                    shipment_id,
                    source,
                    reason,
                    priority,
                    customer_message,
                    internal_note,
                    assigned_to,
                    status
                )
                values (
                    :org_id,
                    :client_id,
                    :dossier_id,
                    :shipment_id,
                    :source,
                    :reason,
                    :priority,
                    :customer_message,
                    :internal_note,
                    :assigned_to,
                    case
                        when :assigned_to is not null then 'ASSIGNED'
                        else 'OPEN'
                    end
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
                "dossier_id": dossier_id,
                "shipment_id": shipment_id,
                "source": source.strip().upper(),
                "reason": reason.strip(),
                "priority": normalized_priority,
                "customer_message": customer_message,
                "internal_note": internal_note,
                "assigned_to": assigned_to,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_escalation_cases(
    org_id: str,
    status: str | None = None,
    priority: str | None = None,
    limit: int = 100,
):
    filters = ["org_id = :org_id"]
    params = {"org_id": org_id, "limit": limit}

    if status:
        filters.append("status = :status")
        params["status"] = status.strip().upper()

    if priority:
        filters.append("priority = :priority")
        params["priority"] = priority.strip().upper()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from escalation_cases
                where {where_clause}
                order by
                    case priority
                        when 'URGENT' then 4
                        when 'HIGH' then 3
                        when 'NORMAL' then 2
                        when 'LOW' then 1
                        else 0
                    end desc,
                    created_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_escalation_case(
    org_id: str,
    escalation_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from escalation_cases
                where org_id = :org_id
                  and id = :escalation_id
                limit 1
            """),
            {
                "org_id": org_id,
                "escalation_id": escalation_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def update_escalation_case(
    org_id: str,
    escalation_id: str,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: str | None = None,
    internal_note: str | None = None,
):
    normalized_status = status.strip().upper() if status else None
    normalized_priority = priority.strip().upper() if priority else None

    if normalized_status and normalized_status not in ALLOWED_ESCALATION_STATUSES:
        return None

    if normalized_priority and normalized_priority not in ALLOWED_ESCALATION_PRIORITIES:
        return None

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update escalation_cases
                set
                    status = coalesce(:status, status),
                    priority = coalesce(:priority, priority),
                    assigned_to = coalesce(:assigned_to, assigned_to),
                    internal_note = coalesce(:internal_note, internal_note),
                    resolved_at = case
                        when :status = 'RESOLVED' then now()
                        else resolved_at
                    end,
                    updated_at = now()
                where org_id = :org_id
                  and id = :escalation_id
                returning *
            """),
            {
                "org_id": org_id,
                "escalation_id": escalation_id,
                "status": normalized_status,
                "priority": normalized_priority,
                "assigned_to": assigned_to,
                "internal_note": internal_note,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def create_escalation_event(
    org_id: str,
    escalation_id: str,
    event_type: str,
    payload: dict,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into escalation_events (
                    org_id,
                    escalation_id,
                    event_type,
                    payload
                )
                values (
                    :org_id,
                    :escalation_id,
                    :event_type,
                    CAST(:payload AS jsonb)
                )
            """),
            {
                "org_id": org_id,
                "escalation_id": escalation_id,
                "event_type": event_type,
                "payload": json.dumps(payload),
            },
        )

        conn.commit()


def list_escalation_events(
    org_id: str,
    escalation_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from escalation_events
                where org_id = :org_id
                  and escalation_id = :escalation_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "escalation_id": escalation_id,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]
