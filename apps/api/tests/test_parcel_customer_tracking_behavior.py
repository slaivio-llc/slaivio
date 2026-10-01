from types import SimpleNamespace
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest

from app.packages import repository
from app.expeditions import repository as expeditions
from app.expeditions.repository import _hydrate_expedition_references, _sync_customer_package_milestone


@pytest.mark.parametrize("status", list(repository.CUSTOMER_STATUS_MESSAGES))
def test_milestone_message_contains_agency_and_exact_tracking_link(status):
    conn = MagicMock()
    enabled = MagicMock()
    enabled.first.return_value = (1,)
    customer = MagicMock()
    customer.mappings.return_value.first.return_value = {
        "phone": "+243000000000", "agency_name": "LUZA SERVICES",
    }
    queued = MagicMock()
    queued.first.return_value = ("notification-1",)
    conn.execute.side_effect = [enabled, customer, queued, MagicMock()]
    reference = "LUZA/2026 001"
    result = repository._queue_customer_status_notification(conn, {
        "id": "package-1", "org_id": "office-1", "client_id": "client-1",
        "tracking_id": reference, "destination_city": "Kinshasa",
    }, status, "operator-1")
    assert result == "notification-1"
    payload = conn.execute.call_args_list[2].args[1]
    assert payload["org_id"] == "office-1"
    assert payload["message"].startswith("LUZA SERVICES\n\n")
    link = payload["message"].split("Suivre le colis : ", 1)[1].splitlines()[0]
    assert parse_qs(urlparse(link).query)["reference"] == [reference]
    assert conn.execute.call_args_list[3].args[1]["notification_outbox_id"] == result


def test_disabled_milestones_do_not_queue_any_message():
    conn = MagicMock()
    conn.execute.return_value.first.return_value = None
    assert repository._queue_customer_status_notification(conn, {
        "id": "package-1", "org_id": "office-1", "client_id": "client-1",
    }, "DELIVERED", "operator-1") is None
    assert conn.execute.call_count == 1


def test_public_lookup_returns_brand_without_internal_package_id(monkeypatch):
    conn = MagicMock()
    package = {"id": "internal-id", "tracking_id": "LUZA-001",
               "agency_name": "LUZA SERVICES", "agency_logo_url": "https://example.com/logo.png"}
    conn.execute.return_value.fetchall.side_effect = [[SimpleNamespace(_mapping=package)], []]
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, "engine", engine)
    result = repository.public_package_tracking("LUZA-001")
    assert result["agency_name"] == "LUZA SERVICES"
    assert result["agency_logo_url"] == "https://example.com/logo.png"
    assert "id" not in result
    assert result["events"] == []


def test_ambiguous_public_reference_does_not_choose_an_agency(monkeypatch):
    conn = MagicMock()
    conn.execute.return_value.fetchall.return_value = [object(), object()]
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, "engine", engine)
    assert repository.public_package_tracking("LUZA-001") is None


def test_expedition_uses_configured_route_and_service_in_its_office():
    conn = MagicMock()
    conn.execute.return_value.mappings.return_value.first.side_effect = [
        {"route_id": "route-1", "shipping_mode": "SEA", "service_name": "Maritime"},
        {"route_name": "Chine – RDC", "origin_country": "CN", "origin_city": "Guangzhou",
         "destination_country": "CD", "destination_city": "Kinshasa", "transport_mode": "SEA"},
    ]
    result = _hydrate_expedition_references(conn, "office-1", {
        "shipping_service_id": "service-1", "route_id": "route-1", "destination_country": "incorrect",
    })
    assert result["destination_country"] == "CD"
    assert result["mode"] == "SEA"
    assert result["service_type"] == "Maritime"
    assert all(call.args[1]["org_id"] == "office-1" for call in conn.execute.call_args_list)


@pytest.mark.parametrize("shipment_status,package_status", [
    ("DISPATCHED", "SHIPPED"), ("IN_TRANSIT", "IN_TRANSIT"),
    ("ARRIVED_DESTINATION", "ARRIVED_DESTINATION"), ("CUSTOMS_CLEARANCE", "CUSTOMS"),
    ("AVAILABLE_FOR_PICKUP", "READY_FOR_PICKUP"), ("DELIVERED", "DELIVERED"),
])
def test_expedition_milestone_updates_package_history_and_queues_message(monkeypatch, shipment_status, package_status):
    conn = MagicMock()
    package = {"id": "package-1", "org_id": "office-1", "status": "BATCHED"}
    conn.execute.return_value.mappings.return_value.all.return_value = [package]
    queue = MagicMock(return_value="notification-1")
    monkeypatch.setattr(repository, "_queue_customer_status_notification", queue)
    assert _sync_customer_package_milestone(conn, "office-1", "shipment-1", "operator-1", shipment_status) == ["notification-1"]
    queue.assert_called_once_with(conn, package, package_status, "operator-1")
    assert conn.execute.call_args_list[1].args[1]["status"] == package_status
    assert conn.execute.call_args_list[2].args[1]["previous"] == "BATCHED"


def test_cancelling_transport_does_not_claim_that_customer_packages_are_cancelled():
    conn = MagicMock()
    assert _sync_customer_package_milestone(conn, "office-1", "shipment-1", "operator-1", "CANCELLED") == []
    conn.execute.assert_not_called()


def test_creating_expedition_binds_all_configured_references(monkeypatch):
    conn = MagicMock()
    conn.execute.return_value.fetchone.return_value = ("shipment-1",)
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(expeditions, "engine", engine)
    monkeypatch.setattr(expeditions, "_ensure_schema", lambda: None)
    monkeypatch.setattr(expeditions, "_hydrate_expedition_references", lambda c, org, payload: payload)
    monkeypatch.setattr(expeditions, "_seed_checkpoints", MagicMock())
    monkeypatch.setattr(expeditions, "_insert_event", MagicMock())
    monkeypatch.setattr(expeditions, "get_expedition", lambda org, id: {"id": id})
    result = expeditions.create_expedition("office-1", "operator-1", {
        "route_id": "route-1", "shipping_service_id": "service-1", "mode": "AIR",
    })
    assert result["id"] == "shipment-1"
    statement, parameters = conn.execute.call_args.args
    assert set(statement.compile().params) <= parameters.keys()
    assert parameters["route_id"] == "route-1"
    assert parameters["shipping_service_id"] == "service-1"
