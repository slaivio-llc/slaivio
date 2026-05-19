from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_manager
from app.db.meta_template_repository import (
    upsert_meta_template_mapping,
    get_meta_template_mapping,
    list_meta_template_mappings,
)
from app.services.whatsapp_provider_factory import get_whatsapp_provider


router = APIRouter()


class UpsertMetaTemplateRequest(BaseModel):
    template_key: str
    meta_template_name: str
    language: str = "fr"
    category: str | None = None
    template_type: str = "TEXT"


class SendMetaTemplateRequest(BaseModel):
    recipient_phone: str
    variables: dict | None = None


class SendMetaMediaTemplateRequest(BaseModel):
    recipient_phone: str
    media_url: str
    media_type: str = "image"
    body_variables: list[str] | None = None


@router.post("/meta/templates")
def save_meta_template(
    body: UpsertMetaTemplateRequest,
    manager=Depends(get_current_manager),
):
    mapping = upsert_meta_template_mapping(
        org_id=manager["org_id"],
        template_key=body.template_key,
        meta_template_name=body.meta_template_name,
        language=body.language,
        category=body.category,
        template_type=body.template_type,
    )

    return {
        "status": "ok",
        "mapping": mapping,
    }


@router.get("/meta/templates")
def list_meta_templates(
    manager=Depends(get_current_manager),
):
    mappings = list_meta_template_mappings(
        org_id=manager["org_id"],
    )

    return {
        "status": "ok",
        "templates": mappings,
    }


@router.post("/meta/templates/{template_key}/send")
def send_meta_template(
    template_key: str,
    body: SendMetaTemplateRequest,
    manager=Depends(get_current_manager),
):
    mapping = get_meta_template_mapping(
        org_id=manager["org_id"],
        template_key=template_key,
    )

    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="Meta template mapping not found",
        )

    provider = get_whatsapp_provider(
        org_id=manager["org_id"],
    )

    variables = body.variables or {}
    variables["_language"] = mapping["language"]

    result = provider.send_template_message(
        to=body.recipient_phone,
        content_sid=mapping["meta_template_name"],
        content_variables=variables,
    )

    return {
        "status": "ok" if result.get("success") else "failed",
        "mapping": mapping,
        "provider_result": result,
    }


@router.post("/meta/templates/{template_key}/send-media")
def send_meta_media_template(
    template_key: str,
    body: SendMetaMediaTemplateRequest,
    manager=Depends(get_current_manager),
):
    mapping = get_meta_template_mapping(
        org_id=manager["org_id"],
        template_key=template_key,
    )

    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="Meta template mapping not found",
        )

    provider = get_whatsapp_provider(
        org_id=manager["org_id"],
    )

    result = provider.send_media_template_message(
        to=body.recipient_phone,
        template_name=mapping["meta_template_name"],
        language=mapping["language"],
        media_url=body.media_url,
        body_variables=body.body_variables,
        media_type=body.media_type,
    )

    return {
        "status": "ok" if result.get("success") else "failed",
        "mapping": mapping,
        "provider_result": result,
    }
