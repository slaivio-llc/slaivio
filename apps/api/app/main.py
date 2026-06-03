from fastapi import FastAPI, Request
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
from app.api.meta_embedded_signup import router as meta_embedded_signup_router
from app.api.organization_whatsapp import router as organization_whatsapp_router
from app.api.meta_templates import router as meta_templates_router
from app.api.auth import router as auth_router
from app.api.inbox import router as inbox_router
from app.api.knowledge_settings import router as knowledge_settings_router
from app.api.goods_settings import router as goods_settings_router
from app.api.pricing_settings import router as pricing_settings_router
from app.api.whatsapp_enterprise import router as whatsapp_enterprise_router
from app.api.whatsapp_health import router as whatsapp_health_router
from app.core.exceptions import global_exception_handler
from app.api.system_health import router as system_health_router
from app.core.logger import logger
from app.core.request_context import generate_request_id
from app.api.conversation_assignments import (
    router as conversation_assignments_router,
)
from app.api.conversation_timeline import (
    router as conversation_timeline_router,
)
from app.api.inbox_replies import router as inbox_replies_router
from app.api.queues import router as queues_router
from app.api.realtime import router as realtime_router
from app.api.presence import router as presence_router


app = FastAPI(title="SLAIVO CARGO OS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(
    Exception,
    global_exception_handler,
)


@app.middleware("http")
async def request_context_middleware(
    request: Request,
    call_next,
):
    request_id = request.headers.get("X-Request-ID") or generate_request_id()
    request.state.request_id = request_id
    logger.info(
        f"request_started:{request_id}:{request.method}:{request.url.path}"
    )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        f"request_completed:{request_id}:{response.status_code}"
    )
    return response


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
app.include_router(meta_embedded_signup_router)
app.include_router(organization_whatsapp_router)
app.include_router(meta_templates_router)
app.include_router(auth_router)
app.include_router(inbox_router)
app.include_router(knowledge_settings_router)
app.include_router(goods_settings_router)
app.include_router(pricing_settings_router)
app.include_router(whatsapp_enterprise_router)
app.include_router(whatsapp_health_router)
app.include_router(system_health_router)
app.include_router(conversation_assignments_router)
app.include_router(conversation_timeline_router)
app.include_router(inbox_replies_router)
app.include_router(queues_router)
app.include_router(realtime_router)
app.include_router(presence_router)


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
