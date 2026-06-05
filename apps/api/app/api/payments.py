from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.payments.services.payment_service import (
    create_payment_request,
    get_payments_overview,
    refresh_payment_status,
)


router = APIRouter()
ORG_ID = "demo_agency"


class CreatePaymentRequest(BaseModel):
    provider_code: str
    amount_minor: int
    currency_code: str = "USD"
    customer_phone: str
    description: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    idempotency_key: str | None = None


class RefreshPaymentStatusRequest(BaseModel):
    provider_code: str
    provider_reference: str


@router.get("/payments")
def get_payments():
    return {
        "status": "ok",
        **get_payments_overview(ORG_ID),
    }


@router.post("/payments/requests")
def create_request(body: CreatePaymentRequest):
    try:
        result = create_payment_request(
            org_id=ORG_ID,
            provider_code=body.provider_code,
            amount_minor=body.amount_minor,
            currency_code=body.currency_code,
            customer_phone=body.customer_phone,
            description=body.description,
            source_type=body.source_type,
            source_id=body.source_id,
            idempotency_key=body.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        **result,
    }


@router.post("/payments/status")
def refresh_status(body: RefreshPaymentStatusRequest):
    try:
        result = refresh_payment_status(
            org_id=ORG_ID,
            provider_code=body.provider_code,
            provider_reference=body.provider_reference,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        **result,
    }

