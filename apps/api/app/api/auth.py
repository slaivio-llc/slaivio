from fastapi import APIRouter, Depends

from app.core.auth import get_current_manager

router = APIRouter()


@router.get("/auth/me")
def me(manager=Depends(get_current_manager)):
    return {
        "status": "ok",
        "manager": manager,
    }
