import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api import packages
from app.packages import register
from app.organization_admin import settings_policy
from app.db import database


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
    # The settings policy is tested separately; this is an isolated upload test.
    monkeypatch.setattr(database, 'engine', MagicMock())
    monkeypatch.setattr(settings_policy, 'require_photos_allowed', MagicMock())
    monkeypatch.setattr(register, "parcel_overview", lambda *args: {"org_id": "office"})
    storage = MagicMock()
    monkeypatch.setattr(packages, "upload_private_document", storage)
    file = MagicMock(content_type=mime)
    file.read = AsyncMock(return_value=content)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(packages.packages_media_upload("parcel", file=file, tenant={"org_id": "office"}))
    assert exc.value.status_code == code
    storage.assert_not_called()


@pytest.mark.parametrize('shared',[False,True])
def test_reception_upload_requires_explicit_customer_sharing(monkeypatch,shared):
    monkeypatch.setattr(database,'engine',MagicMock())
    monkeypatch.setattr(settings_policy,'require_photos_allowed',MagicMock())
    monkeypatch.setattr(register,'parcel_overview',lambda *_:{'org_id':'office'})
    monkeypatch.setattr(packages,'upload_private_document',MagicMock())
    save=MagicMock(return_value={'id':'parcel'});monkeypatch.setattr(packages,'add_private_package_media',save)
    file=MagicMock(content_type='image/png',filename='colis.png')
    file.read=AsyncMock(return_value=b'\x89PNG\r\n\x1a\nimage')
    result=asyncio.run(packages.packages_media_upload('parcel',file=file,category='RECEPTION',caption=None,
                     customer_visible=shared,tenant={'org_id':'office','user_id':'operator'}))
    assert result['package']['id']=='parcel'
    assert save.call_args.args[-1]['customer_visible'] is shared


def test_photo_setting_blocks_upload_before_file_or_storage(monkeypatch):
    monkeypatch.setattr(database,'engine',MagicMock())
    monkeypatch.setattr(register,'parcel_overview',lambda *_:{'org_id':'office'})
    monkeypatch.setattr(settings_policy,'require_photos_allowed',MagicMock(side_effect=HTTPException(409,'package_photos_disabled')))
    storage=MagicMock();monkeypatch.setattr(packages,'upload_private_document',storage)
    file=MagicMock();file.read=AsyncMock()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(packages.packages_media_upload('parcel',file=file,tenant={'org_id':'office'}))
    assert exc.value.detail=='package_photos_disabled'
    file.read.assert_not_called();storage.assert_not_called()


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
    assert result["total_pages"] == 4
    for statement, params in [call.args for call in conn.execute.call_args_list]:
        sql = str(statement)
        assert "p.org_id=:org_id or p.destination_org_id=:org_id" in sql
        assert "m.org_id=p.org_id" in sql
        assert "deleted_at is null" in sql
        assert params["org_id"] == "office"
        assert params["offset"] == 6
    assert "limit 6 offset :offset" in str(conn.execute.call_args_list[-1].args[0]).lower()
    projection = str(conn.execute.call_args.args[0]).split("from package_media")[0]
    assert "object_path" not in projection
    assert "url" not in projection
