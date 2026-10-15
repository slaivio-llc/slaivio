from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from app.core.config import settings
from app.db.database import engine
from app.finance import repository as finance
from app.finance.saspay import (
    SasPayClient,
    SasPayError,
    decrypt_secret,
    encrypt_secret,
    validate_checkout,
    validate_verified_transaction,
    verify_webhook_signature,
)


def configure_connection(org_id: str, merchant_id: str, environment: str,
                         api_key: str, signing_secret: str, actor_id: str) -> dict:
    environment = environment.upper()
    if environment not in {"TEST", "LIVE"}:
        raise HTTPException(422, "saspay_environment_invalid")
    if environment == "LIVE" and settings.app_env != "production":
        raise HTTPException(403, "saspay_live_disabled_in_this_environment")
    key_prefix = "sk_test_" if environment == "TEST" else "sk_live_"
    if not merchant_id.strip() or not api_key.startswith(key_prefix) or not signing_secret.strip():
        raise HTTPException(422, "saspay_credentials_invalid")
    try:
        merchant_id = str(UUID(merchant_id.strip()))
    except ValueError:
        raise HTTPException(422, "saspay_merchant_id_invalid")
    encrypted_key = encrypt_secret(api_key)
    encrypted_secret = encrypt_secret(signing_secret)
    try:
        with engine.begin() as conn:
            row = conn.execute(text("""insert into finance_saspay_connections(
                  org_id,merchant_id,environment,encrypted_api_key,encrypted_signing_secret,
                  is_active,configured_by)
                values(:org,:merchant,:environment,:key,:secret,true,:actor)
                on conflict(org_id) do update set
                  merchant_id=excluded.merchant_id,
                  environment=excluded.environment,
                  encrypted_api_key=excluded.encrypted_api_key,
                  encrypted_signing_secret=excluded.encrypted_signing_secret,
                  is_active=true,configured_by=excluded.configured_by,updated_at=now()
                returning org_id,merchant_id,environment,is_active,updated_at"""), {
                    "org": org_id, "merchant": merchant_id,
                    "environment": environment, "key": encrypted_key,
                    "secret": encrypted_secret, "actor": actor_id,
                }).mappings().one()
            return dict(row)
    except IntegrityError:
        raise HTTPException(409, "saspay_merchant_already_linked")


