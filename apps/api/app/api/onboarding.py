from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_manager
from app.onboarding.schemas.onboarding_schemas import AgencyProfileIn
from app.onboarding.services.onboarding_service import (
    get_onboarding_status,
    refresh_onboarding,
    save_agency_profile,
)


router = APIRouter(
    prefix="/api",
    tags=["onboarding"],
)


def _require_org(manager: dict):
    org_id = manager.get("org_id") or manager.get("tenant_org_id")

    if not org_id:
        raise HTTPException(
            status_code=403,
            detail="Missing organization context",
        )

    return org_id


@router.get("/onboarding/status")
def onboarding_status(manager=Depends(get_current_manager)):
    return {
        "status": "ok",
        "onboarding": get_onboarding_status(_require_org(manager)),
    }


@router.post("/onboarding/agency-profile")
def save_profile(
    body: AgencyProfileIn,
    manager=Depends(get_current_manager),
):
    result = save_agency_profile(
        org_id=_require_org(manager),
        user_id=manager["user_id"],
        payload=body.model_dump(),
    )

    return {
        "status": "ok",
        "data": result,
    }


@router.post("/onboarding/refresh")
def refresh(manager=Depends(get_current_manager)):
    return {
        "status": "ok",
        "onboarding": refresh_onboarding(
            org_id=_require_org(manager),
            user_id=manager["user_id"],
        ),
    }
