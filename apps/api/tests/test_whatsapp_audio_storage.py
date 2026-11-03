import base64
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from app.api import whatsapp_qr
from app.services.inbox_media_understanding import AUDIO_TYPES

ROOT = Path(__file__).resolve().parents[3]


def test_audio_migration_preserves_private_bucket_and_custom_limits():
    sql = (ROOT / 'infra/sql/168_whatsapp_audio_storage.sql').read_text(encoding='utf-8')
    assert "'dossier-documents','dossier-documents',false,12582912" in sql
    assert 'public=false' in sql
    assert 'existing.file_size_limit is null then null' in sql
    assert 'greatest(existing.file_size_limit,excluded.file_size_limit)' in sql
    assert 'existing.allowed_mime_types || excluded.allowed_mime_types' in sql
    assert 'existing.allowed_mime_types is null then null' in sql
    for mime in AUDIO_TYPES:
        assert f"'{mime}'" in sql
    assert 'delete from' not in sql.lower()
    assert 'drop ' not in sql.lower()
    assert "'audio/*'" not in sql


@pytest.mark.parametrize('mime,extension', AUDIO_TYPES.items())
def test_audio_mime_is_sent_to_storage_unchanged_with_correct_extension(monkeypatch, mime, extension):
    upload = MagicMock()
    monkeypatch.setattr(whatsapp_qr, 'upload_private_document', upload)
    content = b'audio-bytes'
    result = whatsapp_qr._store_inbound_media('agency', 'connection', {
        'provider_message_id': 'voice-id', 'media_mime_type': mime + '; codecs=opus',
        'media_base64': base64.b64encode(content).decode(),
    })
    assert result['media_object_path'] == f'whatsapp/agency/connection/voice-id.{extension}'
    upload.assert_called_once_with(result['media_object_path'], content, mime, upsert=True)
