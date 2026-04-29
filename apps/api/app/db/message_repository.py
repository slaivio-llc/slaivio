import json
from sqlalchemy import text
from app.db.database import engine


def insert_raw_message(org_id: str, phone: str, text_msg: str, payload: dict):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into messages_raw (
                    org_id,
                    sender_phone,
                    message_text,
                    raw_payload
                )
                values (
                    :org_id,
                    :phone,
                    :text_msg,
                    CAST(:payload AS jsonb)
                )
            """),
            {
                "org_id": org_id,
                "phone": phone,
                "text_msg": text_msg,
                "payload": json.dumps(payload),
            }
        )
        conn.commit()

def get_or_create_client(org_id: str, phone: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id
                from clients
                where org_id = :org_id
                  and phone = :phone
                limit 1
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        ).fetchone()

        if result:
            return result[0]

        result = conn.execute(
            text("""
                insert into clients (org_id, phone)
                values (:org_id, :phone)
                returning id
            """),
            {
                "org_id": org_id,
                "phone": phone,
            },
        )

        conn.commit()

        return result.fetchone()[0]