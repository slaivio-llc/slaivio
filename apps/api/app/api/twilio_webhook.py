from fastapi import APIRouter, Request, HTTPException, Response
from app.services.twilio_inbound_parser import (
    normalize_twilio_whatsapp_form,
    twilio_form_to_payload,
)
from app.services.twilio_webhook_security import validate_twilio_request
from app.api.webhook import process_normalized_whatsapp_message
from app.services.twilio_media_parser import extract_twilio_media_items
from app.services.inbound_media_service import store_inbound_twilio_media



router = APIRouter()


@router.post("/webhook/twilio/whatsapp")
async def receive_twilio_whatsapp(request: Request):
    form = await request.form()
    form_data = dict(form)

    is_valid = await validate_twilio_request(
        request=request,
        form_data=form_data,
    )

    if not is_valid:
        raise HTTPException(
            status_code=403,
            detail="Invalid Twilio signature",
        )

    normalized_message = normalize_twilio_whatsapp_form(form_data)
    payload = twilio_form_to_payload(form_data)

     result = await process_normalized_whatsapp_message(
        normalized_message=normalized_message,
        payload=payload,
    )

    media_items = extract_twilio_media_items(form_data)

    if media_items:
        store_inbound_twilio_media(
            org_id="demo_agency",
            client_id=result["client_id"],
            dossier_id=result["dossier_id"],
            shipment_id=result.get("shipment_id"),
            provider_message_id=normalized_message.provider_message_id,
            media_items=media_items,
            raw_payload=form_data,
        )


    return Response(
        content="<Response></Response>",
        media_type="application/xml",
    )
