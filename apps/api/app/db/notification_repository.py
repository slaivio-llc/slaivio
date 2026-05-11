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
                returning *
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

        return dict(row._mapping) if row else None


def list_pending_notifications(
    org_id: str,
    limit: int = 20,
):
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
                    provider,
                    provider_message_id,
                    error_message,
                    created_at,
                    sent_at,
                    failed_at
                from notification_outbox
                where org_id = :org_id
                  and status = 'PENDING'
                order by created_at asc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def get_notification_by_id(
    org_id: str,
    notification_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from notification_outbox
                where org_id = :org_id
                  and id = :notification_id
                limit 1
            """),
            {
                "org_id": org_id,
                "notification_id": notification_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def mark_notification_as_sent(
    org_id: str,
    notification_id: str,
    provider_message_id: str | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update notification_outbox
                set
                    status = 'SENT',
                    sent_at = now(),
                    provider_message_id = coalesce(
                        :provider_message_id,
                        provider_message_id
                    )
                where org_id = :org_id
                  and id = :notification_id
                returning *
            """),
            {
                "org_id": org_id,
                "notification_id": notification_id,
                "provider_message_id": provider_message_id,
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping) if row else None


def mark_notification_failed(
    org_id: str,
    notification_id: str,
    error: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update notification_outbox
                set
                    status = 'FAILED',
                    failed_at = now(),
                    error_message = :error
                where org_id = :org_id
                  and id = :notification_id
                returning *
            """),
            {
                "org_id": org_id,
                "notification_id": notification_id,
                "error": error,
            },
        )

        conn.commit()

        row = result.fetchone()

        return dict(row._mapping) if row else None
