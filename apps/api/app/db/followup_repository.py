from sqlalchemy import text
from app.db.database import engine


def create_followup_task(
    org_id: str,
    client_id: str,
    dossier_id: str,
    followup_type: str,
    message: str,
    due_minutes: int = 1440,
    shipment_id: str | None = None,
):
    existing = get_pending_followup_by_type(
        org_id=org_id,
        dossier_id=dossier_id,
        followup_type=followup_type,
    )

    if existing:
        existing["already_exists"] = True
        return existing

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                insert into followup_tasks (
                    org_id,
                    client_id,
                    dossier_id,
                    shipment_id,
                    followup_type,
                    message,
                    due_at
                )
                values (
                    :org_id,
                    :client_id,
                    :dossier_id,
                    :shipment_id,
                    :followup_type,
                    :message,
                    now() + (:due_minutes || ' minutes')::interval
                )
                returning *
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
                "dossier_id": dossier_id,
                "shipment_id": shipment_id,
                "followup_type": followup_type,
                "message": message,
                "due_minutes": due_minutes,
            },
        )

        conn.commit()
        row = result.fetchone()

        followup = dict(row._mapping) if row else None

        if followup:
            followup["already_exists"] = False

        return followup


def list_due_followups(org_id: str, limit: int = 50):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from followup_tasks
                where org_id = :org_id
                  and status = 'PENDING'
                  and due_at <= now()
                order by due_at asc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        )

        return [dict(row._mapping) for row in result.fetchall()]


def mark_followup_executed(org_id: str, followup_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update followup_tasks
                set
                    status = 'EXECUTED',
                    executed_at = now()
                where org_id = :org_id
                  and id = :followup_id
                returning *
            """),
            {
                "org_id": org_id,
                "followup_id": followup_id,
            },
        )

        conn.commit()
        row = result.fetchone()

        return dict(row._mapping) if row else None


def get_followup_with_client_phone(org_id: str, followup_id: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select
                    f.*,
                    c.phone as client_phone
                from followup_tasks f
                left join clients c
                  on c.id = f.client_id
                 and c.org_id = f.org_id
                where f.org_id = :org_id
                  and f.id = :followup_id
                limit 1
            """),
            {
                "org_id": org_id,
                "followup_id": followup_id,
            },
        ).fetchone()

        return dict(result._mapping) if result else None


def cancel_pending_followups_for_dossier(
    org_id: str,
    dossier_id: str,
    reason: str = "client_replied",
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                update followup_tasks
                set
                    status = 'CANCELLED',
                    cancelled_at = now(),
                    error_message = :reason
                where org_id = :org_id
                  and dossier_id = :dossier_id
                  and status = 'PENDING'
                returning id, followup_type, status, cancelled_at
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "reason": reason,
            },
        )

        conn.commit()

        return [dict(row._mapping) for row in result.fetchall()]


def get_pending_followup_by_type(
    org_id: str,
    dossier_id: str,
    followup_type: str,
):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                select *
                from followup_tasks
                where org_id = :org_id
                  and dossier_id = :dossier_id
                  and followup_type = :followup_type
                  and status = 'PENDING'
                order by created_at desc
                limit 1
            """),
            {
                "org_id": org_id,
                "dossier_id": dossier_id,
                "followup_type": followup_type,
            },
        ).fetchone()

        return dict(result._mapping) if result else None

