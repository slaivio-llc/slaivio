from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.onboarding_experience.services import onboarding_experience_service as service


def test_skip_optional_step_records_audit_and_advances(monkeypatch):
    journey_id = uuid4()
    step_id = uuid4()
    steps = [
        {
            "id": step_id,
            "step_key": "WHATSAPP",
            "status": "IN_PROGRESS",
            "required": False,
        }
    ]
    updates = []
    events = []

    monkeypatch.setattr(service, "get_or_create_journey", lambda _org: {"id": journey_id})
    monkeypatch.setattr(service, "list_steps", lambda _org, _journey: steps)
    monkeypatch.setattr(
        service,
        "update_step_status",
        lambda **values: updates.append(values) or {**steps[0], "status": values["status"]},
    )
    monkeypatch.setattr(service, "record_step_event", lambda **values: events.append(values))
    monkeypatch.setattr(service, "_advance_journey", lambda *_args: None)
    monkeypatch.setattr(service, "get_experience_state", lambda *_args: {"ok": True})

    assert service.skip_step("org-1", "user-1", "WHATSAPP") == {"ok": True}
    assert updates[0]["status"] == "SKIPPED"
    assert events[0]["event_name"] == "onboarding_step_skipped"
    assert events[0]["payload"]["step_id"] == step_id


def test_skip_required_step_is_rejected(monkeypatch):
    journey_id = uuid4()
    monkeypatch.setattr(service, "get_or_create_journey", lambda _org: {"id": journey_id})
    monkeypatch.setattr(
        service,
        "list_steps",
        lambda _org, _journey: [
            {"step_key": "AGENCY_PROFILE", "status": "IN_PROGRESS", "required": True}
        ],
    )

    with pytest.raises(HTTPException) as error:
        service.skip_step("org-1", "user-1", "AGENCY_PROFILE")

    assert error.value.status_code == 409
    assert error.value.detail == "onboarding_step_required"


def test_skipped_steps_count_as_journey_progress_not_readiness(monkeypatch):
    journey_id = uuid4()
    steps = [
        {"step_key": "AGENCY_PROFILE", "status": "COMPLETED", "required": True},
        {"step_key": "WHATSAPP", "status": "SKIPPED", "required": False},
        {"step_key": "REVIEW", "status": "PENDING", "required": True},
    ]
    monkeypatch.setattr(service, "get_or_create_journey", lambda _org: {"id": journey_id})
    monkeypatch.setattr(service, "list_steps", lambda _org, _journey: steps)
    monkeypatch.setattr(service, "get_business_type", lambda _org: "PARCEL_FREIGHT")

    state = service.get_experience_state("org-1", "user-1")

    assert state["progress"] == 66
    assert state["readiness_score"] == 50
    assert state["business_type"] == "PARCEL_FREIGHT"
    assert state["current_step"]["step_key"] == "REVIEW"
