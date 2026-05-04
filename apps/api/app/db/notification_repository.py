from sqlalchemy import text
from app.db.database import engine


def create_notification_outbox(
    org_id: str,
    client_id: str,
    dossier_id: str,
    recipient_phone: str,
    notification_type: str,
    message: str,
    channel: str = "whatsapp",
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into notification_outbox (
                    org_id,
                    client_id,
                    dossier_id,
                    channel,
                    recipient_phone,
                    notification_type,
                    message
                )
                values (
                    :org_id,
                    :client_id,
                    :dossier_id,
                    :channel,
                    :recipient_phone,
                    :notification_type,
                    :message
                )
                returning id, status
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
                "dossier_id": dossier_id,
                "channel": channel,
                "recipient_phone": recipient_phone,
                "notification_type": notification_type,
                "message": message,
            },
        )

        conn.commit()

        row = result.fetchone()

        return {
            "id": row[0],
            "status": row[1],
        }
    
def list_pending_notifications(org_id: str = "demo_agency", limit: int = 20):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select
                    id,
                    org_id,
                    client_id,
                    dossier_id,
                    channel,
                    recipient_phone,
                    notification_type,
                    message,
                    status,
                    created_at
                from notification_outbox
                where org_id = :org_id
                  and status = 'PENDING'
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]
    
def mark_notification_as_sent(notification_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update notification_outbox
                set
                    status = 'SENT',
                    sent_at = now()
                where id = :notification_id
                returning id, status, sent_at
            """),
            {
                "notification_id": notification_id
            }
        )

        conn.commit()

        row = result.fetchone()

        if not row:
            return None

        return dict(row._mapping)

def get_notification_by_id(notification_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from notification_outbox
                where id = :id
                limit 1
            """),
            {"id": notification_id}
        ).fetchone()

        return dict(result._mapping) if result else None


def mark_notification_sent(notification_id: str, provider_message_id: str):
    with engine.connect() as conn:
        conn.execute(
            text("""
                update notification_outbox
                set status = 'SENT',
                    sent_at = now(),
                    provider_message_id = :provider_message_id
                where id = :id
            """),
            {
                "id": notification_id,
                "provider_message_id": provider_message_id,
            },
        )
        conn.commit()


def mark_notification_failed(notification_id: str, error: str):
    with engine.connect() as conn:
        conn.execute(
            text("""
                update notification_outbox
                set status = 'FAILED',
                    failed_at = now(),
                    error_message = :error
                where id = :id
            """),
            {
                "id": notification_id,
                "error": error,
            },
        )
        conn.commit()