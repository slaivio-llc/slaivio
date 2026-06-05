from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_accounting_entry(
    org_id: str,
    category_id: str,
    entry_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    description: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into accounting_entries (
                    org_id,
                    category_id,
                    entry_type,
                    amount_minor,
                    currency_code,
                    description,
                    entity_type,
                    entity_id,
                    metadata
                )
                values (
                    :org_id,
                    :category_id,
                    :entry_type,
                    :amount_minor,
                    :currency_code,
                    :description,
                    :source_type,
                    :source_id,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "category_id": category_id,
                "entry_type": entry_type,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "description": description,
                "source_type": source_type,
                "source_id": source_id,
                "metadata": to_jsonb(metadata),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_accounting_entries(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select e.*, c.code as category_code, c.name as category_name
                from accounting_entries e
                left join accounting_categories c
                    on c.id = e.category_id
                where e.org_id = :org_id
                order by e.created_at desc
                limit :limit
            """),
            {
                "org_id": org_id,
                "limit": limit,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]
