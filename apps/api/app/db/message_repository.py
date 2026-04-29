import json
from sqlalchemy import text
from app.db.database import engine


def insert_raw_message(
    org_id: str,
    phone: str,
    text_msg: str,
    payload: dict,
    client_id: str,
    dossier_id: str,
):
    with engine.connect() as conn:
        conn.execute(
            text("""
                insert into messages_raw (
                    org_id,
                    sender_phone,
                    message_text,
                    raw_payload,
                    client_id,
                    dossier_id
                )
                values (
                    :org_id,
                    :phone,
                    :text_msg,
                    CAST(:payload AS jsonb),
                    :client_id,
                    :dossier_id
                )
            """),
            {
                "org_id": org_id,
                "phone": phone,
                "text_msg": text_msg,
                "payload": json.dumps(payload),
                "client_id": client_id,
                "dossier_id": dossier_id,
            },
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
    
def get_or_create_active_dossier(org_id: str, client_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id
                from dossiers
                where org_id = :org_id
                  and client_id = :client_id
                  and status_global not in ('COMPLETED', 'CLOSED', 'CANCELLED')
                order by created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
            },
        ).fetchone()

        if result:
            return result[0]

        result = conn.execute(
            text("""
                insert into dossiers (
                    org_id,
                    client_id,
                    case_type,
                    status_global,
                    intake_status,
                    validation_status,
                    primary_channel
                )
                values (
                    :org_id,
                    :client_id,
                    'UNKNOWN',
                    'LEAD',
                    'PARTIAL',
                    'PENDING',
                    'whatsapp'
                )
                returning id
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
            },
        )

        conn.commit()

        return result.fetchone()[0]