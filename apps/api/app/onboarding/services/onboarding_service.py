from app.onboarding.checks.onboarding_checks import evaluate_onboarding
from app.onboarding.repositories.onboarding_repository import (
    get_or_create_onboarding,
    record_onboarding_event,
    update_onboarding_state,
    upsert_agency_profile,
)


def get_onboarding_status(org_id: str):
    get_or_create_onboarding(org_id)
    evaluation = evaluate_onboarding(org_id)

    return update_onboarding_state(
        org_id=org_id,
        status=evaluation["status"],
        current_step=evaluation["current_step"],
        completed_steps=evaluation["completed_steps"],
        missing_steps=evaluation["missing_steps"],
    )


def save_agency_profile(org_id: str, user_id: str, payload: dict):
    profile = upsert_agency_profile(
        org_id=org_id,
        data={
            **payload,
            "metadata": {
                "updated_from": "onboarding",
            },
        },
    )

    record_onboarding_event(
        org_id=org_id,
        user_id=user_id,
        event_name="agency_profile_saved",
        payload={"profile_id": profile["id"]},
    )

    status = get_onboarding_status(org_id)

    return {
        "profile": profile,
        "onboarding": status,
    }


def refresh_onboarding(org_id: str, user_id: str | None):
    status = get_onboarding_status(org_id)

    record_onboarding_event(
        org_id=org_id,
        user_id=user_id,
        event_name="onboarding_refreshed",
        payload={
            "status": status["status"],
            "missing_steps": status["missing_steps"],
        },
    )

    return status
