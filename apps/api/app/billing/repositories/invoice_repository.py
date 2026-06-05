from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def create_invoice(
    org_id: str,
    subscription_id: str | None,
    invoice_number: str,
    amount_minor: int,
    tax_minor: int = 0,
    currency_code: str = "USD",
    status: str = "OPEN",
    due_at: str | None = None,
    metadata: dict | None = None,
):
    total_minor = amount_minor + tax_minor

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into billing_invoices (
                    org_id,
                    subscription_id,
                    invoice_number,
                    amount_minor,
                    tax_minor,
                    total_minor,
                    currency_code,
                    status,
                    due_date,
                    due_at,
                    metadata
                )
                values (
                    :org_id,
                    :subscription_id,
                    :invoice_number,
                    :amount_minor,
                    :tax_minor,
                    :total_minor,
                    :currency_code,
                    :status,
                    cast(:due_at as timestamptz),
                    cast(:due_at as timestamptz),
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "subscription_id": subscription_id,
                "invoice_number": invoice_number,
                "amount_minor": amount_minor,
                "tax_minor": tax_minor,
                "total_minor": total_minor,
                "currency_code": currency_code,
                "status": status,
                "due_at": due_at,
                "metadata": to_jsonb(metadata),
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def get_invoice(
    invoice_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from billing_invoices
                where id = :invoice_id
                limit 1
            """),
            {
                "invoice_id": invoice_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def list_invoices(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from billing_invoices
                where org_id = :org_id
                order by created_at desc
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def mark_invoice_paid(
    invoice_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update billing_invoices
                set
                    status = 'PAID',
                    paid_at = now(),
                    updated_at = now()
                where id = :invoice_id
                returning *
            """),
            {
                "invoice_id": invoice_id,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None
