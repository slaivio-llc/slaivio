from sqlalchemy import text

from app.db.database import engine


def upsert_assignment(
    org_id: str,
    client_phone: str,
    assigned_manager_id: str | None = None,
    assigned_manager_name: str | None = None,
    status: str = "OPEN",
    priority: str = "NORMAL",
    last_note: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into conversation_assignments (
                    org_id,
                    client_phone,
                    assigned_manager_id,
                    assigned_manager_name,
                    status,
                    priority,
                    last_note
                )
                values (
                    :org_id,
                    :client_phone,
                    :assigned_manager_id,
                    :assigned_manager_name,
                    :status,
                    :priority,
                    :last_note
                )
                on conflict (org_id, client_phone)
                do update set
                    assigned_manager_id = excluded.assigned_manager_id,
                    assigned_manager_name = excluded.assigned_manager_name,
                    status = excluded.status,
                    priority = excluded.priority,
                    last_note = excluded.last_note,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "assigned_manager_id": assigned_manager_id,
                "assigned_manager_name": assigned_manager_name,
                "status": status,
                "priority": priority,
                "last_note": last_note,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def get_assignment(
    org_id: str,
    client_phone: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from conversation_assignments
                where org_id = :org_id
                  and client_phone = :client_phone
                limit 1
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
