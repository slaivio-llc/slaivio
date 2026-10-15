import time
import base64

from app.api import whatsapp_qr
from app.core.config import settings
from app.services.whatsapp_qr_gateway_client import sign_gateway_request, verify_gateway_signature
from app.services import whatsapp_qr_gateway_client
from app.services.qr_linked_device_whatsapp_provider import QRLinkedDeviceWhatsAppProvider
from fastapi import HTTPException


def test_qr_gateway_signature_rejects_tampering(monkeypatch):
    secret = "s" * 32
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", secret)
    timestamp = str(int(time.time()))
    body = b'{"event_type":"CONNECTED"}'
    signature = sign_gateway_request("POST", "/internal/whatsapp-qr/events", body, timestamp, secret)
    assert verify_gateway_signature("POST", "/internal/whatsapp-qr/events", body, timestamp, signature)
    assert not verify_gateway_signature("POST", "/internal/whatsapp-qr/events", b"tampered", timestamp, signature)


def test_qr_gateway_signature_rejects_expired_request(monkeypatch):
    secret = "s" * 32
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", secret)
    timestamp = str(int(time.time()) - 301)
    signature = sign_gateway_request("GET", "/connections/test", b"", timestamp, secret)
    assert not verify_gateway_signature("GET", "/connections/test", b"", timestamp, signature)


def test_gateway_network_failure_is_reported_as_a_safe_actionable_error(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_url", "https://gateway.example.test")
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", "s" * 32)
    monkeypatch.setattr(
        whatsapp_qr_gateway_client.requests,
        "request",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            whatsapp_qr_gateway_client.requests.ConnectionError("private network detail")
        ),
    )

    try:
        whatsapp_qr_gateway_client.qr_gateway_request("POST", "/connections/test/start", {})
    except whatsapp_qr_gateway_client.QRGatewayError as error:
        assert error.code == "pilot_whatsapp_qr_gateway_unreachable"
        assert "private network detail" not in str(error)
    else:
        raise AssertionError("Expected QR gateway connectivity failure")


def test_gateway_auth_failure_is_normalized(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_url", "https://gateway.example.test")
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", "s" * 32)
    monkeypatch.setattr(
        whatsapp_qr_gateway_client.requests,
        "request",
        lambda *args, **kwargs: type("Response", (), {
            "ok": False, "status_code": 401, "json": lambda self: {"error": "invalid_signature"},
        })(),
    )

    try:
        whatsapp_qr_gateway_client.qr_gateway_request("POST", "/connections/test/start", {})
    except whatsapp_qr_gateway_client.QRGatewayError as error:
        assert error.code == "pilot_whatsapp_qr_gateway_auth_failed"
        assert error.status_code == 502
    else:
        raise AssertionError("Expected QR gateway authentication failure")


def test_start_route_returns_gateway_error_as_http_error(monkeypatch):
    monkeypatch.setattr(
        whatsapp_qr,
        "create_or_restart_connection",
        lambda *args: {"id": "connection-id"},
    )
    monkeypatch.setattr(
        whatsapp_qr,
        "qr_gateway_request",
        lambda *args: (_ for _ in ()).throw(
            whatsapp_qr.QRGatewayError("pilot_whatsapp_qr_gateway_unreachable")
        ),
    )

    try:
        whatsapp_qr.start_qr_connection(
            whatsapp_qr.QRStart(terms_accepted=True),
            tenant={"org_id": "org-id"},
            manager={"user_id": "user-id"},
        )
    except HTTPException as error:
        assert error.status_code == 503
        assert error.detail == "pilot_whatsapp_qr_gateway_unreachable"
    else:
        raise AssertionError("Expected QR gateway HTTP error")


def test_linked_device_provider_sends_through_the_isolated_connection(monkeypatch):
    calls = []

    def fake_request(method, path, payload=None):
        calls.append((method, path, payload))
        return {"success": True, "provider_message_id": "wamid-test"}

    monkeypatch.setattr(
        "app.services.qr_linked_device_whatsapp_provider.qr_gateway_request",
        fake_request,
    )
    provider = QRLinkedDeviceWhatsAppProvider(number={
        "provider": "QR_LINKED_DEVICE",
        "provider_metadata": {"connection_id": "connection-1"},
    })
    result = provider.send_message("+243 900 000 001", "Bonjour")
    assert result["success"] is True
    assert result["provider"] == "qr_linked_device"
    assert calls == [("POST", "/connections/connection-1/messages", {
        "to": "+243900000001", "message": "Bonjour",
    })]


def test_linked_device_provider_preserves_private_whatsapp_identity(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.services.qr_linked_device_whatsapp_provider.qr_gateway_request",
        lambda method, path, payload=None: calls.append((method, path, payload)) or {
            "success": True, "provider_message_id": "wamid-lid",
        },
    )
    provider = QRLinkedDeviceWhatsAppProvider(number={
        "provider": "QR_LINKED_DEVICE",
        "provider_metadata": {"connection_id": "connection-1"},
    })

    provider.send_message("123456789012345@lid", "Bonjour")

    assert calls[0][2]["to"] == "123456789012345@lid"


def test_inbound_qr_media_is_uploaded_privately_without_base64_persistence(monkeypatch):
    uploads = []
    monkeypatch.setattr(
        whatsapp_qr,
        "upload_private_document",
        lambda path, content, content_type, **options: uploads.append(
            (path, content, content_type, options)
        ),
    )
    payload = {
        "provider_message_id": "wamid/image-1",
        "media_base64": base64.b64encode(b"image-bytes").decode(),
        "media_mime_type": "image/jpeg",
        "media_file_name": "photo.jpg",
    }

    result = whatsapp_qr._store_inbound_media("org-1", "connection-1", payload)

    assert "media_base64" not in payload
    assert result["media_object_path"].endswith("wamid_image-1.jpg")
    assert result["media_size_bytes"] == len(b"image-bytes")
    assert uploads == [(
        result["media_object_path"], b"image-bytes", "image/jpeg", {"upsert": True},
    )]
