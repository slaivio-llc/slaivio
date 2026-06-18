from app.onboarding_experience.repositories.onboarding_experience_repository import (
    complete_journey,
    get_or_create_journey,
    list_steps,
    record_step_event,
    update_step_status,
)


def get_experience_state(org_id: str, user_id: str | None):
    journey = get_or_create_journey(org_id)
    steps = list_steps(org_id, journey["id"])

    total = len(steps)
    completed = [step for step in steps if step["status"] == "COMPLETED"]
    required_steps = [step for step in steps if step["required"]]
    completed_required = [
        step for step in required_steps if step["status"] == "COMPLETED"
    ]

    progress = int((len(completed) / total) * 100) if total else 0
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

    record_step_event(
        org_id=org_id,
        journey_id=journey["id"],
        step_key=step_key,
        user_id=user_id,
        event_name="onboarding_step_completed",
        payload={"step_key": step_key, "step_id": step["id"] if step else None},
    )

    steps = list_steps(org_id, journey["id"])
    next_step = next(
        (item for item in steps if item["status"] == "PENDING"),
        None,
    )

    if next_step:
        update_step_status(
            org_id=org_id,
            journey_id=journey["id"],
            step_key=next_step["step_key"],
            status="IN_PROGRESS",
        )
    else:
        complete_journey(org_id, journey["id"])

    return get_experience_state(org_id, user_id)


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

    if statuses.get("WAREHOUSES") != "COMPLETED":
        warnings.append(
            {
                "key": "NO_WAREHOUSE",
                "title": "No warehouse configured",
                "message": (
                    "Your agency cannot receive parcels until at least one "
                    "warehouse is configured."
                ),
                "severity": "HIGH",
            }
        )

    if statuses.get("PRICING") != "COMPLETED":
        warnings.append(
            {
                "key": "NO_PRICING",
                "title": "No pricing configured",
                "message": "Quotes cannot be generated until pricing is configured.",
                "severity": "HIGH",
            }
        )

    if statuses.get("WHATSAPP") != "COMPLETED":
        warnings.append(
            {
                "key": "WHATSAPP_NOT_CONNECTED",
                "title": "WhatsApp is not connected",
                "message": (
                    "Customers cannot communicate with your agency through "
                    "SLAIVIO until WhatsApp is connected."
                ),
                "severity": "MEDIUM",
            }
        )

    return warnings
