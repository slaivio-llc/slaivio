from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.billing.repositories.plan_repository import list_pricing_plans
from app.billing.services.billing_service import (
    confirm_invoice_payment,
    create_monthly_invoice,
    get_billing_overview,
    start_trial_subscription,
)


router = APIRouter()


class StartTrialRequest(BaseModel):
    plan_code: str = "STARTER"


class ConfirmPaymentRequest(BaseModel):
    invoice_id: str
    provider: str | None = None
    provider_payment_id: str | None = None
    idempotency_key: str | None = None


@router.get("/billing/plans")
def get_billing_plans():
    return {
        "status": "ok",
        "plans": list_pricing_plans(),
    }


@router.get("/billing")
def get_billing(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        "billing": get_billing_overview(org_id),
    }


@router.post("/billing/trial")
def start_trial(body: StartTrialRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        subscription = start_trial_subscription(
            org_id=org_id,
            plan_code=body.plan_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        "subscription": subscription,
    }


@router.post("/billing/invoices/monthly")
def create_monthly_billing_invoice(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        invoice = create_monthly_invoice(org_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        "invoice": invoice,
    }


@router.post("/billing/payments/confirm")
def confirm_payment(body: ConfirmPaymentRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        result = confirm_invoice_payment(
            org_id=org_id,
            invoice_id=body.invoice_id,
            provider=body.provider,
            provider_payment_id=body.provider_payment_id,
            idempotency_key=body.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        **result,
    }
