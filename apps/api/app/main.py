from fastapi import FastAPI
from app.api.webhook import router as webhook_router
from app.api.notifications import router as notifications_router
from app.api.dossiers import router as dossiers_router
from app.api.followups import router as followups_router
from app.api.offices import router as offices_router
from app.api.pricing import router as pricing_router
from app.api.manager import router as manager_router
from app.api.shipments import router as shipments_router

from app.db.database import test_db_connection


app = FastAPI(title="SLAIVO CARGO OS API")


app.include_router(webhook_router)
app.include_router(notifications_router)
app.include_router(dossiers_router)
app.include_router(followups_router)
app.include_router(offices_router)
app.include_router(pricing_router)
app.include_router(manager_router)
app.include_router(shipments_router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "SLAIVIO OS API",
    }


@app.get("/health/db")
def db_health():
    test_db_connection()
    return {
        "status": "database connected",
    }