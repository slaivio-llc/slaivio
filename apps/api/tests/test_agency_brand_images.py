from fastapi.routing import APIRoute
import asyncio
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from PIL import Image

from app.api import organization_admin
from app.services import agency_brand_images as images


def picture(format="PNG", size=(32, 24)):
    output = BytesIO()
    Image.new("RGB", size, "red").save(output, format=format)
    return output.getvalue()


@pytest.mark.parametrize("format,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_brand_image_is_normalized_to_webp(format, mime):
    result = images.normalize_brand_image(picture(format), mime)
    with Image.open(BytesIO(result)) as image:
        assert image.format == "WEBP"
        assert image.size == (32, 24)


@pytest.mark.parametrize("content,mime,status", [
    (b"<svg onload='alert(1)'/>", "image/svg+xml", 415),
    (b"not an image", "image/png", 415),
    (b"", "image/png", 413),
    (b"x" * (images.MAX_BYTES + 1), "image/png", 413),
    (picture(), "image/jpeg", 415),
    (picture(size=(4097, 1)), "image/png", 422),
], ids=["svg", "invalid-content", "empty", "too-large", "mime-mismatch", "dimensions"])
def test_invalid_images_are_rejected(content, mime, status):
    with pytest.raises(HTTPException) as error:
        images.normalize_brand_image(content, mime)
    assert error.value.status_code == status


def test_storage_paths_are_tenant_scoped_and_random(monkeypatch):
    storage = MagicMock()
    monkeypatch.setattr(images, "upload_private_document", storage)
    monkeypatch.setattr(images.settings, "supabase_url", "https://storage.example.com")
    first = images.store_brand_image("org-a", "logo", picture(), "image/png")
    second = images.store_brand_image("org-b", "logo", picture(), "image/png")
    assert "/agency-brand-images/org-a/logo/" in first
    assert "/agency-brand-images/org-b/logo/" in second
    assert first != second
    path, content, mime, bucket = storage.call_args_list[0].args
    assert path.startswith("org-a/logo/")
    assert mime == "image/webp" and bucket == "agency-brand-images"
    Image.open(BytesIO(content)).verify()


def test_storage_failure_does_not_return_a_broken_url(monkeypatch):
    monkeypatch.setattr(images.settings, "supabase_url", "https://storage.example.com")
    monkeypatch.setattr(images, "upload_private_document", MagicMock(side_effect=RuntimeError("offline")))
    with pytest.raises(HTTPException) as error:
        images.store_brand_image("org-a", "logo", picture(), "image/png")
    assert error.value.status_code == 503


def test_upload_reads_a_bounded_size_and_uses_the_authenticated_tenant(monkeypatch):
    store = MagicMock(return_value="https://storage.example.com/logo.webp")
    monkeypatch.setattr(organization_admin, "store_brand_image", store)
    file = MagicMock(content_type="image/png", filename="../../another-agency.png")
    file.read = AsyncMock(return_value=picture())
    result = asyncio.run(organization_admin.upload_brand_image(file=file, kind="logo", tenant={"org_id": "org-a"}))
    file.read.assert_awaited_once_with(images.MAX_BYTES + 1)
    assert store.call_args.args[0:2] == ("org-a", "logo")
    assert result["url"] == "https://storage.example.com/logo.webp"


def test_unsupported_upload_is_rejected_before_reading_or_storing(monkeypatch):
    store = MagicMock()
    monkeypatch.setattr(organization_admin, "store_brand_image", store)
    file = MagicMock(content_type="image/svg+xml")
    file.read = AsyncMock()
    with pytest.raises(HTTPException) as error:
        asyncio.run(organization_admin.upload_brand_image(file=file, kind="logo", tenant={"org_id": "org-a"}))
    assert error.value.status_code == 415
    file.read.assert_not_called()
    store.assert_not_called()


def test_upload_route_requires_organization_manage():
    route = next(route for route in organization_admin.router.routes if isinstance(route, APIRoute) and route.path.endswith("/brand/images"))
    assert any("organization.manage" in [cell.cell_contents for cell in (getattr(dependency.call, "__closure__", None) or ())]
               for dependency in route.dependant.dependencies)
