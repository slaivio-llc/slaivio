from sqlalchemy import text

from app.db.database import engine
from app.financial.repositories.json_utils import to_jsonb


def apply_secure_wallet_transaction(
    org_id: str,
    transaction_type: str,
    amount_minor: int,
    currency_code: str = "USD",
    source_type: str | None = None,
    source_id: str | None = None,
    description: str | None = None,
    idempotency_key: str | None = None,
    actor_id: str | None = None,
):
    if amount_minor <= 0:
        raise ValueError("amount_must_be_positive")

    if transaction_type not in {"CREDIT", "DEBIT"}:
        raise ValueError("invalid_transaction_type")

    with engine.begin() as conn:
        if idempotency_key:
            existing = conn.execute(
                text("""
                    select *
                    from wallet_transactions
                    where idempotency_key = :idempotency_key
                    limit 1
                """),
                {
                    "idempotency_key": idempotency_key,
                },
            ).fetchone()

            if existing:
                wallet = conn.execute(
                    text("""
                        select *
                        from agency_wallets
                        where id = :wallet_id
                    """),
                    {
                        "wallet_id": existing._mapping["wallet_id"],
                    },
                ).fetchone()

                return {
                    "status": "duplicate",
                    "wallet": dict(wallet._mapping) if wallet else None,
                    "transaction": dict(existing._mapping),
                }

        wallet = conn.execute(
            text("""
                insert into agency_wallets (
                    org_id,
                    currency_code
                )
                values (
                    :org_id,
                    :currency_code
                )
                on conflict (org_id)
                do update set updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "currency_code": currency_code,
            },
        ).fetchone()

        locked_wallet = conn.execute(
            text("""
                select *
                from agency_wallets
                where id = :wallet_id
                for update
            """),
            {
                "wallet_id": wallet._mapping["id"],
            },
        ).fetchone()

        current_balance = int(locked_wallet._mapping["balance_minor"])
        delta = amount_minor if transaction_type == "CREDIT" else -amount_minor

        if transaction_type == "DEBIT" and current_balance < amount_minor:
            raise ValueError("insufficient_wallet_balance")

        updated_wallet = conn.execute(
            text("""
                update agency_wallets
                set
                    balance_minor = balance_minor + :delta,
                    updated_at = now()
                where id = :wallet_id
                returning *
            """),
            {
                "wallet_id": locked_wallet._mapping["id"],
                "delta": delta,
            },
        ).fetchone()

        transaction = conn.execute(
            text("""
                insert into wallet_transactions (
                    wallet_id,
                    org_id,
                    transaction_type,
                    amount_minor,
                    currency_code,
                    source_type,
                    source_id,
                    description,
                    idempotency_key
                )
                values (
                    :wallet_id,
                    :org_id,
                    :transaction_type,
                    :amount_minor,
                    :currency_code,
                    :source_type,
                    :source_id,
                    :description,
                    :idempotency_key
                )
                returning *
            """),
            {
                "wallet_id": locked_wallet._mapping["id"],
                "org_id": org_id,
                "transaction_type": transaction_type,
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "source_type": source_type,
                "source_id": source_id,
                "description": description,
                "idempotency_key": idempotency_key,
            },
        ).fetchone()

        event_type = "WALLET_TOPUP" if transaction_type == "CREDIT" else "WALLET_DEBIT"

        event = conn.execute(
            text("""
                insert into financial_events (
                    org_id,
                    event_type,
                    source_type,
                    source_id,
                    amount_minor,
                    currency_code,
                    description,
                    metadata
                )
                values (
                    :org_id,
                    :event_type,
                    'wallet_transaction',
                    :source_id,
                    :amount_minor,
                    :currency_code,
                    :description,
                    cast(:metadata as jsonb)
                )
                returning *
            """),
            {
                "org_id": org_id,
                "event_type": event_type,
                "source_id": str(transaction._mapping["id"]),
                "amount_minor": amount_minor,
                "currency_code": currency_code,
                "description": description,
                "metadata": to_jsonb({
                    "transaction_type": transaction_type,
                    "source_type": source_type,
                    "source_id": source_id,
                }),
            },
        ).fetchone()

        conn.execute(
            text("""
                insert into financial_audit_logs (
                    org_id,
                    actor_id,
                    action,
                    entity_type,
                    entity_id,
                    after_state,
                    severity
                )
                values (
                    :org_id,
                    :actor_id,
                    :action,
                    'wallet_transaction',
                    :entity_id,
                    cast(:after_state as jsonb),
                    'INFO'
                )
            """),
            {
                "org_id": org_id,
                "actor_id": actor_id,
                "action": f"wallet:{transaction_type.lower()}",
                "entity_id": str(transaction._mapping["id"]),
                "after_state": to_jsonb({
                    "wallet": dict(updated_wallet._mapping),
                    "transaction": dict(transaction._mapping),
                    "event_id": str(event._mapping["id"]) if event else None,
                }),
            },
        )

        return {
            "status": "ok",
            "wallet": dict(updated_wallet._mapping),
            "transaction": dict(transaction._mapping),
        }
