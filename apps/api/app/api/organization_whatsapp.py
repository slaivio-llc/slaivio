from fastapi import APIRouter
from pydantic import BaseModel

from app.db.organization_whatsapp_repository import (
    upsert_whatsapp_settings,
    get_active_whatsapp_settings,
    list_whatsapp_settings,
)


router = APIRouter()

ORG_ID = "demo_agency"


class UpsertWhatsappSettingsRequest(BaseModel):
    provider: str = "twilio"
    environment: str = "sandbox"
    twilio_whatsapp_from: str | None = None
    twilio_account_sid: str | None = None
    twilio_subaccount_sid: str | None = None
    twilio_messaging_service_sid: str | None = None
    inbound_webhook_url: str | None = None
    status_callback_url: str | None = None
    sender_status: str = "PENDING"
    sender_country: str | None = None
    default_language: str = "fr"
    default_timezone: str = "Africa/Kinshasa"


@router.post("/organization/whatsapp-settings")
def save_whatsapp_settings(body: UpsertWhatsappSettingsRequest):
    settings = upsert_whatsapp_settings(
        org_id=ORG_ID,
        provider=body.provider,
        environment=body.environment,
        twilio_whatsapp_from=body.twilio_whatsapp_from,
        twilio_account_sid=body.twilio_account_sid,
        twilio_subaccount_sid=body.twilio_subaccount_sid,
        twilio_messaging_service_sid=body.twilio_messaging_service_sid,
        inbound_webhook_url=body.inbound_webhook_url,
        status_callback_url=body.status_callback_url,
        sender_status=body.sender_status,
        sender_country=body.sender_country,
        default_language=body.default_language,
        default_timezone=body.default_timezone,
    )

    return {
        "status": "ok",
        "settings": settings,
    }


@router.get("/organization/whatsapp-settings")
def get_whatsapp_settings():
    settings = list_whatsapp_settings(
        org_id=ORG_ID,
    )

    return {
        "status": "ok",
        "count": len(settings),
        "settings": settings,
    }


@router.get("/organization/whatsapp-settings/active")
def get_active_settings():
    settings = get_active_whatsapp_settings(
        org_id=ORG_ID,
    )

    return {
        "status": "ok",
        "settings": settings,
    }
