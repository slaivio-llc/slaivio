from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_manager
from app.onboarding_experience.schemas.onboarding_experience_schemas import (
    CompleteExperienceStepIn,
    TrackOnboardingEventIn,
)
from app.onboarding_experience.services.onboarding_experience_service import (
    complete_step,
    get_experience_state,
    track_event,
)


router = APIRouter(
    prefix="/api",
    tags=["onboarding-experience"],
)


def _require_org(manager: dict):
    org_id = manager.get("org_id") or manager.get("tenant_org_id")

    if not org_id:
        raise HTTPException(
            status_code=403,
            detail="Missing organization context",
        )

    return org_id


@router.get("/onboarding-experience/state")
def onboarding_experience_state(manager=Depends(get_current_manager)):
    return {
        "status": "ok",
        "data": get_experience_state(
            org_id=_require_org(manager),
            user_id=manager["user_id"],
        ),
    }


@router.post("/onboarding-experience/complete-step")
def complete_onboarding_step(
    body: CompleteExperienceStepIn,
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "data": complete_step(
            org_id=_require_org(manager),
            user_id=manager["user_id"],
            step_key=body.step_key,
        ),
    }


@router.post("/onboarding-experience/events")
def track_onboarding_event(
    body: TrackOnboardingEventIn,
    manager=Depends(get_current_manager),
):
    return {
        "status": "ok",
        "event": track_event(
            org_id=_require_org(manager),
            user_id=manager["user_id"],
            step_key=body.step_key,
            event_name=body.event_name,
            payload=body.payload,
        ),
    }
