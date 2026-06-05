from app.financial.repositories.financial_dashboard_repository import (
    get_cashflow_by_day,
    get_financial_totals,
    get_invoice_summary,
    get_recent_events,
    get_wallet_summary,
)


def get_financial_dashboard(
    org_id: str,
):
    totals = get_financial_totals(org_id)
    wallet = get_wallet_summary(org_id)
    invoices = get_invoice_summary(org_id)

    return {
        "totals": totals,
        "wallet": wallet,
        "invoices": invoices,
        "cashflow": get_cashflow_by_day(org_id),
        "recent_events": get_recent_events(org_id),
    }

