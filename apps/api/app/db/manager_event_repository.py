import json
from sqlalchemy import text

from app.db.database import engine


def create_manager_event(
    org_id: str,
    event_type: str,
    title: str,
    message: str,
    event_scope: str = "GENERAL",
    client_id: str | None = None,
    dossier_id: str | None = None,
    shipment_id: str | None = None,
    notification_id: str | None = None,
    escalation_id: str | None = None,
    priority: str = "NORMAL",
    payload: dict | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into manager_events (
                    org_id,
                    event_type,
                    event_scope,
                    client_id,
                    dossier_id,
                    shipment_id,
                    notification_id,
                    escalation_id,
                    title,
                    message,
                    priority,
                    payload
                )
                values (
                    :org_id,
                    :event_type,
                    :event_scope,
                    :client_id,
                    :dossier_id,
                    :shipment_id,
                    :notification_id,
                    :escalation_id,
                    :title,
                    :message,
                    :priority,
                    CAST(:payload AS jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "event_type": event_type.strip().upper(),
                "event_scope": event_scope.strip().upper(),
                "client_id": client_id,
                "dossier_id": dossier_id,
                "shipment_id": shipment_id,
                "notification_id": notification_id,
                "escalation_id": escalation_id,
                "title": title,
                "message": message,
                "priority": priority.strip().upper(),
                "payload": json.dumps(payload or {}),
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_manager_events(
    org_id: str,
    unread_only: bool = False,
    limit: int = 100,
):
    filters = ["org_id = :org_id"]
    params = {"org_id": org_id, "limit": limit}

    if unread_only:
        filters.append("is_read = false")

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from manager_events
                where {where_clause}
                order by created_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def list_manager_events_after_id(
    org_id: str,
    last_event_id: str | None = None,
    limit: int = 50,
):
    params = {
        "org_id": org_id,
        "limit": limit,
    }

    condition = ""

    if last_event_id:
        condition = """
            and created_at > (
                select created_at
                from manager_events
                where id = :last_event_id
                limit 1
            )
        """
        params["last_event_id"] = last_event_id

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from manager_events
                where org_id = :org_id
                {condition}
                order by created_at asc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def mark_manager_event_read(
    org_id: str,
    event_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update manager_events
                set is_read = true
                where org_id = :org_id
                  and id = :event_id
                returning *
            """),
            {
                "org_id": org_id,
                "event_id": event_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None