def connection_status(org_id: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(text("""select merchant_id,environment,is_active,updated_at
            from finance_saspay_connections where org_id=:org"""), {"org": org_id}).mappings().first()
    if not row:
        return {"configured": False, "active": False}
    return {"configured": True, **dict(row), "active": bool(row["is_active"])}


def get_attempt(org_id: str, document_id: str, attempt_id: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(text("""select * from finance_saspay_attempts
            where org_id=:org and document_id=:document and id=cast(:id as uuid)"""),
            {"org": org_id, "document": document_id, "id": attempt_id}).mappings().first()
    if not row:
        raise HTTPException(404, "saspay_attempt_not_found")
    return _public_attempt(dict(row))


def get_open_attempt(org_id: str, document_id: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(text("""select * from finance_saspay_attempts
            where org_id=:org and document_id=:document
              and status in ('CREATING','PENDING','AMBIGUOUS')
            order by created_at desc limit 1"""),
            {"org": org_id, "document": document_id}).mappings().first()
    return _public_attempt(dict(row)) if row else None


def _load_connection(org_id: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(text("""select merchant_id,environment,encrypted_api_key,
              encrypted_signing_secret,is_active
            from finance_saspay_connections where org_id=:org"""), {"org": org_id}).mappings().first()
    if not row or not row["is_active"]:
        raise HTTPException(503, "saspay_merchant_not_configured")
    return {
        **dict(row),
        "api_key": decrypt_secret(row["encrypted_api_key"]),
        "signing_secret": decrypt_secret(row["encrypted_signing_secret"]),
    }


def _public_attempt(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "status": row["status"],
        "requested_amount": str(row["requested_amount"]),
        "currency": row["currency"],
        "checkout_url": row.get("checkout_url"),
        "created_at": row.get("created_at"),
    }


def start_checkout(org_id: str, document_id: str, idempotency_key: str,
                   actor_id: str, client: SasPayClient | None = None) -> dict:
    connection_data = _load_connection(org_id)
    attempt_id = str(uuid4())
    with engine.begin() as conn:
        doc = conn.execute(text("""select d.id,d.document_number,d.status,d.currency,
              d.balance_due,d.office_id,c.name client_name,c.email client_email,c.phone client_phone
            from finance_documents d
            join clients c on c.org_id=d.org_id and c.id=d.client_id and c.deleted_at is null
            where d.org_id=:org and d.id=:document and d.document_type='INVOICE'
            for update of d"""), {"org": org_id, "document": document_id}).mappings().first()
        if not doc:
            raise HTTPException(404, "finance_document_not_found")
        old = conn.execute(text("""select * from finance_saspay_attempts
            where org_id=:org and idempotency_key=:key"""),
            {"org": org_id, "key": idempotency_key}).mappings().first()
        if old:
            if str(old["document_id"]) != document_id:
                raise HTTPException(409, "saspay_idempotency_conflict")
            return _public_attempt(dict(old))
        if doc["status"] not in {"ISSUED", "PARTIALLY_PAID", "OVERDUE"}:
            raise HTTPException(409, "invoice_not_payable")
        amount = Decimal(str(doc["balance_due"]))
        if not amount.is_finite() or amount <= 0:
            raise HTTPException(409, "invoice_not_payable")
        if not doc["client_email"] or not doc["client_name"]:
            raise HTTPException(422, "saspay_customer_contact_required")
        active = conn.execute(text("""select id from finance_saspay_attempts
            where org_id=:org and document_id=:document
              and status in ('CREATING','PENDING','AMBIGUOUS') for update"""),
            {"org": org_id, "document": document_id}).first()
        if active:
            raise HTTPException(409, "saspay_attempt_already_open")
        description = f"SLAIVIO-FINANCE-{attempt_id}"
        row = conn.execute(text("""insert into finance_saspay_attempts(
              id,org_id,document_id,idempotency_key,status,requested_amount,currency,description)
            values(cast(:id as uuid),:org,:document,:key,'CREATING',:amount,:currency,:description)
            returning *"""), {
                "id": attempt_id, "org": org_id, "document": document_id,
                "key": idempotency_key, "amount": amount, "currency": doc["currency"],
                "description": description,
            }).mappings().one()
        finance.event(conn, org_id, document_id, "SASPAY_CHECKOUT_RESERVED", actor_id, "Finance", {
            "attempt_id": attempt_id, "amount": str(amount), "currency": doc["currency"],
        })
        request_payload = {
            "amount": f"{amount:.2f}",
            "currency": doc["currency"],
            "customer_email": doc["client_email"],
            "customer_name": doc["client_name"],
            "customer_phone": doc.get("client_phone") or "",
            "description": description,
            "metadata": {
                "slaivio_finance_attempt_id": attempt_id,
                "finance_document_id": str(doc["id"]),
            },
        }

    owns_client = client is None
    provider = client or SasPayClient(connection_data["api_key"])
    try:
        response = provider.create_checkout(request_payload)
        try:
            checkout = validate_checkout(
                response,
                merchant_id=connection_data["merchant_id"],
                amount=amount,
                currency=doc["currency"],
            )
        except HTTPException as exc:
            with engine.begin() as conn:
                conn.execute(text("""update finance_saspay_attempts
                    set status='AMBIGUOUS',failure_code=:code,updated_at=now()
                    where org_id=:org and id=cast(:id as uuid)"""),
                    {"org": org_id, "id": attempt_id, "code": exc.detail})
                finance.event(conn, org_id, document_id, "SASPAY_CHECKOUT_AMBIGUOUS", actor_id, "Finance", {
                    "attempt_id": attempt_id, "reason": "invalid_provider_response",
                })
            raise HTTPException(502, "saspay_checkout_ambiguous")
    except SasPayError as exc:
        with engine.begin() as conn:
            conn.execute(text("""update finance_saspay_attempts
                set status=:status,failure_code=:code,updated_at=now()
                where org_id=:org and id=cast(:id as uuid)"""), {
                    "status": "AMBIGUOUS" if exc.ambiguous else "FAILED",
                    "code": exc.code, "org": org_id, "id": attempt_id,
                })
            finance.event(
                conn, org_id, document_id,
                "SASPAY_CHECKOUT_AMBIGUOUS" if exc.ambiguous else "SASPAY_CHECKOUT_REJECTED",
                actor_id, "Finance", {"attempt_id": attempt_id, "reason": exc.code},
            )
        raise HTTPException(503 if exc.ambiguous else 502,
                            "saspay_checkout_ambiguous" if exc.ambiguous else "saspay_checkout_rejected")
    finally:
        if owns_client:
            provider.close()

    with engine.begin() as conn:
        row = conn.execute(text("""update finance_saspay_attempts
            set status='PENDING',checkout_session_id=:session,checkout_url=:url,updated_at=now()
            where org_id=:org and id=cast(:id as uuid) and status='CREATING'
            returning *"""), {
                "session": str(checkout["id"]), "url": checkout["checkout_url"],
                "org": org_id, "id": attempt_id,
            }).mappings().first()
    if not row:
        with engine.connect() as conn:
            current = conn.execute(text("""select * from finance_saspay_attempts
                where org_id=:org and id=cast(:id as uuid)"""),
                {"org": org_id, "id": attempt_id}).mappings().first()
        if current and current["status"] == "SUCCEEDED":
            return _public_attempt(dict(current))
        raise HTTPException(503, "saspay_checkout_ambiguous")
    with engine.begin() as conn:
        finance.event(conn, org_id, document_id, "SASPAY_CHECKOUT_CREATED", actor_id, "Finance", {
            "attempt_id": attempt_id, "checkout_session_id": str(checkout["id"]),
        })
    return _public_attempt(dict(row))


def _apply_verified_payment(org_id: str, attempt: dict, transaction: dict,
                            merchant_id: str, actor_id: str = "saspay",
                            actor_name: str = "SasPay") -> dict:
    validated = validate_verified_transaction(
        transaction,
        merchant_id=merchant_id,
        attempt_id=str(attempt["id"]),
        amount=Decimal(str(attempt["requested_amount"])),
        currency=attempt["currency"],
    )
    payment = finance.pay(org_id, str(attempt["document_id"]), actor_id, actor_name, {
        "amount": validated["provider_amount"],
        "currency": attempt["currency"],
        "method": "SASPAY",
        "reference": validated["provider_reference"],
        "paid_at": datetime.now(timezone.utc),
        "idempotency_key": f"saspay:{attempt['id']}",
        "provider": "SASPAY",
        "provider_transaction_id": validated["provider_transaction_id"],
        "provider_amount": validated["provider_amount"],
        "provider_fee": validated["provider_fee"],
        "provider_charged": validated["provider_charged"],
        "provider_net_amount": validated["provider_net_amount"],
        "fee_charge_mode": validated["fee_charge_mode"],
    })
    with engine.begin() as conn:
        updated = conn.execute(text("""update finance_saspay_attempts set
              status='SUCCEEDED',provider_payment_id=:payment,provider_reference=:reference,
              provider_fee=:fee,provider_charged=:charged,provider_net_amount=:net,
              fee_charge_mode=:mode,provider_details=cast(:details as jsonb),
              confirmed_at=coalesce(confirmed_at,now()),updated_at=now()
            where org_id=:org and id=cast(:id as uuid)
              and status in ('CREATING','PENDING','AMBIGUOUS','SUCCEEDED','FAILED','CANCELLED')
            returning id"""), {
                "payment": validated["provider_transaction_id"],
                "reference": validated["provider_reference"],
                "fee": validated["provider_fee"], "charged": validated["provider_charged"],
                "net": validated["provider_net_amount"], "mode": validated["fee_charge_mode"],
                "details": json.dumps(validated["provider_details"]),
                "org": org_id, "id": str(attempt["id"]),
            }).first()
        if not updated:
            raise HTTPException(409, "saspay_attempt_state_conflict")
    return {"status": "SUCCEEDED", "payment_id": str(payment["id"])}


def reconcile_checkout(org_id: str, document_id: str, attempt_id: str,
                       client: SasPayClient | None = None) -> dict:
    with engine.connect() as conn:
        attempt_row = conn.execute(text("""select * from finance_saspay_attempts
            where org_id=:org and document_id=:document and id=cast(:id as uuid)"""),
            {"org": org_id, "document": document_id, "id": attempt_id}).mappings().first()
    if not attempt_row:
        raise HTTPException(404, "saspay_attempt_not_found")
    attempt = dict(attempt_row)
    if attempt["status"] == "SUCCEEDED":
        return _public_attempt(attempt)
    if not attempt.get("checkout_session_id"):
        raise HTTPException(409, "saspay_attempt_requires_manual_reconciliation")
    connection_data = _load_connection(org_id)
    owns_client = client is None
    provider = client or SasPayClient(connection_data["api_key"])
    try:
        status = provider.checkout_status(attempt["checkout_session_id"])
        transaction_id = status.get("transaction_id")
        transaction_status = str(status.get("transaction_status") or "").upper()
        if transaction_status in {"FAILED", "CANCELLED"}:
            with engine.begin() as conn:
                changed = conn.execute(text("""update finance_saspay_attempts set status=:status,
                    updated_at=now() where org_id=:org and id=cast(:id as uuid)
                    and status in ('PENDING','AMBIGUOUS') returning document_id"""), {
                        "status": transaction_status, "org": org_id, "id": attempt_id,
                    }).mappings().first()
                if changed:
                    finance.event(conn, org_id, document_id, f"SASPAY_CHECKOUT_{transaction_status}",
                                  "saspay", "SasPay", {"attempt_id": attempt_id})
            return {"id": attempt_id, "status": transaction_status}
        if transaction_status != "SUCCESS" or not transaction_id:
            return {"id": attempt_id, "status": "PENDING"}
        transaction = provider.verify_payment(str(transaction_id))
        if str(transaction.get("id") or "") != str(transaction_id):
            raise HTTPException(409, "saspay_transaction_mismatch")
        return _apply_verified_payment(org_id, attempt, transaction, connection_data["merchant_id"])
    except SasPayError as exc:
        raise HTTPException(503, exc.code)
    finally:
        if owns_client:
            provider.close()


def handle_webhook(org_id: str, raw_body: bytes, signature: str,
                   timestamp: str, event_header: str,
                   client: SasPayClient | None = None) -> dict:
    connection_data = _load_connection(org_id)
    if not verify_webhook_signature(
        raw_body, signature, timestamp, connection_data["signing_secret"]
    ):
        raise HTTPException(401, "saspay_webhook_signature_invalid")
    try:
        envelope = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(400, "saspay_webhook_payload_invalid")
    if not isinstance(envelope, dict) or envelope.get("event") != event_header:
        raise HTTPException(400, "saspay_webhook_event_mismatch")
    if event_header != "transaction.success":
        return {"accepted": True, "processed": False}
    data = envelope.get("data")
    payment_id = data.get("id") if isinstance(data, dict) else None
    if not payment_id:
        raise HTTPException(400, "saspay_webhook_payment_id_missing")

    owns_client = client is None
    provider = client or SasPayClient(connection_data["api_key"])
    try:
        transaction = provider.verify_payment(str(payment_id))
        if str(transaction.get("id") or "") != str(payment_id):
            raise HTTPException(409, "saspay_transaction_mismatch")
        description = str(transaction.get("description") or "")
        prefix = "SLAIVIO-FINANCE-"
        if not description.startswith(prefix):
            raise HTTPException(409, "saspay_attempt_unmatched")
        try:
            attempt_id = str(UUID(description[len(prefix):]))
        except ValueError:
            raise HTTPException(409, "saspay_attempt_unmatched")
        with engine.connect() as conn:
            row = conn.execute(text("""select * from finance_saspay_attempts
                where org_id=:org and id=cast(:id as uuid)"""),
                {"org": org_id, "id": attempt_id}).mappings().first()
        if not row:
            raise HTTPException(409, "saspay_attempt_unmatched")
        attempt = dict(row)
        result = _apply_verified_payment(
            org_id, attempt, transaction, connection_data["merchant_id"]
        )
        event_key = hashlib.sha256(
            f"{event_header}:{payment_id}".encode("utf-8")
        ).hexdigest()
        with engine.begin() as conn:
            conn.execute(text("""insert into finance_saspay_webhook_events(
                  org_id,event_key,event_type,provider_payment_id,attempt_id,outcome)
                values(:org,:key,:event,:payment,cast(:attempt as uuid),'PROCESSED')
                on conflict(org_id,event_key) do nothing"""), {
                    "org": org_id, "key": event_key, "event": event_header,
                    "payment": str(payment_id), "attempt": attempt_id,
                })
        return {"accepted": True, "processed": True, **result}
    except SasPayError as exc:
        raise HTTPException(503, exc.code)
    finally:
        if owns_client:
            provider.close()
