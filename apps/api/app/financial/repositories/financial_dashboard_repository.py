from sqlalchemy import text

from app.db.database import engine


def get_financial_totals(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    coalesce(sum(case when event_type in ('REVENUE', 'WALLET_TOPUP', 'INVOICE_PAYMENT') then amount_minor else 0 end), 0) as revenue_minor,
                    coalesce(sum(case when event_type in ('COST', 'WALLET_DEBIT', 'PAYMENT_PROVIDER_FEE') then amount_minor else 0 end), 0) as cost_minor,
                    coalesce(sum(case when event_type in ('REVENUE', 'WALLET_TOPUP', 'INVOICE_PAYMENT') then amount_minor else 0 end), 0)
                    -
                    coalesce(sum(case when event_type in ('COST', 'WALLET_DEBIT', 'PAYMENT_PROVIDER_FEE') then amount_minor else 0 end), 0) as net_minor
                from financial_events
                where org_id = :org_id
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else {
            "revenue_minor": 0,
            "cost_minor": 0,
            "net_minor": 0,
        }


def get_wallet_summary(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    coalesce(sum(balance_minor), 0) as balance_minor,
                    coalesce(sum(reserved_minor), 0) as reserved_minor,
                    count(*) as wallet_count
                from agency_wallets
                where org_id = :org_id
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else {
            "balance_minor": 0,
            "reserved_minor": 0,
            "wallet_count": 0,
        }


def get_invoice_summary(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    coalesce(sum(total_minor), 0) as total_invoiced_minor,
                    coalesce(sum(case when status = 'PAID' then total_minor else 0 end), 0) as paid_minor,
                    coalesce(sum(case when status != 'PAID' then total_minor else 0 end), 0) as outstanding_minor,
                    count(*) as invoice_count
                from billing_invoices
                where org_id = :org_id
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else {
            "total_invoiced_minor": 0,
            "paid_minor": 0,
            "outstanding_minor": 0,
            "invoice_count": 0,
        }


def get_recent_events(
    org_id: str,
    limit: int = 20,
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


def get_cashflow_by_day(
    org_id: str,
    days: int = 14,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    date_trunc('day', created_at)::date as day,
                    coalesce(sum(case when event_type in ('REVENUE', 'WALLET_TOPUP', 'INVOICE_PAYMENT') then amount_minor else 0 end), 0) as inflow_minor,
                    coalesce(sum(case when event_type in ('COST', 'WALLET_DEBIT', 'PAYMENT_PROVIDER_FEE') then amount_minor else 0 end), 0) as outflow_minor
                from financial_events
                where org_id = :org_id
                  and created_at >= now() - make_interval(days => :days)
                group by day
                order by day asc
            """),
            {
                "org_id": org_id,
                "days": days,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]

