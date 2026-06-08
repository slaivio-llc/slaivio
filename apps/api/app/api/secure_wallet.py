from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.permissions import require_permission
from app.core.entitlements import require_entitlement
from app.core.features import require_feature
from app.core.tenant_context import get_current_tenant
from app.wallet.services.secure_wallet_service import apply_secure_wallet_transaction


router = APIRouter()


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
        Depends(require_feature("wallet")),
        Depends(require_entitlement("wallet")),
    ],
)
def secure_wallet_transaction(
    body: SecureWalletTransactionRequest,
    tenant: dict = Depends(get_current_tenant),
):
    try:
        result = apply_secure_wallet_transaction(
            org_id=tenant["org_id"],
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
