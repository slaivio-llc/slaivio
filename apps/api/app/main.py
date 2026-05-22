from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Response
from app.api.webhook import router as webhook_router
from app.api.notifications import router as notifications_router
from app.api.dossiers import router as dossiers_router
from app.api.followups import router as followups_router
from app.api.offices import router as offices_router
from app.api.pricing import router as pricing_router
from app.api.manager import router as manager_router
from app.api.shipments import router as shipments_router
from app.api.knowledge import router as knowledge_router
from app.db.database import test_db_connection
from app.api.batches import router as batches_router
from app.api.goods import router as goods_router
from app.api.media import router as media_router
from app.api.client_shipments import router as client_shipments_router
from app.api.broadcasts import router as broadcasts_router
from app.api.escalations import router as escalations_router
from app.api.health import router as health_router
from app.api.twilio_webhook import router as twilio_webhook_router
from app.api.twilio_status_webhook import router as twilio_status_webhook_router
from app.api.notification_retries import router as notification_retries_router
from app.api.voice_notes import router as voice_notes_router
from app.api.whatsapp_templates import router as whatsapp_templates_router
from app.api.manager_events import router as manager_events_router
from app.api.infobip_templates import router as infobip_templates_router
from app.api.infobip_webhook import router as infobip_webhook_router
from app.api.meta_webhook import router as meta_webhook_router
from app.api.organization_whatsapp import router as organization_whatsapp_router
from app.api.meta_templates import router as meta_templates_router
from app.api.auth import router as auth_router


app = FastAPI(title="SLAIVO CARGO OS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(webhook_router)
app.include_router(batches_router)
app.include_router(notifications_router)
app.include_router(knowledge_router)
app.include_router(dossiers_router)
app.include_router(followups_router)
app.include_router(offices_router)
app.include_router(goods_router)
app.include_router(pricing_router)
app.include_router(manager_router)
app.include_router(shipments_router)
app.include_router(media_router)
app.include_router(client_shipments_router)
app.include_router(broadcasts_router)
app.include_router(escalations_router)
app.include_router(health_router)
app.include_router(twilio_webhook_router)
app.include_router(twilio_status_webhook_router)
app.include_router(notification_retries_router)
app.include_router(voice_notes_router)
app.include_router(whatsapp_templates_router)
app.include_router(manager_events_router)
app.include_router(infobip_templates_router)
app.include_router(infobip_webhook_router)
app.include_router(meta_webhook_router)
app.include_router(organization_whatsapp_router)
app.include_router(meta_templates_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "SLAIVIO OS API",
    }

@app.options("/{full_path:path}")
def options_handler(full_path: str):
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )