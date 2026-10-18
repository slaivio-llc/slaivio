from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.packages import repository


def locked_package(status="READY_FOR_PICKUP"):
    return {
        "id": "parcel", "org_id": "agency", "row_version": 3,
        "status": status, "package_reference": "COL-1", "shipping_service_id": "service",
    }


def mocked_transaction(monkeypatch, package):
    conn = MagicMock()
    conn.execute.return_value.mappings.return_value.first.return_value = package
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repository, "engine", engine)
    return conn


@pytest.mark.parametrize("path", ["status_transition", "delivery_proof"])
def test_financially_blocked_delivery_does_not_write_status_or_proof(monkeypatch, path):
    conn = mocked_transaction(monkeypatch, locked_package())
    denied = HTTPException(409, detail={
        "code": "PAYMENT_CLEARANCE_REQUIRED", "remaining": "80.00", "currency": "USD",
    })
    clearance = MagicMock(side_effect=denied)
    monkeypatch.setattr(repository, "_require_package_delivery_financial_clearance", clearance)

    with pytest.raises(HTTPException) as error:
        if path == "status_transition":
            repository.transition_package("agency", "parcel", "agent", "DELIVERED", 3)
        else:
            repository.delivery_proof("agency", "parcel", "agent", {"recipient_name": "Client"})

    assert error.value.detail["remaining"] == "80.00"
    clearance.assert_called_once()
    conn.execute.assert_called_once()  # lock/read only; the transaction writes nothing


def test_delivery_proof_requires_pickup_ready_state(monkeypatch):
    conn = mocked_transaction(monkeypatch, locked_package(status="ARRIVED_DESTINATION"))
    clearance = MagicMock()
    monkeypatch.setattr(repository, "_require_package_delivery_financial_clearance", clearance)

    with pytest.raises(HTTPException) as error:
        repository.delivery_proof("agency", "parcel", "agent", {"recipient_name": "Client"})

    assert error.value.status_code == 409
    assert error.value.detail == "package_not_ready_for_delivery"
    clearance.assert_not_called()
    conn.execute.assert_called_once()
