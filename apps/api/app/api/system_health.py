from fastapi import APIRouter

from sqlalchemy import text

from app.db.database import engine


router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
    }


@router.get("/health/db")
def health_db():
    try:
        with engine.connect() as conn:
            conn.execute(
                text("select 1")
            )

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        return {
            "status": "error",
            "database": str(exc),
        }


@router.get("/ready")
def ready():
    return {
        "status": "ready",
    }
