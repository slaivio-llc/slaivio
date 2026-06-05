from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def get_idempotency_key(
    key: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from financial_idempotency_keys
                where idempotency_key = :key
                limit 1
            """),
            {
                "key": key,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def mark_idempotency_key(
    org_id: str,
    key: str,
    operation_type: str,
    request_hash: str | None = None,
    response_payload: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into financial_idempotency_keys (
                    org_id,
                    idempotency_key,
                    operation_type,
                    request_hash,
                    response_payload
                )
                values (
                    :org_id,
                    :key,
                    :operation_type,
                    :request_hash,
                    cast(:response_payload as jsonb)
                )
                on conflict (idempotency_key)
                do update set
                    response_payload = excluded.response_payload
                returning *
            """),
            {
                "org_id": org_id,
                "key": key,
                "operation_type": operation_type,
                "request_hash": request_hash,
                "response_payload": to_jsonb(response_payload),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None

