from fastapi import FastAPI, Request
from app.api.webhook import router as webhook_router
from app.db.database import test_db_connection
from app.db.message_repository import insert_raw_message
from app.api.notifications import router as notifications_router
from app.api.dossiers import router as dossiers_router
from app.api.followups import router as followups_router
from app.api.offices import router as offices_router
from app.api.pricing import router as pricing_router
from app.api.manager import router as manager_router


app = FastAPI(title="SLAIVO CARGO OS API")

app.include_router(webhook_router)
app.include_router(notifications_router)
app.include_router(dossiers_router)
app.include_router(followups_router)
app.include_router(offices_router)
app.include_router(pricing_router)
app.include_router(manager_router)

@app.get("/")
def root():
    return {"status": "SLAIVO API running"}


@app.get("/health/db")
def db_health():
    test_db_connection()
    return {"status": "database connected"}

@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    payload = await request.json()

    # extraction simple (on fera mieux après)
    phone = payload.get("from", "unknown")
    text_msg = payload.get("text", "")

    insert_raw_message(
        org_id="demo_agency",
        phone=phone,
        text_msg=text_msg,
        payload=payload
    )
    print("RAW MESSAGE STORED")

    return {
    "status": "stored",
    "normalized_message": normalized_message.model_dump(mode="json")
}