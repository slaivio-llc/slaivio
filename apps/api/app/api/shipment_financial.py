from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.shipment_financial.services.shipment_financial_service import (
    add_shipment_financial_component,
    get_shipment_financials,
)


router = APIRouter()
ORG_ID = "demo_agency"


class ShipmentFinancialComponentRequest(BaseModel):
    component_type: str
    component_code: str
    amount_minor: int
    currency_code: str = "USD"
    description: str | None = None
    accounting_category_id: str | None = None


@router.get("/shipments/{shipment_id}/financials")
def get_financials(shipment_id: str):
    return {
        "status": "ok",
        **get_shipment_financials(shipment_id),
    }


@router.post("/shipments/{shipment_id}/financials/components")
def add_component(
    shipment_id: str,
    body: ShipmentFinancialComponentRequest,
):
    try:
        result = add_shipment_financial_component(
            org_id=ORG_ID,
            shipment_id=shipment_id,
            component_type=body.component_type,
            component_code=body.component_code,
            amount_minor=body.amount_minor,
            currency_code=body.currency_code,
            description=body.description,
            accounting_category_id=body.accounting_category_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        **result,
    }

