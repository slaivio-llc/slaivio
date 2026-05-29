from sqlalchemy import text

from app.db.database import engine


def is_event_processed(
    event_key: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select id
                from processed_webhook_events
                where event_key = :event_key
                limit 1
            """),
            {
                "event_key": event_key,
            },
        ).fetchone()

        return row is not None


def mark_event_processed(
    event_key: str,
    event_type: str | None = None,
    payload_hash: str | None = None,
    raw_payload: dict | None = None,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into processed_webhook_events (
                    event_key,
                    event_type,
                    payload_hash,
                    raw_payload
                )
                values (
                    :event_key,
                    :event_type,
                    :payload_hash,
                    :raw_payload
                )
            """),
            {
                "event_key": event_key,
                "event_type": event_type,
                "payload_hash": payload_hash,
                "raw_payload": raw_payload,
            },
        )

        conn.commit()
