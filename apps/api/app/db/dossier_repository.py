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
                where org_id = :org_id
                  and id = :client_id
                limit 1
            """),
            {
                "org_id": org_id,
                "client_id": dossier_dict["client_id"],
            },
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
                where org_id = :org_id
                  and dossier_id = :dossier_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        ).fetchall()

        events = conn.execute(
            text("""
                select
                    id,
                    event_type,
                    payload,
                    created_at
                from dossier_events
                where org_id = :org_id
                  and dossier_id = :dossier_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
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
                where org_id = :org_id
                  and dossier_id = :dossier_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
            },
        ).fetchall()

        return {
            "dossier": dossier_dict,
            "client": dict(client._mapping) if client else None,
            "messages": [dict(row._mapping) for row in messages],
            "events": [dict(row._mapping) for row in events],
            "notifications": [dict(row._mapping) for row in notifications],
        }


def list_active_dossiers(
    org_id: str,
    status_global: str | None = None,
    case_type: str | None = None,
    intake_status: str | None = None,
    validation_status: str | None = None,
    limit: int = 50,
):
    filters = [
        "d.org_id = :org_id",
        "d.status_global not in ('COMPLETED', 'CLOSED', 'CANCELLED')",
    ]

    params = {
        "org_id": org_id,
        "limit": limit,
    }

    if status_global:
        filters.append("d.status_global = :status_global")
        params["status_global"] = status_global

    if case_type:
        filters.append("d.case_type = :case_type")
        params["case_type"] = case_type

    if intake_status:
        filters.append("d.intake_status = :intake_status")
        params["intake_status"] = intake_status

    if validation_status:
        filters.append("d.validation_status = :validation_status")
        params["validation_status"] = validation_status

    where_clause = " and ".join(filters)

    query = text(f"""
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
        join clients c
          on c.id = d.client_id
         and c.org_id = d.org_id
        where {where_clause}
        order by d.updated_at desc
        limit :limit
    """)

    with engine.connect() as conn:
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result.fetchall()]
