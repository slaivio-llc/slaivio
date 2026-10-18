from unittest.mock import MagicMock

import pytest

from app.expeditions import repository


@pytest.mark.parametrize("status", ["DISPATCHED", "IN_TRANSIT", "ARRIVED_DESTINATION", "DELIVERED"])
def test_create_expedition_rejects_post_creation_status(monkeypatch, status):
    engine = MagicMock()
    monkeypatch.setattr(repository, "engine", engine)
    monkeypatch.setattr(repository, "_ensure_schema", lambda: None)
    monkeypatch.setattr(repository, "_hydrate_expedition_references", lambda _conn, _org, payload: payload)

    with pytest.raises(ValueError, match="shipment_must_be_created_before_departure"):
        repository.create_expedition("org", "actor", {"status": status})

    engine.begin.assert_not_called()


@pytest.mark.parametrize("field", ["departed_at", "arrived_at", "delivered_at"])
def test_create_expedition_rejects_client_supplied_milestone_timestamp(monkeypatch, field):
    engine = MagicMock()
    monkeypatch.setattr(repository, "engine", engine)
    monkeypatch.setattr(repository, "_ensure_schema", lambda: None)
    monkeypatch.setattr(repository, "_hydrate_expedition_references", lambda _conn, _org, payload: payload)

    with pytest.raises(ValueError, match="shipment_milestones_are_server_managed"):
        repository.create_expedition("org", "actor", {field: "2026-10-18T12:00:00Z"})

    engine.begin.assert_not_called()
