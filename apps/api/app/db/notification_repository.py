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