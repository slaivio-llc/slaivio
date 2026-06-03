from sqlalchemy import text

from app.db.database import engine


def update_queue(
    org_id: str,
    client_phone: str,
    queue_name: str,
    unread_count: int | None = None,
    requires_attention: bool | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into conversation_assignments (
                    org_id,
                    client_phone,
                    queue_name,
                    unread_count,
                    requires_attention,
                    waiting_since
                )
                values (
                    :org_id,
                    :client_phone,
                    :queue_name,
                    coalesce(:unread_count, 0),
                    coalesce(:requires_attention, false),
                    now()
                )
                on conflict (org_id, client_phone)
                do update set
                    queue_name = excluded.queue_name,
                    unread_count = coalesce(
                        :unread_count,
                        conversation_assignments.unread_count
                    ),
                    requires_attention = coalesce(
                        :requires_attention,
                        conversation_assignments.requires_attention
                    ),
                    waiting_since = coalesce(
                        conversation_assignments.waiting_since,
                        now()
                    ),
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "client_phone": client_phone,
                "queue_name": queue_name,
                "unread_count": unread_count,
                "requires_attention": requires_attention,
            },
        ).fetchone()

        conn.commit()
        return dict(row._mapping) if row else None
