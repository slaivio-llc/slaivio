import asyncio
import base64
import json
from io import BytesIO
from unittest.mock import MagicMock, AsyncMock

from fastapi import BackgroundTasks
from PIL import Image
import pytest
from starlette.requests import Request

from app.core.config import settings
from app.services import inbox_media_understanding as media, inbox_media_jobs as jobs
from app.services import dossier_document_storage as storage
from app.ai.services import pilot_inbox_ai_service as ai
from app.api import whatsapp_qr as qr


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(settings, "mistral_api_key", "test-only")
    monkeypatch.setattr(media, "scan_bytes", lambda content: {"status": "CLEAN"})
    post = MagicMock()
    monkeypatch.setattr(media.requests, "post", post)
    return post


def png():
    content = BytesIO()
    Image.new("RGB", (8, 8), "green").save(content, format="PNG")
    return content.getvalue()


def test_audio_transcription_uses_bounded_file_not_public_url(provider):
    provider.return_value.json.return_value = {"text": "Bonjour, quels sont vos horaires ?"}
    content = b"OggS" + b"test" * 20
    assert media.understand_media(content, "audio/ogg; codecs=opus").startswith("Bonjour")
    args, kwargs = provider.call_args
    assert args == ("https://api.mistral.ai/v1/audio/transcriptions",)
    assert kwargs["files"]["file"] == ("voice.ogg", content, "audio/ogg")
    assert kwargs["timeout"] == (10, 90)


def test_image_understanding_receives_only_image_and_safe_prompt(provider):
    provider.return_value.json.return_value = {"choices": [{"message": {"content": "Carton fermé."}}]}
    content = png()
    assert media.understand_media(content, "image/png") == "Carton fermé."
    payload = provider.call_args.kwargs["json"]
    assert "paiement" in payload["messages"][0]["content"]
    url = payload["messages"][1]["content"][0]["image_url"]
    assert base64.b64decode(url.split(",")[1]) == content
    assert "tools" not in payload


@pytest.mark.parametrize("content,mime,reason", [
    (b"", "audio/ogg", "too_large"),
    (b"MZexecutable", "audio/ogg", "unreadable"),
    (b"hello", "application/pdf", "unsupported"),
])
def test_invalid_media_never_reaches_provider(provider, content, mime, reason):
    with pytest.raises(ValueError, match=reason):
        media.understand_media(content, mime)
    provider.assert_not_called()


def test_image_declared_type_must_match_real_type(provider):
    with pytest.raises(ValueError, match="unreadable"):
        media.understand_media(png(), "image/jpeg")
    provider.assert_not_called()


def test_unsafe_file_and_empty_transcript_never_produce_an_answer(provider, monkeypatch):
    monkeypatch.setattr(media, "scan_bytes", lambda content: {"status": "REJECTED"})
    with pytest.raises(ValueError, match="unsafe"):
        media.understand_media(b"OggStest", "audio/ogg")
    provider.assert_not_called()
    monkeypatch.setattr(media, "scan_bytes", lambda content: {"status": "CLEAN"})
    provider.return_value.json.return_value = {"text": " "}
    with pytest.raises(ValueError, match="unreadable"):
        media.understand_media(b"OggStest", "audio/ogg")


@pytest.mark.parametrize("path", ["https://evil.test/file", "whatsapp/other/c/file.ogg",
                                      "whatsapp/agency/../secret", "whatsapp/agency/c\\file"])
def test_private_download_rejects_external_and_cross_tenant_paths(monkeypatch, path):
    request = MagicMock()
    monkeypatch.setattr(storage.httpx, "stream", request)
    with pytest.raises(ValueError):
        storage.read_private_whatsapp_media("agency", path, 100)
    request.assert_not_called()


