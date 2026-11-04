import json
import pytest
from unittest.mock import MagicMock

from app.api.pricing import GridCreate
from app.pricing_engine import repository


@pytest.mark.parametrize('publish_on_create',[False,True])
def test_grid_creation_can_atomically_create_a_base_price_rule(monkeypatch,publish_on_create):
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
    transition=MagicMock(return_value={'id':'grid-id','status':'ACTIVE'})
    monkeypatch.setattr(repository,'transition',transition)

    payload = GridCreate(
        grid_code="AIR-01",
        name="Tarif aérien",
        route_id="route-id",
        shipping_service_id="service-id",
        calculation_method="PER_KG",
        initial_price=8.5,
        initial_category_code="FRAGILE",
        initial_package_type="carton",
        publish_on_create=publish_on_create,
    ).model_dump()
    created = repository.create_grid("org-id", "actor-id", "Agent", payload)

    assert created["id"] == "grid-id"
    assert connection.execute.call_count == 3
    rule_insert = connection.execute.call_args_list[2]
    assert "insert into pricing_grid_rules" in str(rule_insert.args[0])
    assert rule_insert.args[1]["amount"] == 8.5
    assert rule_insert.args[1]["method"] == "PER_KG"
    assert json.loads(rule_insert.args[1]["conditions"]) == {
        "category_code": "FRAGILE",
        "package_type": "carton",
    }
    assert [call.args[3] for call in audit.call_args_list] == [
        "GRID_CREATED",
        "RULE_CREATED",
    ]
    if publish_on_create:
        transition.assert_called_once_with('org-id','grid-id','ACTIVE','actor-id','Agent','Création et publication du tarif',connection=connection)
        assert created['status']=='ACTIVE'
    else:transition.assert_not_called()
    assert engine.begin.call_count==1
