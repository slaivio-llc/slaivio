from sqlalchemy import text

from app.db.database import engine


def transition_allowed(
    previous_status: str | None,
    next_status: str,
) -> bool:
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select 1
                from shipment_status_transitions
                where active = true
                  and (
                    from_status = :previous_status
                    or from_status = 'ANY'
                    or (:previous_status is null and from_status is null)
                  )
                  and to_status = :next_status
                limit 1
            """),
            {
                "previous_status": previous_status,
                "next_status": next_status,
            },
        ).fetchone()

        return row is not None


def list_transitions():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_status_transitions
                where active = true
                order by from_status nulls first, to_status
            """),
        ).fetchall()

        return [dict(row._mapping) for row in rows]

