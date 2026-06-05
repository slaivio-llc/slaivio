from app.accounting.services.accounting_service import record_accounting_entry
from app.shipment_financial.repositories.component_repository import (
    create_shipment_financial_component,
    list_shipment_financial_components,
)
from app.shipment_financial.repositories.snapshot_repository import (
    create_shipment_financial_snapshot,
    get_latest_shipment_financial_snapshot,
)


def add_shipment_financial_component(
    org_id: str,
    shipment_id: str,
    component_type: str,
    component_code: str,
    amount_minor: int,
    currency_code: str,
    description: str | None = None,
    accounting_category_id: str | None = None,
):
    component = create_shipment_financial_component(
        org_id=org_id,
        shipment_id=shipment_id,
        component_type=component_type,
        component_code=component_code,
        amount_minor=amount_minor,
        currency_code=currency_code,
        description=description,
    )

    if accounting_category_id:
        record_accounting_entry(
            org_id=org_id,
            category_id=accounting_category_id,
            entry_type="INCOME" if component_type == "REVENUE" else "EXPENSE",
            amount_minor=amount_minor,
            currency_code=currency_code,
            description=description,
            source_type="shipment_financial_component",
            source_id=str(component["id"]) if component else None,
        )

    snapshot = create_shipment_financial_snapshot(shipment_id)

    return {
        "component": component,
        "snapshot": snapshot,
    }


def get_shipment_financials(
    shipment_id: str,
):
    return {
        "components": list_shipment_financial_components(shipment_id),
        "snapshot": get_latest_shipment_financial_snapshot(shipment_id),
    }

