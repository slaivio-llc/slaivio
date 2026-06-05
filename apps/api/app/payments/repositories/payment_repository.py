from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def list_payment_providers():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from payment_providers
                where active = true
                order by code asc
            """),
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def get_payment_provider(
    provider_code: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from payment_providers
                where code = :provider_code
                  and active = true
                limit 1
            """),
            {
                "provider_code": provider_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def create_payment_request_record(
    org_id: str,
    provider_code: str,
    amount_minor: int,
    currency_code: str,
    customer_phone: str,
    description: str | None,
    provider_reference: str | None,
    status: str,
    source_type: str | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
    raw_response: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into payment_requests (
                    org_id,
                    provider_code,
                    amount_minor,
                    currency_code,
                    customer_phone,
                    description,
                provider_reference,
                external_reference,
                    status,
                    source_type,
                    source_id,
                    idempotency_key,
                    raw_response
                )
                values (
                    :org_id,
                    :provider_code,
                    :amount_minor,
                    :currency_code,
                    :customer_phone,
                    :description,
                :provider_reference,
                :provider_reference,
                    :status,
                    :source_type,
                    :source_id,
                    :idempotency_key,
                    cast(:raw_response as jsonb)
                )
                on conflict (idempotency_key)
                where idempotency_key is not null
                do update set updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "provider_code": provider_code,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "customer_phone": customer_phone,
                "description": description,
                "provider_reference": provider_reference,
                "status": status,
                "source_type": source_type,
                "source_id": source_id,
                "idempotency_key": idempotency_key,
                "raw_response": to_jsonb(raw_response),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def update_payment_request_status(
    provider_reference: str,
    status: str,
    raw_response: dict | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update payment_requests
                set
                    status = :status,
                    paid_at = case when :status = 'SUCCEEDED' then now() else paid_at end,
                    failed_at = case when :status = 'FAILED' then now() else failed_at end,
                    raw_response = cast(:raw_response as jsonb),
                    updated_at = now()
                where provider_reference = :provider_reference
                returning *
            """),
            {
                "provider_reference": provider_reference,
                "status": status,
                "raw_response": to_jsonb(raw_response),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def list_payment_requests(
    org_id: str,
    limit: int = 100,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from payment_requests
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
