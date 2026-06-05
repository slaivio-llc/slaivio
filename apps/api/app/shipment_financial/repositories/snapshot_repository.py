from sqlalchemy import text

from app.db.database import engine


def create_shipment_financial_snapshot(
    shipment_id: str,
):
    with engine.connect() as conn:
        totals = conn.execute(
            text("""
                select
                    org_id,
                    currency_code,
                    coalesce(sum(case when component_type = 'REVENUE' then amount_minor else 0 end), 0) as revenue_minor,
                    coalesce(sum(case when component_type = 'COST' then amount_minor else 0 end), 0) as cost_minor
                from shipment_financial_components
                where shipment_id = :shipment_id
                group by org_id, currency_code
                order by currency_code asc
                limit 1
            """),
            {
                "shipment_id": shipment_id,
            },
        ).fetchone()

        if not totals:
            return None

        revenue_minor = int(totals._mapping["revenue_minor"])
        cost_minor = int(totals._mapping["cost_minor"])
        profit_minor = revenue_minor - cost_minor

        row = conn.execute(
            text("""
                insert into shipment_financial_snapshots (
                    org_id,
                    shipment_id,
                    total_revenue_minor,
                    total_cost_minor,
                    total_profit_minor,
                    currency_code
                )
                values (
                    :org_id,
                    :shipment_id,
                    :revenue_minor,
                    :cost_minor,
                    :profit_minor,
                    :currency_code
                )
                on conflict (shipment_id)
                do update set
                    org_id = excluded.org_id,
                    total_revenue_minor = excluded.total_revenue_minor,
                    total_cost_minor = excluded.total_cost_minor,
                    total_profit_minor = excluded.total_profit_minor,
                    currency_code = excluded.currency_code,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": totals._mapping["org_id"],
                "shipment_id": shipment_id,
                "revenue_minor": revenue_minor,
                "cost_minor": cost_minor,
                "profit_minor": profit_minor,
                "currency_code": totals._mapping["currency_code"],
            },
        ).fetchone()

        conn.execute(
            text("""
                update shipments
                set
                    revenue_minor = :revenue_minor,
                    cost_minor = :cost_minor,
                    profit_minor = :profit_minor,
                    margin_currency_code = :currency_code,
                    updated_at = now()
                where id = :shipment_id
            """),
            {
                "shipment_id": shipment_id,
                "revenue_minor": revenue_minor,
                "cost_minor": cost_minor,
                "profit_minor": profit_minor,
                "currency_code": totals._mapping["currency_code"],
            },
        )

        conn.commit()

        return dict(row._mapping) if row else None


def get_latest_shipment_financial_snapshot(
    shipment_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from shipment_financial_snapshots
                where shipment_id = :shipment_id
                order by updated_at desc
                limit 1
            """),
            {
                "shipment_id": shipment_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
