from app.financial.services.financial_service import record_money_event
from app.wallet.repositories.usage_rule_repository import get_usage_charge_rule
from app.wallet.repositories.wallet_repository import (
    get_or_create_wallet,
    get_wallet,
    update_wallet_balance,
)
from app.wallet.repositories.wallet_transaction_repository import (
    create_wallet_transaction,
    list_wallet_transactions,
)


def get_wallet_overview(
    org_id: str,
    currency_code: str = "USD",
):
    return {
        "wallet": get_or_create_wallet(org_id, currency_code),
        "transactions": list_wallet_transactions(org_id),
    }


def top_up_wallet(
    org_id: str,
    amount_minor: int,
    currency_code: str = "USD",
    source_type: str | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    wallet = get_or_create_wallet(org_id, currency_code)
    updated_wallet = update_wallet_balance(str(wallet["id"]), amount_minor)

    transaction = create_wallet_transaction(
        wallet_id=str(wallet["id"]),
        org_id=org_id,
        transaction_type="CREDIT",
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type=source_type,
        source_id=source_id,
        description="Wallet top-up",
        idempotency_key=idempotency_key,
    )

    record_money_event(
        org_id=org_id,
        event_type="WALLET_TOPUP",
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type="wallet_transaction",
        source_id=str(transaction["id"]) if transaction else None,
        description="Wallet credited",
    )

    return {
        "wallet": updated_wallet,
        "transaction": transaction,
    }


def charge_wallet_usage(
    org_id: str,
    usage_type: str,
    units: int = 1,
    currency_code: str = "USD",
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    rule = get_usage_charge_rule(usage_type)

    if not rule:
        raise ValueError("usage_rule_not_found")

    amount_minor = int(rule["unit_price_minor"]) * units
    wallet = get_wallet(org_id, currency_code) or get_or_create_wallet(org_id, currency_code)

    if int(wallet["balance_minor"]) < amount_minor:
        raise ValueError("insufficient_wallet_balance")

    updated_wallet = update_wallet_balance(str(wallet["id"]), -amount_minor)

    transaction = create_wallet_transaction(
        wallet_id=str(wallet["id"]),
        org_id=org_id,
        transaction_type="DEBIT",
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type=usage_type,
        source_id=source_id,
        description=f"Usage charge: {usage_type}",
        idempotency_key=idempotency_key,
        metadata={
            "units": units,
            "unit_price_minor": rule["unit_price_minor"],
        },
    )

    record_money_event(
        org_id=org_id,
        event_type="WALLET_DEBIT",
        amount_minor=amount_minor,
        currency_code=currency_code,
        source_type="wallet_transaction",
        source_id=str(transaction["id"]) if transaction else None,
        description=f"Wallet debited for {usage_type}",
    )

    return {
        "wallet": updated_wallet,
        "transaction": transaction,
    }

