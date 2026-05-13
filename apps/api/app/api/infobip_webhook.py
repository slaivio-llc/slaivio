from fastapi import APIRouter
from fastapi import Request

from app.services.infobip_payload import (
    normalize_infobip_payload,
)

from app.api.webhook import (
    process_normalized_whatsapp_message,
)

from app.db.organization_whatsapp_repository import (
    find_org_by_twilio_to_number,
)


router = APIRouter()


@router.post("/webhook/infobip/whatsapp")
async def infobip_whatsapp_webhook(
    request: Request,
):
    payload = await request.json()

    normalized_message = normalize_infobip_payload(
        payload,
    )

    org_settings = find_org_by_twilio_to_number(
        normalized_message.to_phone,
    )

    org_id = (
        org_settings["org_id"]
        if org_settings
        else "demo_agency"
    )

    return await process_normalized_whatsapp_message(
        normalized_message=normalized_message,
        payload=payload,
        org_id=org_id,
    )
