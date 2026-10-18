from app.expeditions.repository import _package_eligibility


def test_manual_payment_status_does_not_block_operational_assignment():
    expedition = {
        "mode": "AIR",
        "route_id": "route-1",
        "shipping_service_id": "service-1",
        "destination_country": "CD",
        "destination_city": "Kinshasa",
        "capacity_weight_kg": 100,
        "reserved_weight_kg": 0,
        "capacity_cbm": None,
        "reserved_cbm": 0,
    }
    package = {
        "client_id": "client-1",
        "status": "RECEIVED_AT_ORIGIN",
        "inventory_status": "IN_STOCK",
        "validation_status": "VALIDATED",
        "payment_status": "UNPAID",
        "route_id": "route-1",
        "shipping_service_id": "service-1",
        "destination_country": "CD",
        "destination_city": "Kinshasa",
        "weight_kg": 2,
        "volume_cbm": None,
    }

    decision = _package_eligibility(None, "org-1", expedition, package)

    assert decision["eligible"] is True
    assert "payment_not_cleared" not in decision["reason_codes"]

