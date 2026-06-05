from sqlalchemy import text

from app.db.database import engine


def update_shipment_margin(
    shipment_id: str,
    revenue_minor: int,
    cost_minor: int,
    currency_code: str = "USD",
):
    profit_minor = revenue_minor - cost_minor

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update shipments
                set
                    revenue_minor = :revenue_minor,
                    cost_minor = :cost_minor,
                    profit_minor = :profit_minor,
                    margin_currency_code = :currency_code,
                    updated_at = now()
                where id = :shipment_id
                returning *
            """),
            {
                "shipment_id": shipment_id,
                "revenue_minor": revenue_minor,
                "cost_minor": cost_minor,
                "profit_minor": profit_minor,
                "currency_code": currency_code,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None

