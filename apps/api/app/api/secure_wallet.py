from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.permissions import require_permission
from app.wallet.services.secure_wallet_service import apply_secure_wallet_transaction


router = APIRouter()
ORG_ID = "demo_agency"


class SecureWalletTransactionRequest(BaseModel):
    transaction_type: str
    amount_minor: int
    currency_code: str = "USD"
    source_type: str | None = None
    source_id: str | None = None
    description: str | None = None
    idempotency_key: str | None = None


@router.post(
    "/wallet/secure/transactions",
    dependencies=[
        Depends(require_permission("wallet.write")),
    ],
)
def secure_wallet_transaction(body: SecureWalletTransactionRequest):
    try:
        result = apply_secure_wallet_transaction(
            org_id=ORG_ID,
            transaction_type=body.transaction_type,
            amount_minor=body.amount_minor,
            currency_code=body.currency_code,
            source_type=body.source_type,
            source_id=body.source_id,
            description=body.description,
            idempotency_key=body.idempotency_key,
            actor_id="dashboard",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result
