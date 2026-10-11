"""Server-owned context for a manually received parcel (not vehicle dossiers)."""

from datetime import datetime, timezone
from math import isfinite


def prepare_manual_receipt(payload: dict) -> dict:
    for field in ("client_id", "shipping_service_id", "route_id"):
        if not payload.get(field):
            raise ValueError(f"{field}_required")
    weight = payload.get("weight_kg")
    if weight is not None and (not isfinite(weight) or weight <= 0):
        raise ValueError("invalid_receipt_weight")
    # Do not accept client-controlled identity, dates, financial amounts or a
    # destination contradicting the selected route. The repository derives them.
    result = {key: value for key, value in payload.items() if key not in {
        "package_reference", "tracking_id", "qr_code_value", "barcode",
        "received_at", "dispatched_at", "delivered_at", "received_by",
        "destination_org_id", "destination_location_id", "origin_location_id",
        "origin_country", "origin_city", "destination_country", "destination_city",
        "service_type", "shipping_mode", "shipment_id", "shipment_reference",
        "warehouse_id", "warehouse_name", "fees_total", "fees_paid", "currency",
        "payment_status", "payment_clearance_status",
    }}
    result.update(status="RECEIVED_AT_ORIGIN", received_at=datetime.now(timezone.utc))
    tracking = str(result.get("supplier_tracking") or "").strip()
    result["supplier_tracking"] = tracking or None
    return result
