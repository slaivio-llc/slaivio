from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.wallet.repositories.usage_rule_repository import list_usage_charge_rules
from app.wallet.services.wallet_service import (
    charge_wallet_usage,
    get_wallet_overview,
    top_up_wallet,
)


router = APIRouter()
ORG_ID = "demo_agency"


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
def get_wallet():
    return {
        "status": "ok",
        **get_wallet_overview(ORG_ID),
    }


@router.get("/wallet/usage-rules")
def get_usage_rules():
    return {
        "status": "ok",
        "rules": list_usage_charge_rules(),
    }


@router.post("/wallet/top-up")
def wallet_top_up(body: WalletTopUpRequest):
    try:
        result = top_up_wallet(
            org_id=ORG_ID,
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
def wallet_charge(body: WalletUsageRequest):
    try:
        result = charge_wallet_usage(
            org_id=ORG_ID,
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

