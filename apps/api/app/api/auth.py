from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class BootstrapManagerRequest(BaseModel):
    org_id: str = settings.app_org_id
    full_name: str = "Demo Manager"
    email: str
    password: str
    role: str = "OWNER"


@router.post("/auth/bootstrap-manager")
def bootstrap_manager(body: BootstrapManagerRequest):
    return {
        "status": "ok",
        "manager": {
            "id": "demo_manager",
            "org_id": body.org_id,
            "full_name": body.full_name,
            "email": body.email,
            "role": body.role,
        },
    }


@router.post("/auth/login")
def login(body: LoginRequest):
    if body.email != "admin@slaivo.com" or body.password != "ChangeMe123!":
        return {
            "status": "error",
            "message": "Invalid credentials",
        }

    return {
        "access_token": "demo_token",
        "token_type": "bearer",
        "manager": {
            "id": "demo_manager",
            "org_id": settings.app_org_id,
            "full_name": "Jeremy Akiemane",
            "email": body.email,
            "role": "OWNER",
        },
    }


@router.get("/auth/me")
def me():
    return {
        "status": "ok",
        "manager": {
            "id": "demo_manager",
            "org_id": settings.app_org_id,
            "full_name": "Jeremy Akiemane",
            "email": "admin@slaivo.com",
            "role": "OWNER",
        },
    }
