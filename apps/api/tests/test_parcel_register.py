from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.packages import register
from app.api.packages import packages_register


def setup_query(monkeypatch, *, row=None):
    conn, engine = MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    statements = []

    def execute(statement, params):
        assert set(statement.compile().params) <= params.keys()
        sql = str(statement)
        statements.append((sql, params.copy()))
        result = MagicMock()
        result.scalar_one.return_value = 1
        result.mappings.return_value.__iter__.return_value = iter([row] if row else [])
        result.mappings.return_value.first.return_value = row
        return result

    conn.execute.side_effect = execute
    monkeypatch.setattr(register, "engine", engine)
    return statements


def test_register_scopes_owner_and_destination_without_finance_projection(monkeypatch):
    statements = setup_query(monkeypatch, row={"id": "parcel", "org_id": "source", "status": "BATCHED"})
    result = register.parcel_register("destination", q="EXT_%'", start=date(2026, 10, 1), end=date(2026, 10, 10), page=2)
    assert result["items"][0]["local_client"] is False
    assert result["items"][0]["stage"] == "received"  # assigned does not mean departed
    for sql, params in statements:
        assert "p.org_id=:org_id or p.destination_org_id=:org_id" in sql
        assert params["org_id"] == "destination"
        assert params["q"] == "%EXT!_!%'%"
        assert "EXT_%'" not in sql
        assert "deleted_at is null" in sql
        assert "interval '1 day'" in sql
    projection = statements[-1][0].split("from cargo_packages")[0]
    assert "fees" not in projection and "payment" not in projection and "phone" not in projection
    assert statements[-1][1]["offset"] == 50
    assert "p.created_at desc,p.id desc" in statements[-1][0]


@pytest.mark.parametrize("state,expected", [("BATCHED", "received"), ("SHIPPED", "shipped"), ("ARRIVED_DESTINATION", "arrived"), ("READY_FOR_PICKUP", "ready"), ("DELIVERED", "delivered"), ("CREATED", "other")])
def test_physical_state_mapping_does_not_invent_departure_or_delivery(state, expected):
    assert register.present({"org_id": "office", "status": state}, "office")["stage"] == expected


def test_filters_use_parameterized_state_groups(monkeypatch):
    statements = setup_query(monkeypatch)
    register.parcel_register("office", stage="ready")
    assert statements[0][1]["states"] == ["READY_FOR_PICKUP"]
    assert "= any(cast(:states as text[]))" in statements[0][0]


def test_history_checks_parcel_visibility_and_omits_internal_metadata(monkeypatch):
    statements = setup_query(monkeypatch)
    register.parcel_history("office", "parcel", page=3)
    for sql, params in statements:
        assert "exists(select 1 from cargo_packages p" in sql
        assert "p.id=e.package_id and p.org_id=e.org_id" in sql
        assert params["org_id"] == "office"
        assert params["package_id"] == "parcel"
    assert statements[-1][1]["offset"] == 100
    assert "metadata" not in statements[-1][0]
    assert "'PRICING_CALCULATED','PACKAGE_NOTIFICATION_QUEUED'" in statements[-1][0]
    assert "then null else e.description" in statements[-1][0]


def test_overview_is_not_returned_outside_authorized_scope(monkeypatch):
    statements = setup_query(monkeypatch)
    assert register.parcel_overview("office", "parcel") is None
    assert "p.org_id=:org_id or p.destination_org_id=:org_id" in statements[0][0]


def test_api_rejects_inverted_dates_without_querying(monkeypatch):
    query = MagicMock()
    monkeypatch.setattr(register, "parcel_register", query)
    with pytest.raises(HTTPException) as exc:
        packages_register(start=date(2026,10,11), end=date(2026,10,1), tenant={"org_id":"office"})
    assert exc.value.status_code == 422
    query.assert_not_called()
