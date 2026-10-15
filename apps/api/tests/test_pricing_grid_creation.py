from unittest.mock import MagicMock

from app.api.pricing import GridCreate
from app.pricing_engine import repository


def test_grid_creation_can_atomically_create_a_base_price_rule(monkeypatch):
    connection = MagicMock()
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = connection

    service = MagicMock()
    service.first.return_value = {"id": "service-id"}
    grid = MagicMock()
    grid.mappings.return_value.one.return_value = {"id": "grid-id", "grid_code": "AIR-01"}
    rule = MagicMock()
    rule.mappings.return_value.one.return_value = {"id": "rule-id", "name": "Tarif de base"}
    connection.execute.side_effect = [service, grid, rule]
    audit = MagicMock()
    monkeypatch.setattr(repository, "engine", engine)
    monkeypatch.setattr(repository, "_audit", audit)

    payload = GridCreate(
        grid_code="AIR-01",
        name="Tarif aérien",
        route_id="route-id",
        shipping_service_id="service-id",
        calculation_method="PER_KG",
        initial_price=8.5,
    ).model_dump()
    created = repository.create_grid("org-id", "actor-id", "Agent", payload)

    assert created["id"] == "grid-id"
    assert connection.execute.call_count == 3
    rule_insert = connection.execute.call_args_list[2]
    assert "insert into pricing_grid_rules" in str(rule_insert.args[0])
    assert rule_insert.args[1]["amount"] == 8.5
    assert rule_insert.args[1]["method"] == "PER_KG"
    assert [call.args[3] for call in audit.call_args_list] == [
        "GRID_CREATED",
        "RULE_CREATED",
    ]
