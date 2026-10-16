import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import MagicMock

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.core.config import settings
from app.finance import saspay, saspay_repository


MERCHANT = "6f1e2b3a-8c4d-4a2f-9e1b-2d3c4f5a6b7c"
ATTEMPT = "b5fdab11-a21c-4ed1-88c3-70f4bd79cbb8"


@pytest.fixture(autouse=True)
def allow_external_provider_flows_for_saspay_tests(monkeypatch):
    monkeypatch.setattr(settings, "finance_manual_payments_only", False)


def signature(body: bytes, timestamp: str, secret: str = "webhook-secret") -> str:
    signed = timestamp.encode() + b"." + body
    return hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()


def test_webhook_signature_uses_raw_body_constant_time_and_age_limit():
    raw = b'{"event":"transaction.success","data":{"id":"payment"}}'
    digest = signature(raw, "1000")
    assert saspay.verify_webhook_signature(raw, digest, "1000", "webhook-secret", now=1000)
    assert not saspay.verify_webhook_signature(raw + b" ", digest, "1000", "webhook-secret", now=1000)
    assert not saspay.verify_webhook_signature(raw, digest, "699", "webhook-secret", now=1000)
    assert not saspay.verify_webhook_signature(raw, "not-hex", "1000", "webhook-secret", now=1000)


def test_saspay_client_uses_documented_checkout_endpoint_and_does_not_retry():
    seen = {}

    def respond(request):
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers["Authorization"]
        seen["idempotency"] = request.headers.get("Idempotency-Key")
        seen["payload"] = json.loads(request.content)
        return httpx.Response(201, json={"id": "session-1", "status": "PENDING"})

    client = saspay.SasPayClient("sk_test_secret", transport=httpx.MockTransport(respond))
    try:
        result = client.create_checkout({"amount": "10.00", "currency": "USD"})
    finally:
        client.close()
    assert result["id"] == "session-1"
    assert seen == {
        "url": "https://api.saspay.me/api/v1/checkout-sessions/",
        "authorization": "Bearer sk_test_secret",
        "idempotency": None,
        "payload": {"amount": "10.00", "currency": "USD"},
    }


def test_checkout_response_must_match_merchant_amount_currency_and_hosted_url():
    response = {
        "id": "c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e6f",
        "merchant": MERCHANT,
        "status": "PENDING",
        "amount": "50.00",
        "currency": "USD",
        "checkout_url": "https://pay.saspay.me/checkout/kZ2v9rT4bQxL8mNpYw==",
    }
    assert saspay.validate_checkout(
        response, merchant_id=MERCHANT, amount=Decimal("50.00"), currency="USD"
    ) == response
    for field, value in [
        ("merchant", "another-merchant"),
        ("amount", "49.99"),
        ("currency", "CDF"),
        ("checkout_url", "https://attacker.example/checkout/slug"),
    ]:
        mismatch = {**response, field: value}
        with pytest.raises(HTTPException):
            saspay.validate_checkout(
                mismatch, merchant_id=MERCHANT, amount=Decimal("50.00"), currency="USD"
            )


def test_verified_success_preserves_requested_fee_charged_net_and_mode():
    result = saspay.validate_verified_transaction({
        "id": "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
        "merchant": MERCHANT,
        "flow_direction": "INBOUND",
        "transaction_type": "PAIEMENT",
        "status": "SUCCESS",
        "description": f"SLAIVIO-FINANCE-{ATTEMPT}",
        "requested_amount": "50.00",
        "client_fee": "1.25",
        "gateway_fee": "0.40",
        "platform_fee": "0.10",
        "debited_amount": "51.25",
        "net_amount": "50.00",
        "fee_charge_mode": "ADD_ON",
        "currency": "USD",
    }, merchant_id=MERCHANT, attempt_id=ATTEMPT, amount=Decimal("50.00"), currency="USD")
    assert result["provider_amount"] == Decimal("50.00")
    assert result["provider_fee"] == Decimal("1.25")
    assert result["provider_charged"] == Decimal("51.25")
    assert result["provider_net_amount"] == Decimal("50.00")
    assert result["fee_charge_mode"] == "ADD_ON"
    assert result["provider_details"]["gateway_fee"] == "0.40"


@pytest.mark.parametrize("field,value", [
    ("debited_amount", "50.00"),
    ("net_amount", "49.99"),
])
def test_verified_transaction_rejects_inconsistent_provider_amounts(field, value):
    transaction = {
        "id": "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
        "merchant": MERCHANT,
        "flow_direction": "INBOUND",
        "transaction_type": "PAIEMENT",
        "status": "SUCCESS",
        "description": f"SLAIVIO-FINANCE-{ATTEMPT}",
        "requested_amount": "50.00",
        "client_fee": "1.25",
        "debited_amount": "51.25",
        "net_amount": "50.00",
        "fee_charge_mode": "ADD_ON",
        "currency": "USD",
    }
    transaction[field] = value
    with pytest.raises(HTTPException) as exc:
        saspay.validate_verified_transaction(
            transaction, merchant_id=MERCHANT, attempt_id=ATTEMPT,
            amount=Decimal("50.00"), currency="USD",
        )
    assert exc.value.detail == "saspay_transaction_amounts_inconsistent"


