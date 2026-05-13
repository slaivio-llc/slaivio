from sqlalchemy import text

from app.db.database import engine


def create_broadcast(
    org_id: str,
    title: str,
    message: str,
    broadcast_type: str = "GENERAL",
    target_type: str = "MANUAL",
    created_by: str | None = None,
    scheduled_at: str | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into broadcasts (
                    org_id,
                    title,
                    message,
                    broadcast_type,
                    target_type,
                    created_by,
                    scheduled_at
                )
                values (
                    :org_id,
                    :title,
                    :message,
                    :broadcast_type,
                    :target_type,
                    :created_by,
                    :scheduled_at
                )
                returning *
            """),
            {
                "org_id": org_id,
                "title": title.strip(),
                "message": message.strip(),
                "broadcast_type": broadcast_type.strip().upper(),
                "target_type": target_type.strip().upper(),
                "created_by": created_by,
                "scheduled_at": scheduled_at,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_broadcast(org_id: str, broadcast_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from broadcasts
                where org_id = :org_id
                  and id = :broadcast_id
                limit 1
            """),
            {
                "org_id": org_id,
                "broadcast_id": broadcast_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def list_broadcasts(
    org_id: str,
    status: str | None = None,
    limit: int = 100,
):
    filters = ["org_id = :org_id"]
    params = {"org_id": org_id, "limit": limit}

    if status:
        filters.append("status = :status")
        params["status"] = status.strip().upper()

    where_clause = " and ".join(filters)

    with engine.connect() as conn:
        result = conn.execute(
            text(f"""
                select *
                from broadcasts
                where {where_clause}
                order by created_at desc
                limit :limit
            """),
            params,
        )

        return [dict(row._mapping) for row in result.fetchall()]


def add_broadcast_recipient(
    org_id: str,
    broadcast_id: str,
    recipient_phone: str,
    client_id: str | None = None,
    dossier_id: str | None = None,
    shipment_id: str | None = None,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into broadcast_recipients (
                    org_id,
                    broadcast_id,
                    client_id,
                    dossier_id,
                    shipment_id,
                    recipient_phone
                )
                values (
                    :org_id,
                    :broadcast_id,
                    :client_id,
                    :dossier_id,
                    :shipment_id,
                    :recipient_phone
                )
                returning *
            """),
            {
                "org_id": org_id,
                "broadcast_id": broadcast_id,
                "client_id": client_id,
                "dossier_id": dossier_id,
                "shipment_id": shipment_id,
                "recipient_phone": recipient_phone,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_broadcast_recipients(org_id: str, broadcast_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from broadcast_recipients
                where org_id = :org_id
                  and broadcast_id = :broadcast_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "broadcast_id": broadcast_id,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def attach_notification_to_recipient(
    org_id: str,
    recipient_id: str,
    notification_id: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update broadcast_recipients
                set
                    notification_id = :notification_id,
                    status = 'QUEUED'
                where org_id = :org_id
                  and id = :recipient_id
                returning *
            """),
            {
                "org_id": org_id,
                "recipient_id": recipient_id,
                "notification_id": notification_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def mark_broadcast_queued(org_id: str, broadcast_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update broadcasts
                set
                    status = 'QUEUED',
                    updated_at = now()
                where org_id = :org_id
                  and id = :broadcast_id
                returning *
            """),
            {
                "org_id": org_id,
                "broadcast_id": broadcast_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def list_active_clients(org_id: str, limit: int = 1000):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select id, phone
                from clients
                where org_id = :org_id
                  and phone is not null
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def list_clients_by_dossier_status(
    org_id: str,
    status_global: str,
    limit: int = 1000,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select distinct
                    c.id as client_id,
                    c.phone,
                    d.id as dossier_id
                from dossiers d
                join clients c on c.id = d.client_id
                where d.org_id = :org_id
                  and d.status_global = :status_global
                  and c.phone is not null
                order by c.phone asc
                limit :limit
            """),
            {
                "org_id": org_id,
                "status_global": status_global,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]
