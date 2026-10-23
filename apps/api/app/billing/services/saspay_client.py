"""Server-only SasPay hosted checkout adapter. Never trust a browser payment status."""
import hashlib
import hmac
import time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException
from app.core.config import settings

BASE_URL = "https://api.saspay.me/api/v1"


def allowed_currencies():
    return {value.strip().upper() for value in settings.saspay_billing_currencies.split(',') if len(value.strip())==3 and value.strip().isalpha()}


def configured():
    key=settings.saspay_api_key or ''
    valid_key=key.startswith('sk_live_') if settings.app_env=='production' else key.startswith(('sk_test_','sk_live_'))
    return bool(valid_key and settings.saspay_merchant_id and settings.saspay_webhook_secret and allowed_currencies())


def request(method, path, payload=None):
    if not configured():
        raise HTTPException(503, "saspay_not_configured")
    try:
        response = httpx.request(method, BASE_URL + path, headers={
            "Authorization": f"Bearer {settings.saspay_api_key}", "Accept": "application/json",
        }, json=payload, timeout=5, follow_redirects=False)
        response.raise_for_status()
        envelope = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "saspay_unavailable") from exc
    if not isinstance(envelope, dict) or envelope.get("success") is not True or not isinstance(envelope.get("data"), dict):
        raise HTTPException(502, "saspay_invalid_response")
    return envelope["data"]


def safe_checkout_url(url):
    try:
        parsed = urlsplit(str(url or ""))
        valid = parsed.scheme == "https" and parsed.hostname == "pay.saspay.me" and parsed.port in (None,443) and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid:
        raise HTTPException(502, "saspay_invalid_response")
    return str(url)


def checkout_id(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(502, "saspay_invalid_response") from exc


def minor_amount(value):
    try:
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or amount != amount.to_integral_value() or amount <= 0:
            raise ValueError("invalid amount")
        return int(amount)
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise HTTPException(502, "saspay_payment_mismatch") from exc


def verify_signature(body: bytes, signature: str, timestamp: str, now=None):
    if not settings.saspay_webhook_secret:
        raise HTTPException(503, "saspay_not_configured")
    if not isinstance(signature,str) or len(signature)!=64 or any(char not in '0123456789abcdef' for char in signature):
        raise HTTPException(401,"saspay_signature_invalid")
    try:
        age = abs((time.time() if now is None else now) - int(timestamp))
    except (ValueError, TypeError) as exc:
        raise HTTPException(401, "saspay_signature_invalid") from exc
    expected = hmac.new(settings.saspay_webhook_secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    if age > 300 or not hmac.compare_digest(expected, signature or ""):
        raise HTTPException(401, "saspay_signature_invalid")
