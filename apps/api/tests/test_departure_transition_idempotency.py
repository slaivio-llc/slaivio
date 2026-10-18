from unittest.mock import MagicMock

from app.departures import repository


def test_repeated_departure_confirmation_is_idempotent(monkeypatch):
    current = {
        "id": "departure-1",
        "org_id": "org-1",
        "status": "DEPARTED",
        "row_version": 8,
        "departure_code": "DEP-1",
        "actual_departure_at": "2026-10-18T10:00:00Z",
    }
    connection = MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value = current
    transaction = MagicMock()
    transaction.__enter__.return_value = connection
    transaction.__exit__.return_value = False
    engine = MagicMock()
    engine.begin.return_value = transaction
    monkeypatch.setattr(repository, "engine", engine)

    result = repository.transition("org-1", "departure-1", "agent-1", "Agent", "DEPARTED", 7)

    assert result == current
    assert connection.execute.call_count == 1


def test_stale_departure_confirmation_fails_before_running_business_checks(monkeypatch):
    current = {"id": "departure-1", "org_id": "org-1", "status": "LOADING", "row_version": 8}
    connection = MagicMock()
    connection.execute.return_value.mappings.return_value.first.return_value = current
    transaction = MagicMock()
    transaction.__enter__.return_value = connection
    transaction.__exit__.return_value = False
    engine = MagicMock()
    engine.begin.return_value = transaction
    monkeypatch.setattr(repository, "engine", engine)

    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as exc:
        repository.transition("org-1", "departure-1", "agent-1", "Agent", "DEPARTED", 7)

    assert exc.value.status_code == 409
    assert exc.value.detail == "departure_state_conflict"
    assert connection.execute.call_count == 1
