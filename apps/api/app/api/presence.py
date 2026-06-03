from fastapi import APIRouter

from app.db.presence_repository import list_presence


router = APIRouter()

ORG_ID = "demo_agency"


@router.get("/presence")
def get_presence():
    return {
        "status": "ok",
        "agents": list_presence(ORG_ID),
    }
