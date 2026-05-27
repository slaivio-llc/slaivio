from sqlalchemy import text

from app.db.database import engine


def create_delivery_event(
    org_id: str,
    provider_message_id: str,
    status: str,
    provider: str = "META",
    waba_id: str | None = None,
    phone_number_id: str | None = None,
    whatsapp_number_id: str | None = None,
    recipient_phone: str | None = None,
    timestamp_at: str | None = None,
    error_code: str | None = None,
    error_title: str | None = None,
    error_message: str | None = None,
    error_details: dict | None = None,
    raw_payload: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into whatsapp_delivery_events (
                    org_id,
                    provider,
                    waba_id,
                    phone_number_id,
                    whatsapp_number_id,
                    recipient_phone,
                    provider_message_id,
                    status,
                    timestamp_at,
                    error_code,
                    error_title,
                    error_message,
                    error_details,
                    raw_payload
                )
                values (
                    :org_id,
                    :provider,
                    :waba_id,
                    :phone_number_id,
                    :whatsapp_number_id,
                    :recipient_phone,
                    :provider_message_id,
                    :status,
                    to_timestamp(:timestamp_at),
                    :error_code,
                    :error_title,
                    :error_message,
                    :error_details,
                    :raw_payload
                )
                returning *
            """),
            {
                "org_id": org_id,
                "provider": provider,
                "waba_id": waba_id,
                "phone_number_id": phone_number_id,
                "whatsapp_number_id": whatsapp_number_id,
                "recipient_phone": recipient_phone,
                "provider_message_id": provider_message_id,
                "status": status,
                "timestamp_at": timestamp_at,
                "error_code": error_code,
                "error_title": error_title,
                "error_message": error_message,
                "error_details": error_details,
                "raw_payload": raw_payload,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def update_notification_delivery_status(
    provider_message_id: str,
    status: str,
    error_code: str | None = None,
    error_title: str | None = None,
    error_message: str | None = None,
    error_details: dict | None = None,
):
    column_by_status = {
        "delivered": "delivered_at",
        "read": "read_at",
        "failed": "failed_at",
    }

    timestamp_column = column_by_status.get(status)

    with engine.connect() as conn:
        if timestamp_column:
            conn.execute(
                text(f"""
                    update notification_outbox
                    set
                        delivery_status = :status,
                        {timestamp_column} = now(),
                        error_code = :error_code,
                        error_title = :error_title,
                        error_message = :error_message,
                        error_details = :error_details,
                        updated_at = now()
                    where provider_message_id = :provider_message_id
                """),
                {
                    "provider_message_id": provider_message_id,
                    "status": status,
                    "error_code": error_code,
                    "error_title": error_title,
                    "error_message": error_message,
                    "error_details": error_details,
                },
            )
        else:
            conn.execute(
                text("""
                    update notification_outbox
                    set
                        delivery_status = :status,
                        updated_at = now()
                    where provider_message_id = :provider_message_id
                """),
                {
                    "provider_message_id": provider_message_id,
                    "status": status,
                },
            )

        conn.commit()
