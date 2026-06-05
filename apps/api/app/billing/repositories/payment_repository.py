from sqlalchemy import text

from app.db.database import engine


def create_billing_payment(
    org_id: str,
    invoice_id: str,
    amount_minor: int,
    currency_code: str = "USD",
    provider: str | None = None,
    provider_payment_id: str | None = None,
    status: str = "SUCCEEDED",
    idempotency_key: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into billing_payments (
                    org_id,
                    invoice_id,
                    amount_minor,
                    currency_code,
                    provider,
                    provider_payment_id,
                    payment_method,
                    provider_reference,
                    status,
                    paid_at,
                    idempotency_key
                )
                values (
                    :org_id,
                    :invoice_id,
                    :amount_minor,
                    :currency_code,
                    :provider,
                    :provider_payment_id,
                    coalesce(:provider, 'MANUAL'),
                    :provider_payment_id,
                    :status,
                    case when :status = 'SUCCEEDED' then now() else null end,
                    :idempotency_key
                )
                on conflict (idempotency_key)
                where idempotency_key is not null
                do update set
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "invoice_id": invoice_id,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "provider": provider,
                "provider_payment_id": provider_payment_id,
                "status": status,
                "idempotency_key": idempotency_key,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None
