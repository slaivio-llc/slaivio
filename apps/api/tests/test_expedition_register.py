from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.expeditions import register


def setup_create(monkeypatch, *, service=True):
    conn, engine = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(register, "engine", engine)
    monkeypatch.setattr(register, "generate_expedition_reference", lambda: "EXP-TEST")
    events = MagicMock()
    monkeypatch.setattr(register, "_insert_event", events)
    statements = []

    def execute(statement, params):
        sql = str(statement)
        statements.append((sql, params))
        result = MagicMock()
        if "select e.org_id,e.created_by,e.expedition_reference" in sql:
            result.mappings.return_value.first.return_value = None
        elif "select route_name,origin_country,origin_city" in sql:
            result.mappings.return_value.first.return_value = {
                "route_name": "China–DRC", "origin_country": "CN", "origin_city": "Guangzhou",
                "destination_country": "CD", "destination_city": "Kinshasa", "transport_mode": "AIR",
            }
        elif "select s.service_name,s.shipping_mode" in sql:
            result.first.return_value = (
                {"service_name": "Aérien", "shipping_mode": "AIR"} if service else None
            )
        return result

    conn.execute.side_effect = execute
    return statements, events


def test_planned_expedition_persists_route_service_schedule_and_note(monkeypatch):
    statements, events = setup_create(monkeypatch)
    result = register.create(
        "org", "actor", "route", None, "request-key", "service-id", "Fragile · traiter avec soin",
    )
    insert_sql, params = next((sql, params) for sql, params in statements if "insert into cargo_expeditions" in sql)
    assert result == {"id": "request-key", "reference": "EXP-TEST", "replayed": False}
    assert "shipping_service_id" in insert_sql and "service_type" in insert_sql
    assert params["route_id"] == "route" and params["service_id"] == "service-id"
    assert params["transport_mode"] == "AIR" and params["service_name"] == "Aérien"
    assert params["notes"] == "Fragile · traiter avec soin"
    assert events.call_args.kwargs["event_type"] == "EXPEDITION_CREATED"


def test_planning_rejects_a_service_not_offered_on_the_selected_route(monkeypatch):
    statements, events = setup_create(monkeypatch, service=False)
    with pytest.raises(HTTPException) as exc:
        register.create("org", "actor", "route", None, "request-key", "wrong-service", None)
    assert exc.value.status_code == 409
    assert exc.value.detail == "shipment_service_unavailable_for_route"
    assert not any("insert into cargo_expeditions" in sql for sql, _ in statements)
    events.assert_not_called()
