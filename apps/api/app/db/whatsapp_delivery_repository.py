import json

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
                    CAST(:error_details AS jsonb),
                    CAST(:raw_payload AS jsonb)
                )
                on conflict (provider, provider_message_id, status)
                do nothing
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
                "error_details": json.dumps(error_details or {}),
                "raw_payload": json.dumps(raw_payload or {}),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def update_notification_delivery_status(
    org_id: str,
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

    with engine.begin() as conn:
        if timestamp_column:
            row = conn.execute(
                text(f"""
                    update notification_outbox
                    set
                        delivery_status = :status,
                        {timestamp_column} = now(),
                        error_code = :error_code,
                        error_title = :error_title,
                        error_message = :error_message,
                        error_details = CAST(:error_details AS jsonb),
                        updated_at = now()
                    where org_id = :org_id and provider_message_id = :provider_message_id
                    returning id, org_id
                """),
                {
                    "provider_message_id": provider_message_id,
                    "org_id": org_id,
                    "status": status,
                    "error_code": error_code,
                    "error_title": error_title,
                    "error_message": error_message,
                    "error_details": json.dumps(error_details or {}),
                },
            )
        else:
            row = conn.execute(
                text("""
                    update notification_outbox
                    set
                        delivery_status = :status,
                        updated_at = now()
                    where org_id = :org_id and provider_message_id = :provider_message_id
                    returning id, org_id
                """),
                {
                    "provider_message_id": provider_message_id,
                    "org_id": org_id,
                    "status": status,
                },
            )
        notification = row.mappings().first()
        if notification and str(status).lower() in {"delivered", "read", "failed", "undelivered"}:
            campaign_status = "DELIVERED" if str(status).lower() == "delivered" else "READ" if str(status).lower() == "read" else "FAILED"
            conn.execute(
                text("""update broadcast_recipients r set
                    status=case
                      when r.status='READ' then 'READ'
                      when r.status='DELIVERED' and :status<>'READ' then 'DELIVERED'
                      when r.status='FAILED' then 'FAILED'
                      else :status end,
                    delivered_at=case when :status in ('DELIVERED','READ') then coalesce(r.delivered_at,now()) else r.delivered_at end,
                    read_at=case when :status='READ' then coalesce(r.read_at,now()) else r.read_at end,
                    error_code=case when :status='FAILED' and r.status not in ('DELIVERED','READ') then :error_code else r.error_code end,
                    error_message=case when :status='FAILED' and r.status not in ('DELIVERED','READ') then :error_message else r.error_message end
                  where r.org_id=:org_id and r.notification_id=:notification_id"""),
                {"org_id": org_id, "notification_id": str(notification["id"]), "status": campaign_status,
                 "error_code": error_code, "error_message": error_message},
            )
