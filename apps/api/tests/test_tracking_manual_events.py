from unittest.mock import MagicMock

import pytest

from app.tracking import repository


@pytest.mark.parametrize("inserted", [True, False])
def test_manual_tracking_replay_does_not_refresh_signal(monkeypatch, inserted):
    conn = MagicMock()
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, "engine", engine)
    monkeypatch.setattr(repository, "get_expedition", lambda *_: {"id": "expedition"})
    monkeypatch.setattr(repository, "tracking_detail", lambda *_: {"id": "expedition"})
    conn.execute.return_value.first.return_value = ("event-id",) if inserted else None

    result = repository.add_manual_event("org", "expedition", "actor", {
        "event_type": "ARRIVAL_SCAN",
        "title": "Arrivée au dépôt",
        "occurred_at": "2026-10-01T12:00:00Z",
        "location": "Kinshasa",
        "idempotency_key": "tracking-event-123",
    })

    assert result == {"id": "expedition"}
    # First call inserts/deduplicates; only a newly inserted event updates the
    # expedition's last signal and location.
    assert conn.execute.call_count == (2 if inserted else 1)
    insert_sql = str(conn.execute.call_args_list[0].args[0]).lower()
    assert "returning id" in insert_sql
    if inserted:
        update_sql = str(conn.execute.call_args_list[1].args[0]).lower()
        assert "greatest(coalesce(last_signal_at" in update_sql
        assert "coalesce(cast(:occurred_at as timestamptz),now())>=last_signal_at" in update_sql