@pytest.mark.parametrize("change", [
    {"merchant": "foreign-merchant"},
    {"flow_direction": "OUTBOUND"},
    {"transaction_type": "PAYOUT"},
    {"status": "PENDING"},
    {"description": "unrelated transaction"},
    {"currency": "CDF"},
    {"requested_amount": "49.99"},
])
def test_unverified_or_mismatched_transaction_is_never_payable(change):
    transaction = {
        "id": "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02",
        "merchant": MERCHANT,
        "flow_direction": "INBOUND",
        "transaction_type": "PAIEMENT",
        "status": "SUCCESS",
        "description": f"SLAIVIO-FINANCE-{ATTEMPT}",
        "requested_amount": "50.00",
        "client_fee": "1.25",
        "debited_amount": "51.25",
        "net_amount": "50.00",
        "fee_charge_mode": "ADD_ON",
        "currency": "USD",
    }
    transaction.update(change)
    with pytest.raises(HTTPException):
        saspay.validate_verified_transaction(
            transaction, merchant_id=MERCHANT, attempt_id=ATTEMPT,
            amount=Decimal("50.00"), currency="USD",
        )


def test_connection_secrets_are_encrypted_and_never_returned(monkeypatch):
    monkeypatch.setattr(settings, "finance_provider_encryption_key", Fernet.generate_key().decode())
    engine = MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.one.return_value = {
        "org_id": "agency", "merchant_id": MERCHANT, "environment": "TEST",
        "is_active": True, "updated_at": "now",
    }
    monkeypatch.setattr(saspay_repository, "engine", engine)
    result = saspay_repository.configure_connection(
        "agency", MERCHANT, "TEST", "sk_test_supersecret", "signing-secret-value", "admin"
    )
    params = conn.execute.call_args.args[1]
    assert params["key"] != "sk_test_supersecret"
    assert params["secret"] != "signing-secret-value"
    assert saspay.decrypt_secret(params["key"]) == "sk_test_supersecret"
    assert saspay.decrypt_secret(params["secret"]) == "signing-secret-value"
    assert "api_key" not in result and "signing_secret" not in result


