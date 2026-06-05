from app.accounting.repositories.entry_repository import (
    create_accounting_entry,
    list_accounting_entries,
)
from app.financial.services.financial_service import record_money_event


def record_accounting_entry(
    org_id: str,
    category_id: str,
    entry_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    description: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
):
    entry = create_accounting_entry(
        org_id=org_id,
        category_id=category_id,
        entry_type=entry_type,
        amount_minor=amount_minor,
        currency_code=currency_code,
        description=description,
        source_type=source_type,
        source_id=source_id,
    )

    event_type = "REVENUE" if entry_type == "INCOME" else "COST"

    record_money_event(
        org_id=org_id,
        event_type=event_type,
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type="accounting_entry",
        source_id=str(entry["id"]) if entry else None,
        description=description,
    )

    return entry


def get_accounting_overview(
    org_id: str,
):
    return {
        "entries": list_accounting_entries(org_id),
    }

