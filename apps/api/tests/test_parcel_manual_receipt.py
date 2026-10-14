from unittest.mock import MagicMock

import pytest

from app.packages.receipt import prepare_manual_receipt
from app.packages import repository


def receipt(**overrides):
    return dict(client_id="client", route_id="route", shipping_service_id="service", **overrides)


@pytest.mark.parametrize("field", ["client_id", "route_id", "shipping_service_id"])
def test_receipt_requires_commercial_links(field):
    data = receipt()
    del data[field]
    with pytest.raises(ValueError, match=f"{field}_required"):
        prepare_manual_receipt(data)


@pytest.mark.parametrize("weight", [-1, 0, float("nan"), float("inf")])
def test_receipt_rejects_invalid_measurement(weight):
    with pytest.raises(ValueError, match="invalid_receipt_weight"):
        prepare_manual_receipt(receipt(weight_kg=weight))


def test_unknown_weight_stays_unknown_and_context_cannot_be_forged():
    original = receipt(weight_kg=None, status="DELIVERED", received_at="2000-01-01",
                       package_reference="forged", fees_total=123, destination_country="forged",
                       supplier_tracking="  EXT-42  ")
    result = prepare_manual_receipt(original)
    assert result["weight_kg"] is None
    assert result["status"] == "RECEIVED_AT_ORIGIN"
    assert result["received_at"].tzinfo is not None
    assert result["supplier_tracking"] == "EXT-42"
    assert not {"package_reference", "fees_total", "destination_country"} & result.keys()
    assert original["status"] == "DELIVERED"


def setup_repository(monkeypatch, *, client=True, route=True, service_route="route", canonical_offering=False):
    conn, engine = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    statements = []

    def execute(statement, params):
        sql = str(statement)
        assert set(statement.compile().params) <= params.keys()
        statements.append((sql, params))
        result = MagicMock()
        if "select organization_type" in sql:
            result.scalar.return_value = "PARCEL_FREIGHT"
        elif "from clients" in sql:
            assert params["org_id"] == "office"
            result.mappings.return_value.first.return_value = {"id": "client"} if client else None
        elif "from service_route_offerings offering" in sql:
            if "select offering.route_id::text" in sql:
                result.fetchall.return_value = [("route",)] if canonical_offering else []
            else:
                result.first.return_value = {
                    "id": 1,
                } if canonical_offering or service_route == "route" else None
        elif "from shipping_routes" in sql:
            assert params["org_id"] == "office"
            result.mappings.return_value.first.return_value = {"id": "route", "destination_country": "CD", "transport_mode": "AIR"} if route else None
        elif "from shipping_services" in sql:
            assert params["org_id"] == "office"
            result.mappings.return_value.first.return_value = {
                "id": "service", "route_id": service_route, "shipping_mode": "AIR",
            }
        elif "next_organization_reference" in sql:
            result.scalar_one.return_value = "COL-0001"
        elif "insert into cargo_packages" in sql:
            result.fetchone.return_value = ["package"]
        return result

    conn.execute.side_effect = execute
    monkeypatch.setattr(repository, "engine", engine)
    monkeypatch.setattr(repository, "_ensure_schema", lambda: None)
    monkeypatch.setattr(repository, "get_package", lambda *args: {"id": "package"})
    monkeypatch.setattr(repository, "_insert_package_event", MagicMock())
    monkeypatch.setattr(repository, "_queue_customer_status_notification", MagicMock(return_value="notification"))
    return statements


@pytest.mark.parametrize("options,error", [
    ({"client": False}, "client_not_found"),
    ({"route": False}, "route_not_found"),
    ({"service_route": "another-route"}, "shipping_service_not_found_for_route"),
])
def test_repository_rejects_unavailable_or_incompatible_links(monkeypatch, options, error):
    statements = setup_repository(monkeypatch, **options)
    with pytest.raises(ValueError, match=error):
        repository.create_package("office", "agent", receipt())
    assert not any("insert into cargo_packages" in sql for sql, _ in statements)


def test_repository_receives_with_generated_identity_and_null_measurement(monkeypatch):
    statements = setup_repository(monkeypatch)
    result = repository.create_package("office", "agent", receipt(weight_kg=None))
    inserted = next(params for sql, params in statements if "insert into cargo_packages" in sql)
    assert inserted["package_reference"] == "COL-0001"
    assert inserted["tracking_id"] == "COL-0001"
    assert inserted["received_by"] == "agent"
    assert inserted["received_at"] is not None
    assert inserted["destination_country"] == "CD"
    assert inserted["weight_kg"] is None
    assert inserted["fees_total"] is None
    assert inserted["status"] == "RECEIVED_AT_ORIGIN"
    assert result["queued_notification_id"] == "notification"
    repository._insert_package_event.assert_called_once()
    repository._queue_customer_status_notification.assert_called_once()


def test_repository_accepts_canonical_many_to_many_service_route(monkeypatch):
    statements = setup_repository(monkeypatch, service_route=None, canonical_offering=True)
    repository.create_package("office", "agent", receipt())
    assert any("from service_route_offerings offering" in sql for sql, _ in statements)
