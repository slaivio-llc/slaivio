from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_financial_event(
    org_id: str,
    event_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    source_type: str | None = None,
    source_id: str | None = None,
    description: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into financial_events (
                    org_id,
                    event_type,
                    source_type,
                    source_id,
                    amount_minor,
                    currency_code,
                    description,
                    metadata
                )
                values (
                    :org_id,
                    :event_type,
                    :source_type,
                    :source_id,
                    :amount_minor,
                    :currency_code,
                    :description,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "event_type": event_type,
                "source_type": source_type,
                "source_id": source_id,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "description": description,
                "metadata": to_jsonb(metadata),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_financial_events(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from financial_events
                where org_id = :org_id
                order by created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

