from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.pricing_engine import repository


def calculator(monkeypatch, grid, rules=None, tier=None):
    conn = MagicMock()
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn

    def execute(statement, params):
        sql = str(statement)
        result = MagicMock()
        mappings = result.mappings.return_value
        if "from pricing_grids g" in sql:
            mappings.first.return_value = grid
        elif "from pricing_grid_rules x" in sql:
            mappings.all.return_value = rules or []
        elif "from pricing_tiers" in sql:
            mappings.first.return_value = tier
        elif "from pricing_fees" in sql or "from pricing_internal_costs" in sql:
            mappings.all.return_value = []
        else:
            raise AssertionError(f"Unexpected pricing query: {sql}")
        return result

    conn.execute.side_effect = execute
    monkeypatch.setattr(repository, "engine", engine)
    return conn


def make_grid(**overrides):
    return {
        "id": "grid-id",
        "grid_code": "AIR-01",
        "version": 1,
        "route_id": "route-id",
        "currency_code": "USD",
        "calculation_method": "PER_KG",
        "volumetric_divisor": 6000,
        "chargeable_weight_rule": "MAX",
        "rounding_increment": 0.1,
        "minimum_weight_kg": None,
        "minimum_cbm": None,
        "maximum_weight_kg": None,
        "maximum_cbm": None,
        "maximum_declared_value": None,
        "weight_volume_switch_kg_per_cbm": None,
        "tax_inclusive": False,
        "tax_rate": 0,
        "effective_from": None,
        **overrides,
    }


def make_price_rule(**overrides):
    return {
        "id": "rule-id",
        "action_type": "SET_PRICE",
        "calculation_method": "PER_KG",
        "amount": 2,
        "category_id": None,
        "category_code": None,
        "conditions": {},
        "client_id": None,
        "client_segment": None,
        **overrides,
    }


def test_density_switch_charges_weight_when_configured(monkeypatch):
    calculator(
        monkeypatch,
        make_grid(calculation_method="PER_CBM", weight_volume_switch_kg_per_cbm=450),
        [make_price_rule(calculation_method=None)],
    )

    result = repository.quote(
        "org-id",
        {
            "route_id": "route-id",
            "shipping_service_id": "service-id",
            "weight_kg": 500,
            "volume_cbm": 1,
            "priced_at": "2026-10-14T10:00:00Z",
        },
        "actor-id",
    )

    assert result["chargeable_weight_kg"] == 500
    assert result["subtotal"] == 1000
    assert any("densité supérieure à 450" in line["label"] for line in result["breakdown"])


def test_fixed_cbm_tier_is_not_multiplied_by_volume(monkeypatch):
    calculator(
        monkeypatch,
        make_grid(calculation_method="TIERED"),
        tier={
            "unit_price": 62500,
            "calculation_method": "FIXED",
        },
    )

    result = repository.quote(
        "org-id",
        {
            "route_id": "route-id",
            "shipping_service_id": "service-id",
            "weight_kg": 0,
            "volume_cbm": 0.2,
            "priced_at": "2026-10-14T10:00:00Z",
        },
        "actor-id",
    )

    assert result["subtotal"] == 62500
    assert result["total"] == 62500


def test_quote_requires_weight_for_per_kg_pricing(monkeypatch):
    calculator(monkeypatch, make_grid(), [make_price_rule()])

    with pytest.raises(HTTPException) as error:
        repository.quote(
            "org-id",
            {
                "route_id": "route-id",
                "shipping_service_id": "service-id",
                "weight_kg": 0,
                "priced_at": "2026-10-14T10:00:00Z",
            },
            "actor-id",
        )

    assert error.value.status_code == 422
    assert error.value.detail == {"code": "pricing_input_required", "field": "weight_kg"}


def test_quote_prefers_matching_goods_and_package_type_rule(monkeypatch):
    calculator(
        monkeypatch,
        make_grid(),
        [
            make_price_rule(amount=2, name="Prix général"),
            make_price_rule(
                id="specific-rule",
                amount=5,
                name="Prix fragile en carton",
                conditions={"category_code": "FRAGILE", "package_type": "carton"},
            ),
        ],
    )

    result = repository.quote(
        "org-id",
        {
            "route_id": "route-id",
            "shipping_service_id": "service-id",
            "category_code": "FRAGILE",
            "package_type": "carton",
            "weight_kg": 3,
            "priced_at": "2026-10-14T10:00:00Z",
        },
        "actor-id",
    )

    assert result["subtotal"] == 15


def test_quote_falls_back_to_general_price_for_other_package_type(monkeypatch):
    calculator(
        monkeypatch,
        make_grid(),
        [
            make_price_rule(amount=2, name="Prix général"),
            make_price_rule(
                id="specific-rule",
                amount=5,
                name="Prix fragile en carton",
                conditions={"category_code": "FRAGILE", "package_type": "carton"},
            ),
        ],
    )

    result = repository.quote(
        "org-id",
        {
            "route_id": "route-id",
            "shipping_service_id": "service-id",
            "category_code": "FRAGILE",
            "package_type": "palette",
            "weight_kg": 3,
            "priced_at": "2026-10-14T10:00:00Z",
        },
        "actor-id",
    )

    assert result["subtotal"] == 6


def test_quote_requires_package_type_for_package_specific_prices(monkeypatch):
    calculator(
        monkeypatch,
        make_grid(),
        [
            make_price_rule(
                conditions={"package_type": "carton"},
            ),
        ],
    )

    with pytest.raises(HTTPException) as error:
        repository.quote(
            "org-id",
            {
                "route_id": "route-id",
                "shipping_service_id": "service-id",
                "weight_kg": 3,
                "priced_at": "2026-10-14T10:00:00Z",
            },
            "actor-id",
        )

    assert error.value.status_code == 422
    assert error.value.detail == {"code": "pricing_input_required", "field": "package_type"}
