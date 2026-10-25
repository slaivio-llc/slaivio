from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from uuid import UUID
from starlette.concurrency import run_in_threadpool
from app.core.permissions import require_permission
from app.core.platform_permissions import require_platform_permission
from app.billing.services import saspay_service, saspay_client
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.core.auth import get_current_manager
from app.billing.services.billing_identity import billing_identity
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
def get_billing(tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    org_id = tenant["org_id"]

    overview = get_billing_overview(org_id)
    try:
        overview['payer'] = billing_identity(manager)
    except HTTPException:
        # An identity outage must not hide invoices or the current subscription.
        overview['payer'] = None
    return {
        "status": "ok",
        "billing": overview,
    }


@router.get('/billing/status')
def billing_status(tenant=Depends(get_current_tenant)):
    # Lightweight header read: do not load invoices or all agency usage here.
    from app.billing.repositories.saspay_repository import ensure_trial
    subscription=ensure_trial(tenant['org_id'])
    return {'subscription':{'status':subscription['status'],
            'trial_ends_at':subscription.get('trial_ends_at'),
            'ends_at':subscription.get('ends_at')}}


@router.post("/billing/trial",dependencies=[Depends(require_permission('organization.manage'))])
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


@router.post("/billing/invoices/monthly",dependencies=[Depends(require_platform_permission('platform.billing.manage'))])
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


@router.post("/billing/payments/confirm",dependencies=[Depends(require_platform_permission('platform.billing.manage'))])
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


class CheckoutRequest(BaseModel):
    plan_code:str=Field(default='STARTER',pattern=r'^[A-Z][A-Z0-9_]{1,39}$')


@router.post('/billing/checkout',dependencies=[Depends(require_permission('organization.manage'))])
def create_checkout(body:CheckoutRequest,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    payer = billing_identity(manager)
    return saspay_service.start_checkout(tenant['org_id'],body.plan_code,payer['email'],payer['name'])


@router.post('/billing/checkout/{checkout_id}/verify',dependencies=[Depends(require_permission('organization.manage'))])
def verify_checkout(checkout_id:UUID,tenant=Depends(get_current_tenant)):
    return saspay_service.verify_checkout(str(checkout_id),tenant['org_id'])


@router.post('/billing/webhooks/saspay')
async def saspay_webhook(request:Request):
    body=await request.body()
    if len(body)>65536:
        raise HTTPException(413,'webhook_body_too_large')
    saspay_client.verify_signature(body,request.headers.get('X-Webhook-Signature',''),request.headers.get('X-Webhook-Timestamp',''))
    try:
        import json
        event=json.loads(body)
        if not isinstance(event,dict) or event.get('event')!=request.headers.get('X-Webhook-Event'):
            raise ValueError('event_mismatch')
    except (ValueError,UnicodeDecodeError) as exc:
        raise HTTPException(400,'saspay_webhook_invalid') from exc
    return await run_in_threadpool(saspay_service.process_webhook,event)


@router.post('/billing/checkout/{checkout_id}/cancel',dependencies=[Depends(require_permission('organization.manage'))])
def cancel_checkout(checkout_id:UUID,tenant=Depends(get_current_tenant)):
    return saspay_service.cancel_checkout(str(checkout_id),tenant['org_id'])
