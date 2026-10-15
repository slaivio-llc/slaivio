from __future__ import annotations

import hashlib
import hmac
import time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse
from uuid import UUID

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.core.config import settings


BASE_URL = "https://api.saspay.me/api/v1"
CHECKOUT_HOST = "pay.saspay.me"
WEBHOOK_TOLERANCE_SECONDS = 300


class SasPayError(Exception):
    def __init__(self, code: str, *, ambiguous: bool = False):
        super().__init__(code)
        self.code = code
        self.ambiguous = ambiguous


def _fernet() -> Fernet:
    key = settings.finance_provider_encryption_key
    if not key:
        raise HTTPException(503, "finance_provider_encryption_unavailable")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        raise HTTPException(503, "finance_provider_encryption_unavailable")


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError, ValueError):
        raise HTTPException(503, "finance_provider_credentials_unavailable")


def verify_webhook_signature(
    raw_body: bytes,
    signature: str,
    timestamp: str,
    secret: str,
    *,
    now: int | None = None,
) -> bool:
    try:
        timestamp_value = int(timestamp)
        signature_bytes = bytes.fromhex(signature)
    except (TypeError, ValueError):
        return False
    if not timestamp.isascii() or not timestamp.isdecimal():
        return False
    if abs((int(time.time()) if now is None else now) - timestamp_value) > WEBHOOK_TOLERANCE_SECONDS:
        return False
    signed = timestamp.encode("ascii") + b"." + raw_body
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest()
    return hmac.compare_digest(expected, signature_bytes)


def provider_amount(value, *, allow_zero: bool = True) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(409, "saspay_invalid_amount")
    if not amount.is_finite() or amount < 0 or (not allow_zero and amount == 0):
        raise HTTPException(409, "saspay_invalid_amount")
    return amount


def _unwrap(data: dict) -> dict:
    if data.get("success") is False:
        error = data.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        raise SasPayError(str(code or "saspay_request_rejected"))
    value = data.get("data", data)
    if not isinstance(value, dict):
        raise SasPayError("saspay_invalid_response", ambiguous=True)
    return value


class SasPayClient:
    """Strict, no-retry client for the hosted pay-in API."""

    def __init__(self, api_key: str, *, transport: httpx.BaseTransport | None = None):
        self._client = httpx.Client(
            base_url=BASE_URL,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=httpx.Timeout(15.0, connect=5.0),
            follow_redirects=False,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, **kwargs) -> dict:
        try:
            response = self._client.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise SasPayError("saspay_request_timeout", ambiguous=True)
        except httpx.RequestError:
            raise SasPayError("saspay_network_error", ambiguous=True)
        if response.status_code >= 500:
            raise SasPayError("saspay_provider_unavailable", ambiguous=True)
        if response.status_code >= 400:
            raise SasPayError("saspay_request_rejected")
        try:
            payload = response.json()
        except ValueError:
            raise SasPayError("saspay_invalid_response", ambiguous=True)
        if not isinstance(payload, dict):
            raise SasPayError("saspay_invalid_response", ambiguous=True)
        return _unwrap(payload)

    def create_checkout(self, payload: dict) -> dict:
        return self._request("POST", "/checkout-sessions/", json=payload)

    def checkout_status(self, session_id: str) -> dict:
        try:
            session_id = str(UUID(session_id))
        except ValueError:
            raise HTTPException(422, "saspay_checkout_id_invalid")
        return self._request("GET", f"/checkout-sessions/{session_id}/status/")

    def verify_payment(self, payment_id: str) -> dict:
        try:
            payment_id = str(UUID(payment_id))
        except ValueError:
            raise HTTPException(422, "saspay_payment_id_invalid")
        return self._request("GET", f"/payments/{payment_id}/verify/")


def validate_checkout(
    payload: dict,
    *,
    merchant_id: str,
    amount: Decimal,
    currency: str,
) -> dict:
    if (str(payload.get("merchant") or "") != merchant_id
            or str(payload.get("status") or "").upper() != "PENDING"
            or provider_amount(payload.get("amount"), allow_zero=False) != amount
            or str(payload.get("currency") or "").upper() != currency):
        raise HTTPException(502, "saspay_checkout_mismatch")
    try:
        UUID(str(payload.get("id") or ""))
    except ValueError:
        raise HTTPException(502, "saspay_checkout_id_invalid")
    url = urlparse(str(payload.get("checkout_url") or ""))
    if url.scheme != "https" or url.netloc != CHECKOUT_HOST or not url.path.startswith("/checkout/"):
        raise HTTPException(502, "saspay_checkout_url_invalid")
    return payload


def validate_verified_transaction(
    transaction: dict,
    *,
    merchant_id: str,
    attempt_id: str,
    amount: Decimal,
    currency: str,
) -> dict:
    expected_description = f"SLAIVIO-FINANCE-{attempt_id}"
    requested = transaction.get("requested_amount", transaction.get("amount"))
    if (
        str(transaction.get("merchant") or "") != merchant_id
        or str(transaction.get("flow_direction") or "").upper() != "INBOUND"
        or str(transaction.get("transaction_type") or "").upper() != "PAIEMENT"
        or str(transaction.get("status") or "").upper() != "SUCCESS"
        or str(transaction.get("description") or "") != expected_description
        or str(transaction.get("currency") or "").upper() != currency
        or provider_amount(requested, allow_zero=False) != amount
    ):
        raise HTTPException(409, "saspay_transaction_mismatch")

    fee = transaction.get("client_fee", transaction.get("fee"))
    charged = transaction.get("debited_amount", transaction.get("charged"))
    net = transaction.get("net_amount")
    fee_mode = str(transaction.get("fee_charge_mode") or "").upper()
    try:
        payment_id = str(UUID(str(transaction.get("id") or "")))
    except ValueError:
        raise HTTPException(409, "saspay_payment_id_invalid")
    if fee is None or charged is None or net is None or fee_mode not in {"ADD_ON", "DEDUCTED"}:
        raise HTTPException(409, "saspay_transaction_amounts_incomplete")
    fee_amount = provider_amount(fee)
    charged_amount = provider_amount(charged, allow_zero=False)
    net_amount = provider_amount(net)
    if fee_mode == "ADD_ON":
        amounts_match = charged_amount == amount + fee_amount and net_amount == amount
    else:
        amounts_match = charged_amount == amount and net_amount == amount - fee_amount
    if not amounts_match:
        raise HTTPException(409, "saspay_transaction_amounts_inconsistent")
    return {
        "provider_amount": amount,
        "provider_fee": fee_amount,
        "provider_charged": charged_amount,
        "provider_net_amount": net_amount,
        "fee_charge_mode": fee_mode,
        "provider_transaction_id": payment_id,
        "provider_reference": str(transaction.get("reference") or payment_id),
        "provider_details": {
            "client_fee": str(transaction.get("client_fee") or fee),
            "gateway_fee": str(transaction.get("gateway_fee") or "0"),
            "platform_fee": str(transaction.get("platform_fee") or "0"),
            "country": transaction.get("country"),
            "network": transaction.get("network"),
        },
    }
