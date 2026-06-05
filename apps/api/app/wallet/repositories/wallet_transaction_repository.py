from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_wallet_transaction(
    wallet_id: str,
    org_id: str,
    transaction_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    source_type: str | None = None,
    source_id: str | None = None,
    description: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into wallet_transactions (
                    wallet_id,
                    org_id,
                    transaction_type,
                    amount_minor,
                    currency_code,
                    source_type,
                    source_id,
                    description,
                    idempotency_key,
                    metadata
                )
                values (
                    :wallet_id,
                    :org_id,
                    :transaction_type,
                    :amount_minor,
                    :currency_code,
                    :source_type,
                    :source_id,
                    :description,
                    :idempotency_key,
                    cast(:metadata as jsonb)
                )
                on conflict (idempotency_key)
                where idempotency_key is not null
                do update set updated_at = now()
                returning *
            """),
            {
                "wallet_id": wallet_id,
                "org_id": org_id,
                "transaction_type": transaction_type,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "source_type": source_type,
                "source_id": source_id,
                "description": description,
                "idempotency_key": idempotency_key,
                "metadata": to_jsonb(metadata),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_wallet_transactions(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from wallet_transactions
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

