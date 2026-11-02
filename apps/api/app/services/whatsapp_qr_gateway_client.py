import hashlib
import hmac
import json
import logging
import time
from urllib.parse import urlsplit

import requests

from app.core.config import settings


logger = logging.getLogger(__name__)


class QRGatewayError(ValueError):
    def __init__(self, code: str, status_code: int = 503):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def _configuration() -> tuple[str, str]:
    url = (settings.whatsapp_qr_gateway_url or "").strip().rstrip("/")
    secret = settings.whatsapp_qr_gateway_shared_secret or ""
    if not url or len(secret) < 32:
        raise QRGatewayError("pilot_whatsapp_qr_gateway_unavailable")
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise QRGatewayError("pilot_whatsapp_qr_gateway_unavailable") from exc
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise QRGatewayError("pilot_whatsapp_qr_gateway_unavailable")
    return url, secret


def sign_gateway_request(method: str, path: str, body: bytes, timestamp: str, secret: str) -> str:
    digest = hashlib.sha256(body).hexdigest()
    canonical = f"{timestamp}\n{method.upper()}\n{path}\n{digest}".encode()
    return hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()


def verify_gateway_signature(method: str, path: str, body: bytes, timestamp: str | None, signature: str | None) -> bool:
    secret = settings.whatsapp_qr_gateway_shared_secret or ""
    if not timestamp or not signature or len(secret) < 32:
        return False
    try:
        if abs(int(time.time()) - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = sign_gateway_request(method, path, body, timestamp, secret)
    return hmac.compare_digest(expected, signature)


def qr_gateway_request(method: str, path: str, payload: dict | None = None) -> dict:
    base_url, secret = _configuration()
    body = b"" if method.upper() == "GET" else json.dumps(payload or {}, separators=(",", ":"), ensure_ascii=False).encode()
    timestamp = str(int(time.time()))
    signature = sign_gateway_request(method, path, body, timestamp, secret)
    try:
        response = requests.request(
            method,
            f"{base_url}{path}",
            data=body if method.upper() != "GET" else None,
            headers={
                "Content-Type": "application/json",
                "X-Slaivio-Timestamp": timestamp,
                "X-Slaivio-Signature": signature,
            },
            timeout=20,
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        raise QRGatewayError("pilot_whatsapp_qr_gateway_unreachable") from exc
    if not response.ok:
        # Log transport diagnostics only, never signatures, payloads or the
        # upstream response body (which may contain session credentials).
        action = path.rsplit("/", 1)[-1]
        response_headers = getattr(response, "headers", {})
        logger.warning("QR gateway request failed method=%s action=%s status=%s host=%s gateway_identified=%s",
                       method.upper(), action, response.status_code, urlsplit(base_url).hostname,
                       response_headers.get("X-Slaivio-QR-Gateway") == "1")
        if response.status_code == 401:
            code = "pilot_whatsapp_qr_gateway_auth_failed"
        elif response.status_code >= 500:
            code = "pilot_whatsapp_qr_gateway_start_failed"
            # Only accept the explicit known code; never expose raw gateway data.
            if path.endswith("/logout") and response_headers.get("X-Slaivio-QR-Gateway") == "1":
                try:
                    if response.json().get("error") == "whatsapp_qr_remote_logout_unconfirmed":
                        code = "pilot_whatsapp_qr_remote_logout_unconfirmed"
                except (ValueError, AttributeError):
                    pass
        else:
            code = "pilot_whatsapp_qr_gateway_request_rejected"
        raise QRGatewayError(code, 502 if response.status_code != 503 else 503)
    try:
        data = response.json()
    except ValueError:
        logger.warning(
            "QR gateway returned a non-JSON response (status=%s, content_type=%s)",
            response.status_code,
            response.headers.get("Content-Type", "unknown"),
        )
        raise QRGatewayError("pilot_whatsapp_qr_gateway_invalid_response", 502)
    if not isinstance(data, dict):
        logger.warning(
            "QR gateway returned a non-object JSON response (status=%s, content_type=%s)",
            response.status_code,
            response.headers.get("Content-Type", "unknown"),
        )
        raise QRGatewayError("pilot_whatsapp_qr_gateway_invalid_response", 502)
    return data
