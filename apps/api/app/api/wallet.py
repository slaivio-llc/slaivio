from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.tenant_context import get_current_tenant
from app.wallet.repositories.usage_rule_repository import list_usage_charge_rules
from app.wallet.services.wallet_service import (
    charge_wallet_usage,
    get_wallet_overview,
    top_up_wallet,
)


router = APIRouter()


class WalletTopUpRequest(BaseModel):
    amount_minor: int
    currency_code: str = "USD"
    source_type: str | None = None
    source_id: str | None = None
    idempotency_key: str | None = None


class WalletUsageRequest(BaseModel):
    usage_type: str
    units: int = 1
    currency_code: str = "USD"
    source_id: str | None = None
    idempotency_key: str | None = None


@router.get("/wallet")
def get_wallet(tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    return {
        "status": "ok",
        **get_wallet_overview(org_id),
    }


@router.get("/wallet/usage-rules")
def get_usage_rules():
    return {
        "status": "ok",
        "rules": list_usage_charge_rules(),
    }


@router.post("/wallet/top-up")
def wallet_top_up(body: WalletTopUpRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        result = top_up_wallet(
            org_id=org_id,
            amount_minor=body.amount_minor,
            currency_code=body.currency_code,
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


@router.post("/wallet/charge")
def wallet_charge(body: WalletUsageRequest, tenant=Depends(get_current_tenant)):
    org_id = tenant["org_id"]

    try:
        result = charge_wallet_usage(
            org_id=org_id,
            usage_type=body.usage_type,
            units=body.units,
            currency_code=body.currency_code,
            source_id=body.source_id,
            idempotency_key=body.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        **result,
    }
