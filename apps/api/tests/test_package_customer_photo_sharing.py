from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import packages
from app.packages import repository


def test_public_tracking_signs_only_explicitly_shared_photo_records(monkeypatch):
    monkeypatch.setattr(packages, "public_package_tracking", lambda reference: {"tracking_id": reference})
    monkeypatch.setattr(packages, "public_package_tracking_media", lambda reference: [
        {"id": "photo-1", "file_name": "carton.jpg", "object_path": "org/pkg/photo.jpg"},
    ])
    signer = MagicMock(return_value="https://storage.example/signed?token=short")
    monkeypatch.setattr(packages, "create_document_download_url", signer)

    result = packages.packages_public_tracking("COL-2026-001")

    assert result["tracking"]["customer_photos"] == [{
        "id": "photo-1", "file_name": "carton.jpg",
        "url": "https://storage.example/signed?token=short",
    }]
    assert "object_path" not in str(result)
    signer.assert_called_once_with("org/pkg/photo.jpg", 300, "package-media")


def test_public_tracking_does_not_fail_if_photo_storage_is_unavailable(monkeypatch):
    monkeypatch.setattr(packages, "public_package_tracking", lambda reference: {"tracking_id": reference})
    monkeypatch.setattr(packages, "public_package_tracking_media", lambda reference: [
        {"id": "photo-1", "file_name": "carton.jpg", "object_path": "org/pkg/photo.jpg"},
    ])
    monkeypatch.setattr(packages, "create_document_download_url", MagicMock(side_effect=RuntimeError("storage unavailable")))

    result = packages.packages_public_tracking("COL-2026-001")

    assert result["tracking"]["tracking_id"] == "COL-2026-001"
    assert result["tracking"]["customer_photos"] == []


def test_visibility_update_requires_an_existing_owned_image(monkeypatch):
    update = MagicMock(return_value=False)
    monkeypatch.setattr(packages, "set_package_media_customer_visibility", update)

    with pytest.raises(HTTPException) as error:
        packages.packages_media_customer_visibility(
            "parcel", "photo", packages.PackageMediaVisibilityPayload(customer_visible=True),
            tenant={"org_id": "office", "user_id": "agent"},
        )

    assert error.value.status_code == 404
    update.assert_called_once_with("office", "parcel", "photo", True, "agent")


def test_whatsapp_share_does_not_create_a_false_pending_message_without_phone(monkeypatch):
    monkeypatch.setattr(repository, "_ensure_schema", lambda: None)
    monkeypatch.setattr(repository, "get_package", lambda *args: {"id": "parcel", "client_id": "client"})
    conn = MagicMock()
    result = MagicMock()
    result.scalar.return_value = None
    conn.execute.return_value = result
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, "engine", engine)

    with pytest.raises(HTTPException) as error:
        repository.create_package_notification(
            "office", "parcel", "agent", {"channel": "whatsapp", "message": "Suivi"}
        )

    assert error.value.status_code == 422
    assert error.value.detail == "client_phone_unavailable"
    conn.execute.assert_called_once()
