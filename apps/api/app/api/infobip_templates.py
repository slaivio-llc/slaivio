from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.infobip_template_repository import (
    upsert_infobip_template_mapping,
    get_infobip_template_mapping,
    list_infobip_template_mappings,
)

from app.services.whatsapp_provider_factory import get_whatsapp_provider


router = APIRouter()

ORG_ID = "demo_agency"


class UpsertInfobipTemplateRequest(BaseModel):
    template_key: str
    infobip_template_name: str
    language: str = "fr"
    category: str | None = None
    template_type: str = "TEXT"


class SendInfobipTemplateRequest(BaseModel):
    recipient_phone: str
    variables: dict | None = None


@router.post("/infobip/templates")
def save_infobip_template(body: UpsertInfobipTemplateRequest):
    mapping = upsert_infobip_template_mapping(
        org_id=ORG_ID,
        template_key=body.template_key,
        infobip_template_name=body.infobip_template_name,
        language=body.language,
        category=body.category,
        template_type=body.template_type,
    )

    return {
        "status": "ok",
        "mapping": mapping,
    }


@router.get("/infobip/templates")
def list_infobip_templates():
    mappings = list_infobip_template_mappings(
        org_id=ORG_ID,
    )

    return {
        "status": "ok",
        "count": len(mappings),
        "templates": mappings,
    }


@router.post("/infobip/templates/{template_key}/send")
def send_infobip_template(
    template_key: str,
    body: SendInfobipTemplateRequest,
):
    mapping = get_infobip_template_mapping(
        org_id=ORG_ID,
        template_key=template_key,
    )

    if not mapping:
        raise HTTPException(
            status_code=404,
            detail="Infobip template mapping not found",
        )

    provider = get_whatsapp_provider(
        org_id=ORG_ID,
    )

    variables = body.variables or {}
    variables["_language"] = mapping.get("language") or "fr"

    result = provider.send_template_message(
        to=body.recipient_phone,
        content_sid=mapping["infobip_template_name"],
        content_variables=variables,
    )

    return {
        "status": "ok" if result.get("success") else "failed",
        "mapping": mapping,
        "provider_result": result,
    }
