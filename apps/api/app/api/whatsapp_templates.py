from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.whatsapp_template_repository import (
    create_whatsapp_template,
    list_whatsapp_templates,
    get_template_by_key,
)
from fastapi import APIRouter
from pydantic import BaseModel
from app.db.whatsapp_template_repository import (
    create_template,
    list_templates,
    update_template_sync,
)
from app.services.meta_template_service import (
    create_meta_template,
)
from app.services.whatsapp_template_service import send_whatsapp_template


router = APIRouter()

ORG_ID = "demo_agency"



class CreateTemplateRequest(BaseModel):
    waba_id: str

    access_token: str

    template_name: str

    template_category: str

    language_code: str = "fr"

    body_text: str


@router.post("/whatsapp/templates")
def create_whatsapp_template(
    body: CreateTemplateRequest,
):
    template = create_template(
        org_id=ORG_ID,
        template_name=body.template_name,
        template_category=body.template_category,
        language_code=body.language_code,
        body_text=body.body_text,
    )

    meta_result = create_meta_template(
        waba_id=body.waba_id,
        access_token=body.access_token,
        template_name=body.template_name,
        category=body.template_category,
        language_code=body.language_code,
        body_text=body.body_text,
    )

    if meta_result["ok"]:
        template = update_template_sync(
            template_id=template["id"],
            template_status="APPROVED",
            meta_template_id=meta_result["data"].get("id"),
            raw_payload=meta_result["data"],
        )

    else:
        template = update_template_sync(
            template_id=template["id"],
            template_status="REJECTED",
            rejection_reason=str(meta_result["data"]),
            raw_payload=meta_result["data"],
        )

    return {
        "status": "ok",
        "template": template,
        "meta_response": meta_result["data"],
    }


@router.get("/whatsapp/templates")
def get_templates():
    return {
        "status": "ok",
        "templates": list_templates(ORG_ID),
    }
