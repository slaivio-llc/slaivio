from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.whatsapp_template_repository import (
    create_whatsapp_template,
    list_whatsapp_templates,
    get_template_by_key,
)

from app.services.whatsapp_template_service import send_whatsapp_template


router = APIRouter()

ORG_ID = "demo_agency"


class CreateTemplateRequest(BaseModel):
    template_key: str
    template_name: str
    content_sid: str
    language: str = "fr"
    category: str | None = None
    description: str | None = None
    variables: dict | None = None
    provider: str = "twilio"
    status: str = "APPROVED"


class SendTemplateRequest(BaseModel):
    recipient_phone: str
    variables: dict | None = None


@router.post("/whatsapp/templates")
def create_template(body: CreateTemplateRequest):
    template = create_whatsapp_template(
        org_id=ORG_ID,
        template_key=body.template_key,
        template_name=body.template_name,
        content_sid=body.content_sid,
        language=body.language,
        category=body.category,
        description=body.description,
        variables=body.variables,
        provider=body.provider,
        status=body.status,
    )

    return {
        "status": "ok",
        "template": template,
    }


@router.get("/whatsapp/templates")
def list_templates(limit: int = 100):
    templates = list_whatsapp_templates(
        org_id=ORG_ID,
        limit=limit,
    )

    return {
        "status": "ok",
        "count": len(templates),
        "templates": templates,
    }


@router.get("/whatsapp/templates/{template_key}")
def get_template(template_key: str):
    template = get_template_by_key(
        org_id=ORG_ID,
        template_key=template_key,
    )

    if not template:
        raise HTTPException(
            status_code=404,
            detail="Template not found",
        )

    return {
        "status": "ok",
        "template": template,
    }


@router.post("/whatsapp/templates/{template_key}/send")
def send_template(
    template_key: str,
    body: SendTemplateRequest,
):
    result = send_whatsapp_template(
        org_id=ORG_ID,
        template_key=template_key,
        recipient_phone=body.recipient_phone,
        variables=body.variables,
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=404,
            detail=result.get("message"),
        )

    return result
