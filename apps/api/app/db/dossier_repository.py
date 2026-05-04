from sqlalchemy import text
from app.db.database import engine


def get_dossier_detail(org_id: str, dossier_id: str):
    with engine.connect() as conn:
        dossier = conn.execute(
            text("""
                select *
                from dossiers
                where org_id = :org_id
                  and id = :dossier_id
                limit 1
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        ).fetchone()

        if not dossier:
            return None

        dossier_dict = dict(dossier._mapping)

        client = conn.execute(
            text("""
                select *
                from clients
                where id = :client_id
                limit 1
            """),
            {"client_id": dossier_dict["client_id"]},
        ).fetchone()

        messages = conn.execute(
            text("""
                select
                    id,
                    sender_phone,
                    message_text,
                    raw_payload,
                    created_at
                from messages_raw
                where dossier_id = :dossier_id
                order by created_at asc
            """),
            {"dossier_id": dossier_id},
        ).fetchall()

        events = conn.execute(
            text("""
                select
                    id,
                    event_type,
                    payload,
                    created_at
                from dossier_events
                where dossier_id = :dossier_id
                order by created_at asc
            """),
            {"dossier_id": dossier_id},
        ).fetchall()

        notifications = conn.execute(
            text("""
                select
                    id,
                    channel,
                    recipient_phone,
                    notification_type,
                    message,
                    status,
                    provider,
                    provider_message_id,
                    created_at,
                    sent_at,
                    failed_at,
                    error_message
                from notification_outbox
                where dossier_id = :dossier_id
                order by created_at asc
            """),
            {"dossier_id": dossier_id},
        ).fetchall()

        return {
            "dossier": dossier_dict,
            "client": dict(client._mapping) if client else None,
            "messages": [dict(row._mapping) for row in messages],
            "events": [dict(row._mapping) for row in events],
            "notifications": [dict(row._mapping) for row in notifications],
        }
    
def list_active_dossiers(org_id: str = "demo_agency", limit: int = 50):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select
                    d.id,
                    d.org_id,
                    d.client_id,
                    c.phone as client_phone,
                    c.name as client_name,
                    d.case_type,
                    d.status_global,
                    d.intake_status,
                    d.validation_status,
                    d.origin_country,
                    d.origin_city,
                    d.destination_country,
                    d.destination_city,
                    d.goods_type,
                    d.estimated_weight_kg,
                    d.estimated_volume_cbm,
                    d.shipping_mode,
                    d.created_at,
                    d.updated_at
                from dossiers d
                join clients c on c.id = d.client_id
                where d.org_id = :org_id
                  and d.status_global not in ('COMPLETED', 'CLOSED', 'CANCELLED')
                order by d.updated_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]