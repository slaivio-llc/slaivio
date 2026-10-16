"""Narrow commands for the parcel register. All mutations lock and audit the parcel."""
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.packages.repository import _insert_package_event, _queue_customer_status_notification


def locked_parcel(conn, org_id, package_id):
    row = conn.execute(text("""select * from cargo_packages
        where (org_id=:org_id or destination_org_id=:org_id)
        and id=cast(:package_id as uuid) and deleted_at is null for update"""),
        {"org_id": org_id, "package_id": package_id}).mappings().first()
    if not row:
        raise HTTPException(404, "package_not_found")
    return dict(row)


def check_version(row, expected):
    if row["row_version"] != expected:
        raise HTTPException(409, "package_version_conflict")


def edit_parcel(org_id, package_id, actor, expected_version, reason, changes):
    allowed = {"description", "weight_kg", "warehouse_location", "supplier_tracking"}
    if set(changes) - allowed:
        raise HTTPException(422, "parcel_field_not_editable")
    with engine.begin() as conn:
        row = locked_parcel(conn, org_id, package_id)
        check_version(row, expected_version)
        if row["status"] in {"DELIVERED", "CANCELLED", "RETURNED"}:
            raise HTTPException(409, "parcel_edit_closed")
        if row["org_id"] != org_id and set(changes) - {"warehouse_location"}:
            raise HTTPException(403, "destination_office_storage_only")
        changed = {key: value for key, value in changes.items() if value != row.get(key)}
        if changed.get("weight_kg") is not None and row.get("weight_kg") is not None and Decimal(str(changed["weight_kg"])) == Decimal(str(row["weight_kg"])):
            del changed["weight_kg"]
        if "weight_kg" in changed:
            weight = changed["weight_kg"]
            if weight is not None and (not Decimal(str(weight)).is_finite() or weight <= 0):
                raise HTTPException(422, "invalid_receipt_weight")
            if row.get("shipment_id") or row.get("fees_total") is not None or row.get("pricing_snapshot") or row.get("payment_status") not in {None, "UNKNOWN"}:
                raise HTTPException(409, "parcel_weight_requires_review")
            assigned = conn.execute(text("""select 1 from expedition_packages where org_id=:org_id
                and package_id=cast(:id as uuid) and removed_at is null limit 1"""),
                {'org_id': row['org_id'], 'id': package_id}).first()
            if assigned:
                raise HTTPException(409, "parcel_weight_requires_review")
        if not changed:
            return {"changed": False}
        if changed.get("supplier_tracking"):
            conn.execute(text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": f"package-label:{row['org_id']}:{changed['supplier_tracking'].lower()}"})
            duplicate = conn.execute(text("""select 1 from cargo_packages where org_id=:owner
                and id<>cast(:id as uuid) and deleted_at is null
                and (lower(supplier_tracking)=lower(:reference) or lower(tracking_id)=lower(:reference))"""),
                {"owner": row["org_id"], "id": package_id, "reference": changed["supplier_tracking"]}).first()
            if duplicate:
                raise HTTPException(409, "supplier_tracking_already_exists")
        assignments = ",".join(f"{key}=:{key}" for key in changed)
        conn.execute(text(f"""update cargo_packages set {assignments},row_version=row_version+1,
            updated_by=:actor,updated_at=now() where id=cast(:id as uuid) and org_id=:owner"""),
            {**changed, "actor": actor, "id": package_id, "owner": row["org_id"]})
        _insert_package_event(conn, org_id=row["org_id"], package_id=package_id,
            event_type="PARCEL_INFORMATION_CORRECTED", title="Informations du colis corrigées", description=reason,
            actor_id=actor, metadata={"acting_org_id": org_id, "before": {key: str(row.get(key)) if row.get(key) is not None else None for key in changed},
                                     "after": {key: str(value) if value is not None else None for key, value in changed.items()}})
        return {"changed": True}


def mark_ready(org_id, package_id, actor, expected_version):
    with engine.begin() as conn:
        row = locked_parcel(conn, org_id, package_id)
        if row["status"] == "READY_FOR_PICKUP":
            return {"changed": False, "org_id": row["org_id"]}
        check_version(row, expected_version)
        if row["status"] not in {"ARRIVED", "ARRIVED_DESTINATION", "CLEARED"}:
            raise HTTPException(409, "parcel_not_arrived")
        conn.execute(text("""update cargo_packages set status='READY_FOR_PICKUP',
            row_version=row_version+1,updated_by=:actor,updated_at=now()
            where id=cast(:id as uuid) and org_id=:owner"""), {"actor": actor, "id": package_id, "owner": row["org_id"]})
        _insert_package_event(conn, org_id=row["org_id"], package_id=package_id, event_type="PARCEL_READY_FOR_PICKUP",
            title="Colis disponible pour retrait", previous_status=row["status"], new_status="READY_FOR_PICKUP",
            actor_id=actor, metadata={"acting_org_id": org_id})
        notification = _queue_customer_status_notification(conn, row, "READY_FOR_PICKUP", actor)
        return {"changed": True, "org_id": row["org_id"], "queued_notification_id": notification}
