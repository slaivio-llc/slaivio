from fastapi import APIRouter

from app.core.config import settings
from app.db.database import test_db_connection


router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "org_id": settings.app_org_id,
    }


@router.get("/health/db")
def db_health():
    test_db_connection()

    return {
        "status": "database connected",
    }


@router.get("/health/ready")
def ready():
    test_db_connection()

    return {
        "status": "ready",
        "database": "ok",
    }