def test_manual_payments_only_blocks_external_provider_flows(monkeypatch):
    monkeypatch.setattr(settings, "finance_manual_payments_only", True)
    with pytest.raises(HTTPException) as exc:
        saspay_repository.configure_connection(
            "agency", MERCHANT, "TEST", "sk_test_supersecret", "signing-secret-value", "admin"
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == "manual_payments_only"


def test_live_merchant_connection_is_refused_outside_production(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "finance_manual_payments_only", False)
    with pytest.raises(HTTPException) as exc:
        saspay_repository.configure_connection(
            "agency", MERCHANT, "LIVE", "sk_live_secret", "signing-secret-value", "admin"
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == "saspay_live_disabled_in_this_environment"


def test_webhook_invalid_signature_does_not_contact_provider(monkeypatch):
    monkeypatch.setattr(saspay_repository, "_load_connection", lambda _: {
        "merchant_id": MERCHANT, "api_key": "sk_test_key", "signing_secret": "signing-secret",
    })
    provider = MagicMock()
    body = b'{"event":"transaction.success","data":{"id":"9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02"}}'
    with pytest.raises(HTTPException) as exc:
        saspay_repository.handle_webhook("agency", body, "00" * 32, "1000", "transaction.success", provider)
    assert exc.value.status_code == 401
    provider.verify_payment.assert_not_called()


def test_existing_checkout_retry_reuses_same_attempt_without_provider_call(monkeypatch):
    document = {
        "id": "document-1", "document_number": "FAC-1", "status": "ISSUED",
        "currency": "USD", "balance_due": Decimal("30.00"), "office_id": "office-1",
        "client_name": "Client", "client_email": "client@example.com", "client_phone": "",
    }
    existing = {
        "id": ATTEMPT, "document_id": "document-1", "status": "PENDING",
        "requested_amount": Decimal("30.00"), "currency": "USD",
        "checkout_url": "https://pay.saspay.me/checkout/slug", "created_at": "now",
    }
    doc_result = MagicMock(); doc_result.mappings.return_value.first.return_value = document
    old_result = MagicMock(); old_result.mappings.return_value.first.return_value = existing
    conn = MagicMock(); conn.execute.side_effect = [doc_result, old_result]
    engine = MagicMock(); engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(saspay_repository, "engine", engine)
    monkeypatch.setattr(saspay_repository, "_load_connection", lambda _: {"merchant_id": MERCHANT})
    provider = MagicMock()
    result = saspay_repository.start_checkout("agency", "document-1", "attempt-key", "actor", provider)
    assert result["id"] == ATTEMPT
    assert result["checkout_url"] == existing["checkout_url"]
    provider.create_checkout.assert_not_called()


def test_checkout_timeout_marks_attempt_ambiguous_without_retry(monkeypatch):
    document = {
        "id": "document-1", "document_number": "FAC-1", "status": "ISSUED",
        "currency": "USD", "balance_due": Decimal("30.00"), "office_id": "office-1",
        "client_name": "Client", "client_email": "client@example.com", "client_phone": "",
    }
    doc_result = MagicMock(); doc_result.mappings.return_value.first.return_value = document
    old_result = MagicMock(); old_result.mappings.return_value.first.return_value = None
    active_result = MagicMock(); active_result.first.return_value = None
    insert_result = MagicMock()
    insert_result.mappings.return_value.one.return_value = {
        "id": ATTEMPT, "status": "CREATING", "requested_amount": Decimal("30.00"),
        "currency": "USD", "checkout_url": None, "created_at": "now",
    }
    conn = MagicMock()
    conn.execute.side_effect = [doc_result, old_result, active_result, insert_result, MagicMock()]
    engine = MagicMock(); engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(saspay_repository, "engine", engine)
    monkeypatch.setattr(saspay_repository.finance, "event", MagicMock())
    monkeypatch.setattr(saspay_repository, "_load_connection", lambda _: {
        "merchant_id": MERCHANT, "api_key": "sk_test_key", "signing_secret": "signing",
    })
    provider = MagicMock()
    provider.create_checkout.side_effect = saspay.SasPayError("saspay_request_timeout", ambiguous=True)
    with pytest.raises(HTTPException) as exc:
        saspay_repository.start_checkout("agency", "document-1", "attempt-key", "actor", provider)
    assert exc.value.status_code == 503
    assert exc.value.detail == "saspay_checkout_ambiguous"
    provider.create_checkout.assert_called_once()
    assert "status=:status" in str(conn.execute.call_args_list[-1].args[0])
    assert conn.execute.call_args_list[-1].args[1]["status"] == "AMBIGUOUS"


def test_confirmed_payment_credits_requested_amount_not_net_proceeds(monkeypatch):
    attempt = {
        "id": ATTEMPT, "status": "PENDING", "document_id": "invoice-1",
        "requested_amount": Decimal("50.00"), "currency": "USD",
    }
    transaction = {
        "id": "9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02", "merchant": MERCHANT, "flow_direction": "INBOUND",
        "transaction_type": "PAIEMENT", "status": "SUCCESS",
        "description": f"SLAIVIO-FINANCE-{ATTEMPT}", "requested_amount": "50.00",
        "client_fee": "2.00", "debited_amount": "50.00", "net_amount": "48.00",
        "fee_charge_mode": "DEDUCTED", "currency": "USD",
    }
    pay = MagicMock(return_value={"id": "finance-payment"})
    monkeypatch.setattr(saspay_repository.finance, "pay", pay)
    engine = MagicMock(); conn = engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(saspay_repository, "engine", engine)
    result = saspay_repository._apply_verified_payment("agency", attempt, transaction, MERCHANT)
    payment = pay.call_args.args[4]
    assert payment["amount"] == Decimal("50.00")
    assert payment["provider_net_amount"] == Decimal("48.00")
    assert payment["provider_charged"] == Decimal("50.00")
    assert payment["fee_charge_mode"] == "DEDUCTED"
    assert payment["idempotency_key"] == f"saspay:{ATTEMPT}"
    assert result == {"status": "SUCCEEDED", "payment_id": "finance-payment"}


def test_duplicate_success_is_idempotent_without_recreating_payment(monkeypatch):
    attempt = {
        "id": ATTEMPT, "status": "SUCCEEDED", "provider_payment_id": "provider-1",
    }
    pay = MagicMock()
    monkeypatch.setattr(saspay_repository.finance, "pay", pay)
    result = saspay_repository._apply_verified_payment(
        "agency", attempt, {}, MERCHANT
    )
    assert result == {"status": "SUCCEEDED", "payment_id": "provider-1"}
    pay.assert_not_called()


@pytest.mark.parametrize("status", ["FAILED", "CANCELLED"])
def test_terminal_saspay_attempt_cannot_be_resurrected(status):
    with pytest.raises(HTTPException) as exc:
        saspay_repository._apply_verified_payment(
            "agency", {"id": ATTEMPT, "status": status}, {}, MERCHANT
        )
    assert exc.value.status_code == 409
    assert exc.value.detail == "saspay_attempt_terminal"
