from sqlalchemy import text

from app.db.database import engine


def update_presence(
    org_id: str,
    manager_id: str,
    manager_name: str,
    status: str,
    active_conversation: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into agent_presence (
                    org_id,
                    manager_id,
                    manager_name,
                    status,
                    active_conversation,
                    last_seen
                )
                values (
                    :org_id,
                    :manager_id,
                    :manager_name,
                    :status,
                    :active_conversation,
                    now()
                )
                on conflict (
                    org_id,
                    manager_id
                )
                do update set
                    manager_name = excluded.manager_name,
                    status = excluded.status,
                    active_conversation = excluded.active_conversation,
                    last_seen = now()
                returning *
            """),
            {
                "org_id": org_id,
                "manager_id": manager_id,
                "manager_name": manager_name,
                "status": status,
                "active_conversation": active_conversation,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None


def list_presence(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from agent_presence
                where org_id = :org_id
                order by
                    case status
                        when 'ONLINE' then 0
                        when 'AWAY' then 1
                        else 2
                    end,
                    manager_name
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]
