import json

from sqlalchemy import text

from app.db.database import engine


def create_internal_note(
    org_id: str,
    client_phone: str,
    note: str,
    manager_id: str | None = None,
    manager_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into conversation_internal_notes (
                    org_id,
                    client_phone,
                    manager_id,
                    manager_name,
                    note
                )
                values (
                    :org_id,
                    :client_phone,
                    :manager_id,
                    :manager_name,
                    :note
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "manager_id": manager_id,
                "manager_name": manager_name,
                "note": note,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)


def list_internal_notes(
    org_id: str,
    client_phone: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from conversation_internal_notes
                where org_id = :org_id
                  and client_phone = :client_phone
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def create_timeline_event(
    org_id: str,
    client_phone: str,
    event_type: str,
    event_title: str | None = None,
    event_payload: dict | None = None,
    created_by_id: str | None = None,
    created_by_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into conversation_timeline_events (
                    org_id,
                    client_phone,
                    event_type,
                    event_title,
                    event_payload,
                    created_by_id,
                    created_by_name
                )
                values (
                    :org_id,
                    :client_phone,
                    :event_type,
                    :event_title,
                    CAST(:event_payload AS jsonb),
                    :created_by_id,
                    :created_by_name
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "event_type": event_type,
                "event_title": event_title,
                "event_payload": json.dumps(event_payload or {}),
                "created_by_id": created_by_id,
                "created_by_name": created_by_name,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping)


def list_timeline_events(
    org_id: str,
    client_phone: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from conversation_timeline_events
                where org_id = :org_id
                  and client_phone = :client_phone
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]
