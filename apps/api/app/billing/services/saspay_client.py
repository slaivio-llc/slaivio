"""Server-only SasPay hosted checkout adapter. Never trust a browser payment status."""
import hashlib
import hmac
import logging
import time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException
from app.core.config import settings

BASE_URL = "https://api.saspay.me/api/v1"
logger = logging.getLogger(__name__)


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
        }, json=payload, timeout=15, follow_redirects=False)
        response.raise_for_status()
        envelope = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Never log response bodies, Authorization headers or customer details.
        logger.warning("SasPay request failed: method=%s endpoint=%s error=%s status=%s",
                       method, path.split('?')[0], type(exc).__name__,
                       getattr(getattr(exc, 'response', None), 'status_code', None))
        raise HTTPException(502, "saspay_unavailable") from exc
    if isinstance(envelope, dict):
        if envelope.get("success") is True and isinstance(envelope.get("data"), dict):
            return envelope["data"]
        # SasPay's endpoint examples also document the resource without the
        # global response envelope. Accept only recognizable resources, never
        # an error object or a malformed explicit envelope.
        if 'success' not in envelope and 'data' not in envelope:
            if path.startswith('/checkout-sessions/'):
                if isinstance(envelope.get('results'), list) and method == 'GET':
                    return envelope
                if all(key in envelope for key in ('id', 'merchant', 'amount', 'currency', 'checkout_url')):
                    return envelope
            if path.startswith('/payments/') and all(key in envelope for key in ('id', 'merchant', 'requested_amount', 'currency', 'status')):
                return envelope
    logger.warning("SasPay invalid response: method=%s endpoint=%s shape=%s enveloped=%s",
                   method, path.split('?')[0], type(envelope).__name__,
                   isinstance(envelope, dict) and 'success' in envelope)
    raise HTTPException(502, "saspay_invalid_response")


def safe_checkout_url(url):
    try:
        parsed = urlsplit(str(url or ""))
        valid = parsed.scheme == "https" and parsed.hostname == "pay.saspay.me" and parsed.port in (None,443) and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid:
        logger.warning("SasPay checkout validation failed: invalid or untrusted checkout URL")
        raise HTTPException(502, "saspay_invalid_response")
    return str(url)


def checkout_id(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as exc:
        logger.warning("SasPay checkout validation failed: missing or invalid resource UUID")
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
