"""Validate and normalize public agency images before storing them."""

from io import BytesIO
from urllib.parse import quote
from uuid import uuid4
import warnings

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.services.dossier_document_storage import upload_private_document

MAX_BYTES = 5 * 1024 * 1024
MAX_DIMENSION = 4096
BUCKET = "agency-brand-images"
FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}


def normalize_brand_image(content: bytes, content_type: str) -> bytes:
    if content_type not in FORMATS:
        raise HTTPException(415, "brand_image_type_unsupported")
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(413, "brand_image_too_large")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.format != FORMATS[content_type]:
                    raise HTTPException(415, "brand_image_content_invalid")
                if not (0 < source.width <= MAX_DIMENSION and 0 < source.height <= MAX_DIMENSION):
                    raise HTTPException(422, "brand_image_dimensions_invalid")
                source.verify()
            with Image.open(BytesIO(content)) as source:
                # Re-encoding strips metadata and discards animation/embedded payloads.
                normalized = ImageOps.exif_transpose(source).convert("RGBA")
                normalized.thumbnail((2048, 2048))
                output = BytesIO()
                normalized.save(output, format="WEBP", lossless=True)
                result = output.getvalue()
                if len(result) > MAX_BYTES:
                    raise HTTPException(413, "brand_image_too_large")
                return result
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(415, "brand_image_content_invalid") from exc


def store_brand_image(org_id: str, kind: str, content: bytes, content_type: str) -> str:
    normalized = normalize_brand_image(content, content_type)
    # Every asset is intentionally public: logos are used on tracking and invoices.
    # Only the permission-checked backend can write to this dedicated bucket.
    base = (settings.supabase_url or "").rstrip("/")
    if not base.startswith("https://"):
        raise HTTPException(503, "brand_image_storage_unavailable")
    path = f"{quote(org_id, safe='')}/{kind}/{uuid4().hex}.webp"
    try:
        upload_private_document(path, normalized, "image/webp", BUCKET)
    except RuntimeError as exc:
        raise HTTPException(503, "brand_image_storage_unavailable") from exc
    return f"{base}/storage/v1/object/public/{BUCKET}/{quote(path, safe='/')}"
