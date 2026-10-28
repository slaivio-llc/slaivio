import pytest

from app.api.packages import PackagePayload


@pytest.mark.parametrize(
    "status",
    ["CREATED", "PENDING_VALIDATION", "CONFIRMED", "RECEIVED", "RECEIVED_AT_ORIGIN"],
)
def test_package_creation_accepts_only_initial_statuses(status):
    payload = PackagePayload.model_validate({'status': status})

    assert payload.status == status


def test_administrative_package_creation_does_not_mark_physical_receipt():
    payload = PackagePayload.model_validate({})

    assert payload.status == "CREATED"
    assert payload.received_at is None


@pytest.mark.parametrize(
    "status",
    ["SHIPPED", "IN_TRANSIT", "ARRIVED", "ARRIVED_DESTINATION", "DELIVERED", "CANCELLED"],
)
def test_package_creation_cannot_skip_to_later_operational_status(status):
    with pytest.raises(ValueError, match="package_creation_cannot_skip_operational_transitions"):
        PackagePayload.model_validate({'status': status})


@pytest.mark.parametrize("field", ["dispatched_at", "delivered_at"])
def test_package_creation_cannot_forge_dispatch_or_delivery_timestamp(field):
    with pytest.raises(ValueError, match="package_creation_cannot_record_dispatch_or_delivery"):
        PackagePayload.model_validate({**{field: "2026-10-18T12:00:00Z"}})


def test_received_timestamp_requires_a_received_state():
    with pytest.raises(ValueError, match="received_at_requires_received_status"):
        PackagePayload.model_validate({'status': "CREATED", 'received_at': "2026-10-18T12:00:00Z"})


def test_physical_receipt_can_keep_its_recorded_timestamp():
    payload = PackagePayload.model_validate({'status': "RECEIVED_AT_ORIGIN", 'received_at': "2026-10-18T12:00:00Z"})

    assert payload.received_at == "2026-10-18T12:00:00Z"
