import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api import packages
from app.packages import register


@pytest.mark.parametrize("parcel,code", [(None, 404), ({"org_id": "another-office"}, 403)])
def test_upload_authorizes_before_reading_file_or_storage(monkeypatch, parcel, code):
    monkeypatch.setattr(register, "parcel_overview", lambda *args: parcel)
    storage = MagicMock()
    monkeypatch.setattr(packages, "upload_private_document", storage)
    file = MagicMock()
    file.read = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(packages.packages_media_upload("parcel", file=file, tenant={"org_id": "office"}))
    assert exc.value.status_code == code
    file.read.assert_not_called()
    storage.assert_not_called()


@pytest.mark.parametrize("mime,content,code", [("image/png", b"not-a-png", 415), ("image/jpeg", b"", 413), ("application/pdf", b"pdf", 415)])
def test_upload_rejects_invalid_image_before_storage(monkeypatch, mime, content, code):
    monkeypatch.setattr(register, "parcel_overview", lambda *args: {"org_id": "office"})
    storage = MagicMock()
    monkeypatch.setattr(packages, "upload_private_document", storage)
    file = MagicMock(content_type=mime)
    file.read = AsyncMock(return_value=content)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(packages.packages_media_upload("parcel", file=file, tenant={"org_id": "office"}))
    assert exc.value.status_code == code
    storage.assert_not_called()


def test_private_url_not_created_for_missing_or_inaccessible_media(monkeypatch):
    monkeypatch.setattr(packages, "get_package_media", lambda *args: None)
    sign = MagicMock()
    monkeypatch.setattr(packages, "create_document_download_url", sign)
    with pytest.raises(HTTPException) as exc:
        packages.packages_media_view("parcel", "photo", tenant={"org_id": "office"})
    assert exc.value.status_code == 404
    sign.assert_not_called()


def test_photos_are_scoped_and_paginated_without_exposing_storage_paths(monkeypatch):
    conn, engine = MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    conn.execute.return_value.scalar_one.return_value = 21
    conn.execute.return_value.mappings.return_value.__iter__.return_value = iter([])
    monkeypatch.setattr(register, "engine", engine)
    result = register.parcel_photos("office", "parcel", page=2)
    assert result["total_pages"] == 2
    for statement, params in [call.args for call in conn.execute.call_args_list]:
        sql = str(statement)
        assert "p.org_id=:org_id or p.destination_org_id=:org_id" in sql
        assert "m.org_id=p.org_id" in sql
        assert "deleted_at is null" in sql
        assert params["org_id"] == "office"
        assert params["offset"] == 20
    projection = str(conn.execute.call_args.args[0]).split("from package_media")[0]
    assert "object_path" not in projection
    assert "url" not in projection
