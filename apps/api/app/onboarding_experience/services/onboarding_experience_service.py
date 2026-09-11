from fastapi import HTTPException

from app.onboarding_experience.repositories.onboarding_experience_repository import (
    complete_journey,
    get_business_type,
    get_or_create_journey,
    list_steps,
    record_step_event,
    update_step_status,
)


def get_experience_state(org_id: str, user_id: str | None):
    journey = get_or_create_journey(org_id)
    steps = list_steps(org_id, journey["id"])

    total = len(steps)
    terminal = [
        step for step in steps if step["status"] in ["COMPLETED", "SKIPPED"]
    ]
    required_steps = [step for step in steps if step["required"]]
    completed_required = [
        step for step in required_steps if step["status"] == "COMPLETED"
    ]

    progress = int((len(terminal) / total) * 100) if total else 0
    readiness = (
        int((len(completed_required) / len(required_steps)) * 100)
        if required_steps
        else 0
    )
    current = next(
        (
            step
            for step in steps
            if step["status"] in ["IN_PROGRESS", "PENDING"]
        ),
        None,
    )

    return {
        "journey": journey,
        "business_type": get_business_type(org_id),
        "steps": steps,
        "progress": progress,
        "readiness_score": readiness,
        "current_step": current,
        "warnings": build_smart_warnings(steps),
    }


def complete_step(
    org_id: str,
    user_id: str | None,
    step_key: str,
):
    journey = get_or_create_journey(org_id)
    step = update_step_status(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        status="COMPLETED",
    )
    if not step:
        raise HTTPException(status_code=404, detail="onboarding_step_not_found")

    record_step_event(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        user_id=user_id,
        event_name="onboarding_step_completed",
        payload={"step_key": step_key, "step_id": step["id"] if step else None},
    )

    _advance_journey(org_id, journey["id"])

    return get_experience_state(org_id, user_id)


def skip_step(org_id: str, user_id: str | None, step_key: str):
    journey = get_or_create_journey(org_id)
    steps = list_steps(org_id, journey["id"])
    current = next((item for item in steps if item["step_key"] == step_key), None)

    if not current:
        raise HTTPException(status_code=404, detail="onboarding_step_not_found")
    if current["required"]:
        raise HTTPException(status_code=409, detail="onboarding_step_required")

    step = update_step_status(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        status="SKIPPED",
    )
    record_step_event(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        user_id=user_id,
        event_name="onboarding_step_skipped",
        payload={"step_key": step_key, "step_id": step["id"]},
    )
    _advance_journey(org_id, journey["id"])
    return get_experience_state(org_id, user_id)


def _advance_journey(org_id: str, journey_id: str):
    steps = list_steps(org_id, journey_id)
    active_step = next(
        (item for item in steps if item["status"] == "IN_PROGRESS"),
        None,
    )

    if not active_step:
        next_step = next(
            (item for item in steps if item["status"] == "PENDING"),
            None,
        )

    if not active_step and next_step:
        update_step_status(
            org_id=org_id,
            journey_id=journey_id,
            step_key=next_step["step_key"],
            status="IN_PROGRESS",
        )
    elif not active_step:
        complete_journey(org_id, journey_id)


def track_event(
    org_id: str,
    user_id: str | None,
    step_key: str | None,
    event_name: str,
    payload: dict,
):
    journey = get_or_create_journey(org_id)

    return record_step_event(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        user_id=user_id,
        event_name=event_name,
        payload=payload,
    )


def build_smart_warnings(steps: list[dict]):
    statuses = {step["step_key"]: step["status"] for step in steps}
    warnings = []

    if statuses.get("OPERATIONS") != "COMPLETED":
        warnings.append(
            {
                "key": "OPERATIONS_INCOMPLETE",
                "title": "Site principal à compléter",
                "message": "Ajoutez le bureau, dépôt ou entrepôt principal de votre agence.",
                "severity": "HIGH",
            }
        )

    if statuses.get("AI_KNOWLEDGE") != "COMPLETED":
        warnings.append(
            {
                "key": "AI_NOT_CONFIGURED",
                "title": "Réponses clients à configurer",
                "message": "Choisissez le mode de réponse de l’IA et ajoutez au moins une information utile.",
                "severity": "MEDIUM",
            }
        )

    if statuses.get("WHATSAPP") != "COMPLETED":
        warnings.append(
            {
                "key": "WHATSAPP_NOT_CONNECTED",
                "title": "WhatsApp à connecter",
                "message": "Connectez le numéro que l’agence utilisera pour ses conversations clients.",
                "severity": "MEDIUM",
            }
        )

    return warnings
