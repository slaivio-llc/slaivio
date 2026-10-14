from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.packages import operations
from app.api.packages import ParcelEditPayload


def setup(monkeypatch, **overrides):
    row = {"id": "parcel", "org_id": "origin", "row_version": 4, "status": "RECEIVED_AT_ORIGIN",
           "description": "Carton", "weight_kg": None, "fees_total": None, "payment_status": "UNKNOWN", **overrides}
    engine, conn = MagicMock(), MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    statements = []
    def execute(statement, params):
        sql = str(statement)
        assert set(statement.compile().params) <= params.keys()
        statements.append((sql, params))
        result = MagicMock()
        result.mappings.return_value.first.return_value = row
        result.first.return_value = None
        return result
    conn.execute.side_effect = execute
    monkeypatch.setattr(operations, "engine", engine)
    event, notification = MagicMock(), MagicMock(return_value="notification")
    monkeypatch.setattr(operations, "_insert_package_event", event)
    monkeypatch.setattr(operations, "_queue_customer_status_notification", notification)
    return statements, event, notification


def test_edit_locks_checks_version_and_records_before_after(monkeypatch):
    statements, event, notification = setup(monkeypatch)
    result = operations.edit_parcel("origin", "parcel", "agent", 4, "Pesée vérifiée", {"weight_kg": 12.5})
    assert result == {"changed": True}
    assert "for update" in statements[0][0]
    assert "org_id=:org_id or destination_org_id=:org_id" in statements[0][0]
    assert "expedition_packages" in statements[1][0]
    assert "row_version=row_version+1" in statements[2][0]
    assert event.call_args.kwargs["metadata"]["before"]["weight_kg"] is None
    assert event.call_args.kwargs["metadata"]["after"]["weight_kg"] == "12.5"
    notification.assert_not_called()


def test_stale_edit_does_not_write(monkeypatch):
    statements, event, _ = setup(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        operations.edit_parcel("origin", "parcel", "agent", 3, "Correction", {"description": "Sac"})
    assert exc.value.detail == "package_version_conflict"
    assert len(statements) == 1
    event.assert_not_called()


@pytest.mark.parametrize("context", [{"fees_total": 0}, {"fees_total": 100}, {"shipment_id": "shipment"}, {"pricing_snapshot": {"total_minor": 100}}, {"payment_status": "PAID"}])
def test_weight_change_requires_commercial_review(monkeypatch, context):
    statements, event, _ = setup(monkeypatch, **context)
    with pytest.raises(HTTPException) as exc:
        operations.edit_parcel("origin", "parcel", "agent", 4, "Nouvelle pesée", {"weight_kg": 10})
    assert exc.value.detail == "parcel_weight_requires_review"
    assert len(statements) == 1
    event.assert_not_called()


def test_equal_decimal_measurement_is_not_a_change(monkeypatch):
    _, event, _ = setup(monkeypatch, weight_kg=Decimal("12.3"), fees_total=100)
    assert operations.edit_parcel("origin", "parcel", "agent", 4, "Vérification", {"weight_kg": 12.3}) == {"changed": False}
    event.assert_not_called()


def test_destination_can_only_update_storage(monkeypatch):
    _, event, _ = setup(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        operations.edit_parcel("destination", "parcel", "agent", 4, "Correction", {"description": "Sac"})
    assert exc.value.status_code == 403
    event.assert_not_called()
    assert operations.edit_parcel("destination", "parcel", "agent", 4, "Mise en rayon", {"warehouse_location": "B3"})["changed"]
    assert event.call_args.kwargs["org_id"] == "origin"
    assert event.call_args.kwargs["metadata"]["acting_org_id"] == "destination"


@pytest.mark.parametrize("state", ["DELIVERED", "CANCELLED", "RETURNED"])
def test_closed_parcel_cannot_be_edited(monkeypatch, state):
    _, event, _ = setup(monkeypatch, status=state)
    with pytest.raises(HTTPException) as exc:
        operations.edit_parcel("origin", "parcel", "agent", 4, "Correction", {"description": "Sac"})
    assert exc.value.detail == "parcel_edit_closed"
    event.assert_not_called()


@pytest.mark.parametrize("state", ["ARRIVED", "ARRIVED_DESTINATION", "CLEARED"])
def test_ready_is_one_atomic_state_event_and_outbox_operation(monkeypatch, state):
    statements, event, notification = setup(monkeypatch, status=state)
    result = operations.mark_ready("destination", "parcel", "agent", 4)
    assert result["queued_notification_id"] == "notification"
    assert "status='READY_FOR_PICKUP'" in statements[1][0]
    assert "DELIVERED" not in statements[1][0]
    assert event.call_args.kwargs["event_type"] == "PARCEL_READY_FOR_PICKUP"
    assert notification.call_args.args[2] == "READY_FOR_PICKUP"


def test_retry_ready_does_not_duplicate_event_or_notification(monkeypatch):
    statements, event, notification = setup(monkeypatch, status="READY_FOR_PICKUP", row_version=5)
    assert operations.mark_ready("origin", "parcel", "agent", 4)["changed"] is False
    assert len(statements) == 1
    event.assert_not_called(); notification.assert_not_called()


@pytest.mark.parametrize("state", ["RECEIVED_AT_ORIGIN", "SHIPPED", "DELIVERED"])
def test_ready_refuses_ineligible_parcels(monkeypatch, state):
    _, event, notification = setup(monkeypatch, status=state)
    with pytest.raises(HTTPException) as exc:
        operations.mark_ready("origin", "parcel", "agent", 4)
    assert exc.value.detail == "parcel_not_arrived"
    event.assert_not_called(); notification.assert_not_called()


@pytest.mark.parametrize("extra", [{"status": "DELIVERED"}, {"fees_total": 0}, {"client_id": "other"}, {"weight_kg": -1}, {"weight_kg": float("inf")}, {"reason": "  "}])
def test_edit_api_forbids_identity_status_finance_and_invalid_measurements(extra):
    with pytest.raises(ValidationError):
        ParcelEditPayload.model_validate({"expected_version": 4, "reason": "Correction", **extra})