def job(monkeypatch, *, latest="message-id", attempts=1, cached=None):
    engine = MagicMock()
    monkeypatch.setattr(jobs, "engine", engine)
    row = {"id": "message-id", "org_id": "agency", "from_phone": "+243123456789",
           "media_object_path": "whatsapp/agency/connection/file.ogg", "media_mime_type": "audio/ogg",
           "media_analysis_attempts": attempts, "media_analysis_text": cached, "dedupe_key": "provider-id"}
    engine.begin.return_value.__enter__.return_value.execute.return_value.mappings.return_value.first.return_value = row
    engine.connect.return_value.__enter__.return_value.execute.return_value.scalar.return_value = latest
    saves, replies = MagicMock(), MagicMock()
    monkeypatch.setattr(jobs, "_save", saves)
    monkeypatch.setattr(jobs, "effective_ai_mode", lambda *args: "CONTROLLED_AUTO")
    monkeypatch.setattr(jobs, "read_private_whatsapp_media", lambda *args: b"OggStest")
    monkeypatch.setattr(jobs, "understand_media", lambda *args: "Quels sont vos horaires ?")
    monkeypatch.setattr(jobs, "maybe_auto_reply_to_inbound_message", replies)
    monkeypatch.setattr(jobs, "update_state", MagicMock())
    return engine, saves, replies


def test_media_worker_persists_extraction_before_using_existing_ai_policy(monkeypatch):
    engine, saves, replies = job(monkeypatch)
    assert jobs.process_media("agency", "message-id") == {"status": "completed"}
    assert saves.call_args_list[0].kwargs["content"] == "Quels sont vos horaires ?"
    assert saves.call_args.kwargs["dispatched"] is True
    replies.assert_called_once_with("agency", "+243123456789", "Quels sont vos horaires ?", "SUPPORT", "whatsapp:provider-id")
    sql, params = engine.begin.return_value.__enter__.return_value.execute.call_args.args
    assert params == {"org_id": "agency", "message_id": "message-id"}
    assert "not coalesce(m.is_group,false)" in str(sql)
    assert "media_analysis_attempts<3" in str(sql)


def test_delayed_media_keeps_extraction_but_does_not_reply_to_old_message(monkeypatch):
    _, _, replies = job(monkeypatch, latest="newer-message")
    jobs.process_media("agency", "message-id")
    replies.assert_not_called()


def test_claimed_or_disabled_job_never_downloads_or_calls_ai(monkeypatch):
    engine, saves, replies = job(monkeypatch)
    engine.begin.return_value.__enter__.return_value.execute.return_value.mappings.return_value.first.return_value = None
    assert jobs.process_media("agency", "message-id") == {"status": "skipped"}
    saves.assert_not_called()
    replies.assert_not_called()


def test_paused_conversation_never_sends_media_to_provider(monkeypatch):
    _, saves, replies = job(monkeypatch)
    monkeypatch.setattr(jobs, "effective_ai_mode", lambda *args: "PAUSED")
    download = MagicMock()
    monkeypatch.setattr(jobs, "read_private_whatsapp_media", download)
    jobs.process_media("agency", "message-id")
    download.assert_not_called()
    replies.assert_not_called()
    assert saves.call_args.kwargs["error"] == "paused"


@pytest.mark.parametrize("attempts,expected", [(1, "PENDING"), (3, "FAILED")])
def test_provider_failure_is_bounded_and_keeps_secrets_out_of_status(monkeypatch, attempts, expected, caplog):
    _, saves, replies = job(monkeypatch, attempts=attempts)
    def fail(*args):
        raise RuntimeError("PRIVATE_KEY provider response contents")
    monkeypatch.setattr(jobs, "understand_media", fail)
    assert jobs.process_media("agency", "message-id") == {"status": "failed", "reason": "unavailable"}
    assert saves.call_args.kwargs["status"] == expected
    assert saves.call_args.kwargs["error"] == "unavailable"
    assert "PRIVATE_KEY" not in caplog.text
    replies.assert_not_called()


def test_crash_recovery_reuses_existing_transcription(monkeypatch):
    _, _, replies = job(monkeypatch, cached="Transcription déjà disponible")
    download = MagicMock()
    monkeypatch.setattr(jobs, "read_private_whatsapp_media", download)
    jobs.process_media("agency", "message-id")
    download.assert_not_called()
    assert replies.call_args.args[2] == "Transcription déjà disponible"


