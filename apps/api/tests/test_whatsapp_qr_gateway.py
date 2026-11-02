import time
import base64
import pytest

from app.api import whatsapp_qr
from app.core.config import settings
from app.services.whatsapp_qr_gateway_client import sign_gateway_request, verify_gateway_signature
from app.services import whatsapp_qr_gateway_client
from app.services.qr_linked_device_whatsapp_provider import QRLinkedDeviceWhatsAppProvider
from fastapi import HTTPException


@pytest.mark.parametrize("gateway_status", [502, 503])
def test_disconnect_reports_remote_failure_but_revokes_local_access(monkeypatch, gateway_status):
    revoked = []
    monkeypatch.setattr(whatsapp_qr, "get_connection", lambda *args, **kwargs: {"id": "connection-id", "status": "CONNECTED"})
    monkeypatch.setattr(whatsapp_qr, "revoke_connection", lambda *args: revoked.append(args) or {"status": "REVOKED"})
    def fail(*args):
        raise whatsapp_qr.QRGatewayError("pilot_whatsapp_qr_gateway_start_failed", gateway_status)
    monkeypatch.setattr(whatsapp_qr, "qr_gateway_request", fail)
    with pytest.raises(HTTPException) as error:
        whatsapp_qr.disconnect_qr_connection("connection-id", tenant={"org_id": "org-id"}, manager={"user_id": "user-id"})
    assert error.value.status_code == gateway_status
    assert error.value.detail == "pilot_whatsapp_qr_gateway_start_failed"
    assert revoked == [("org-id", "connection-id", "user-id")]


def test_disconnect_can_retry_remote_logout_after_local_revocation(monkeypatch):
    calls = []
    connection = {"id": "connection-id", "status": "REVOKED"}
    def get_owned_connection(org_id, connection_id, *, include_revoked=False):
        assert (org_id, connection_id, include_revoked) == ("org-id", "connection-id", True)
        return connection
    monkeypatch.setattr(whatsapp_qr, "get_connection", get_owned_connection)
    monkeypatch.setattr(whatsapp_qr, "qr_gateway_request", lambda *args: calls.append(args) or {"status": "LOGGED_OUT"})
    def must_not_revoke(*args):
        raise AssertionError("Already revoked; do not repeat the database update")
    monkeypatch.setattr(whatsapp_qr, "revoke_connection", must_not_revoke)
    result = whatsapp_qr.disconnect_qr_connection("connection-id", tenant={"org_id": "org-id"}, manager={"user_id": "user-id"})
    assert result == {"status": "ok", "connection": connection}
    assert calls == [("POST", "/connections/connection-id/logout", {"org_id": "org-id"})]


def test_disconnect_does_not_contact_gateway_for_another_tenants_connection(monkeypatch):
    monkeypatch.setattr(whatsapp_qr, "get_connection", lambda *args, **kwargs: None)
    def must_not_call(*args):
        raise AssertionError("No gateway call without an owned connection")
    monkeypatch.setattr(whatsapp_qr, "qr_gateway_request", must_not_call)
    with pytest.raises(HTTPException) as error:
        whatsapp_qr.disconnect_qr_connection("connection-id", tenant={"org_id": "org-id"}, manager={"user_id": "user-id"})
    assert error.value.status_code == 404


def test_missing_gateway_configuration_uses_the_handled_error_type(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_url", "")
    with pytest.raises(whatsapp_qr.QRGatewayError) as error:
        whatsapp_qr_gateway_client.qr_gateway_request("POST", "/connections/test/logout", {})
    assert error.value.status_code == 503
    assert error.value.code == "pilot_whatsapp_qr_gateway_unavailable"


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


def test_gateway_rejects_non_json_success_response_with_safe_diagnostic(monkeypatch, caplog):
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_url", "https://gateway.example.test")
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", "s" * 32)

    class Response:
        ok = True
        status_code = 200
        headers = {"Content-Type": "text/html"}

        @staticmethod
        def json():
            raise ValueError("not JSON")

    monkeypatch.setattr(
        whatsapp_qr_gateway_client.requests,
        "request",
        lambda *args, **kwargs: Response(),
    )

    try:
        whatsapp_qr_gateway_client.qr_gateway_request("POST", "/connections/test/start", {})
    except whatsapp_qr_gateway_client.QRGatewayError as error:
        assert error.code == "pilot_whatsapp_qr_gateway_invalid_response"
    else:
        raise AssertionError("Expected invalid gateway response")

    assert "status=200, content_type=text/html" in caplog.text
    assert "not JSON" not in caplog.text


def test_gateway_classifies_non_json_http_error_by_status(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_url", "https://gateway.example.test")
    monkeypatch.setattr(settings, "whatsapp_qr_gateway_shared_secret", "s" * 32)

    class Response:
        ok = False
        status_code = 404
        headers = {"Content-Type": "text/html"}

        @staticmethod
        def json():
            raise ValueError("not JSON")

    monkeypatch.setattr(
        whatsapp_qr_gateway_client.requests,
        "request",
        lambda *args, **kwargs: Response(),
    )

    try:
        whatsapp_qr_gateway_client.qr_gateway_request("POST", "/connections/test/start", {})
    except whatsapp_qr_gateway_client.QRGatewayError as error:
        assert error.code == "pilot_whatsapp_qr_gateway_request_rejected"
    else:
        raise AssertionError("Expected rejected gateway request")


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