@pytest.mark.parametrize("message_type,body", [("image", "Photo d'un reçu de paiement"), ("audio", "Bonjour")])
def test_completed_media_cannot_automatically_create_a_customer(monkeypatch, message_type, body):
    monkeypatch.setattr(ai, "get_pilot_ai_settings", lambda *args: {"enabled": True})
    monkeypatch.setattr(ai, "effective_ai_mode", lambda *args: "CONTROLLED_AUTO")
    monkeypatch.setattr(ai, "conversation_ai_context", lambda *args: {
        "org_id": "agency", "organization_name": "Agence", "source_message_id": "message-id",
        "source_provider": "QR_LINKED_DEVICE", "source_message_type": message_type,
        "source_media_analysis_status": "COMPLETED", "source_message": body,
    })
    monkeypatch.setattr(ai, "_route_customer_message", lambda *args, **kwargs: {"kind": "SOCIAL", "response": "Bonjour !"})
    monkeypatch.setattr(ai, "log_ai_run", MagicMock())
    monkeypatch.setattr(ai, "create_ai_draft", lambda **kwargs: {"id": "draft"})
    qualification = MagicMock()
    monkeypatch.setattr(ai, "_parcel_qualification", qualification)
    result = ai.prepare_pilot_suggestion(org_id="agency", client_phone="+243123456789")
    qualification.assert_not_called()
    if message_type == "image":
        assert result["eligible_for_auto"] is False
        assert result["risk_level"] == "SENSITIVE"


def test_private_download_is_bounded_and_does_not_follow_redirects(monkeypatch):
    monkeypatch.setattr(storage, "_configuration", lambda: ("https://storage.example", "secret", "private"))
    stream = MagicMock()
    response = stream.return_value.__enter__.return_value
    response.status_code = 200
    response.iter_bytes.return_value = [b"123", b"456"]
    monkeypatch.setattr(storage.httpx, "stream", stream)
    with pytest.raises(ValueError, match="too_large"):
        storage.read_private_whatsapp_media("agency", "whatsapp/agency/c/file", 5)
    assert stream.call_args.kwargs["follow_redirects"] is False


@pytest.mark.parametrize("status", [None, "PENDING", "PROCESSING", "FAILED"])
def test_ai_does_not_guess_attachment_content_from_caption(monkeypatch, status):
    monkeypatch.setattr(ai, "get_pilot_ai_settings", lambda *args: {"enabled": True})
    monkeypatch.setattr(ai, "effective_ai_mode", lambda *args: "CONTROLLED_AUTO")
    monkeypatch.setattr(ai, "conversation_ai_context", lambda *args: {
        "source_provider": "QR_LINKED_DEVICE", "source_message_type": "image",
        "source_media_analysis_status": status, "source_message": "Voici mon paiement",
    })
    assert ai.prepare_pilot_suggestion(org_id="agency", client_phone="+243123456789")["reason"] == "media_not_understood"


@pytest.mark.parametrize("kind,is_group,duplicate", [
    ("audio", False, False), ("image", False, False),
    ("audio", True, False), ("image", False, True),
])
def test_qr_callback_schedules_analysis_only_for_new_direct_media(monkeypatch, kind, is_group, duplicate):
    monkeypatch.setattr(qr, "verify_gateway_signature", lambda *args: True)
    monkeypatch.setattr(qr, "get_connection", lambda *args: {"whatsapp_number_id": "number"})
    monkeypatch.setattr(qr, "store_event", lambda *args: True)
    monkeypatch.setattr(qr, "update_connection_from_gateway", lambda *args: {})
    monkeypatch.setattr(qr, "finish_event", MagicMock())
    monkeypatch.setattr(qr, "_store_inbound_media", lambda *args: {"media_object_path": "whatsapp/agency/c/file"})
    monkeypatch.setattr(qr, "process_normalized_whatsapp_message", AsyncMock(return_value={
        "status": "duplicate" if duplicate else "stored", "message_id": "message-id"}))
    monkeypatch.setattr(qr.manager, "broadcast_to_org", AsyncMock())
    ai_dispatch = AsyncMock()
    monkeypatch.setattr(qr, "run_pilot_inbox_ai", ai_dispatch)
    payload = {"org_id": "agency", "connection_id": "7bc3e0e9-c354-4ba7-84da-34a6625aa051",
               "event_type": "MESSAGE_RECEIVED", "event_key": "provider-id", "payload": {
                   "message_type": kind, "from_phone": "+243123456789",
                   "group_jid": "group@g.us" if is_group else None}}
    async def receive():
        return {"type": "http.request", "body": json.dumps(payload).encode()}
    request = Request({"type": "http", "method": "POST", "path": "/internal/whatsapp-qr/events", "headers": []}, receive)
    background = BackgroundTasks()
    asyncio.run(qr.receive_qr_gateway_event(request, background))
    assert len(background.tasks) == (0 if is_group or duplicate else 1)
    ai_dispatch.assert_not_called()
