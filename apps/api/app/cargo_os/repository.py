from uuid import uuid4

from sqlalchemy import text

from app.db.database import engine


def _code(prefix: str):
    return f"{prefix}-{str(uuid4()).split('-')[0].upper()}"


def create_warehouse_receipt(
    org_id: str,
    payload: dict,
    actor: dict,
):
    receipt_code = _code("RCPT")
    with engine.connect() as conn:
        previous = conn.execute(
            text("""
                select current_status, status, dossier_id
                from shipments
                where org_id = :org_id
                  and id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
            },
        ).fetchone()

        previous_status = None
        dossier_id = None
        if previous:
            previous_dict = dict(previous._mapping)
            previous_status = previous_dict.get("current_status") or previous_dict.get("status")
            dossier_id = previous_dict.get("dossier_id")

        receipt = conn.execute(
            text("""
                insert into warehouse_receipts (
                    org_id,
                    shipment_id,
                    warehouse_id,
                    receipt_code,
                    received_by_id,
                    received_by_name,
                    supplier_name,
                    supplier_phone,
                    package_label,
                    package_condition,
                    measured_weight_kg,
                    measured_volume_cbm,
                    notes
                )
                values (
                    :org_id,
                    :shipment_id,
                    :warehouse_id,
                    :received_code,
                    :received_by_id,
                    :received_by_name,
                    :supplier_name,
                    :supplier_phone,
                    :package_label,
                    :package_condition,
                    :measured_weight_kg,
                    :measured_volume_cbm,
                    :notes
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "warehouse_id": payload["warehouse_id"],
                "received_code": receipt_code,
                "received_by_id": actor.get("id"),
                "received_by_name": actor.get("name"),
                "supplier_name": payload.get("supplier_name"),
                "supplier_phone": payload.get("supplier_phone"),
                "package_label": payload.get("package_label"),
                "package_condition": payload.get("package_condition") or "UNKNOWN",
                "measured_weight_kg": payload.get("measured_weight_kg"),
                "measured_volume_cbm": payload.get("measured_volume_cbm"),
                "notes": payload.get("notes"),
            },
        ).fetchone()

        shipment = conn.execute(
            text("""
                update shipments
                set
                    current_status = 'RECEIVED_AT_ORIGIN',
                    status = 'RECEIVED_AT_ORIGIN',
                    current_warehouse_id = :warehouse_id,
                    received_at_origin_at = now(),
                    actual_weight_kg = :measured_weight_kg,
                    actual_volume_cbm = :measured_volume_cbm,
                    package_condition = :package_condition,
                    status_updated_at = now(),
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "warehouse_id": payload["warehouse_id"],
                "measured_weight_kg": payload.get("measured_weight_kg"),
                "measured_volume_cbm": payload.get("measured_volume_cbm"),
                "package_condition": payload.get("package_condition") or "UNKNOWN",
            },
        ).fetchone()

        event = conn.execute(
            text("""
                insert into shipment_lifecycle_events (
                    org_id,
                    shipment_id,
                    dossier_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    metadata,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :shipment_id,
                    :dossier_id,
                    :previous_status,
                    'RECEIVED_AT_ORIGIN',
                    'WAREHOUSE_RECEIPT_CONFIRMED',
                    'WAREHOUSE',
                    'Package received at origin warehouse',
                    :metadata,
                    :actor_id,
                    :actor_name
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "dossier_id": dossier_id,
                "previous_status": previous_status,
                "metadata": {
                    "receipt_code": receipt_code,
                    "warehouse_id": payload["warehouse_id"],
                    "package_condition": payload.get("package_condition") or "UNKNOWN",
                },
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        ).fetchone()

        conn.commit()

        return {
            "receipt": dict(receipt._mapping) if receipt else None,
            "shipment": dict(shipment._mapping) if shipment else None,
            "event": dict(event._mapping) if event else None,
        }


def list_warehouse_receipts(org_id: str, warehouse_id: str | None = None):
    filters = ["org_id = :org_id"]
    params = {"org_id": org_id}

    if warehouse_id:
        filters.append("warehouse_id = :warehouse_id")
        params["warehouse_id"] = warehouse_id

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select *
                from warehouse_receipts
                where {' and '.join(filters)}
                order by received_at desc
                limit 100
            """),
            params,
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def create_receipt_media(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into warehouse_receipt_media (
                    org_id,
                    receipt_id,
                    shipment_id,
                    media_url,
                    media_type,
                    caption,
                    uploaded_by_id,
                    uploaded_by_name
                )
                values (
                    :org_id,
                    :receipt_id,
                    :shipment_id,
                    :media_url,
                    :media_type,
                    :caption,
                    :uploaded_by_id,
                    :uploaded_by_name
                )
                returning *
            """),
            {
                "org_id": org_id,
                "receipt_id": payload["receipt_id"],
                "shipment_id": payload["shipment_id"],
                "media_url": payload["media_url"],
                "media_type": payload.get("media_type") or "IMAGE",
                "caption": payload.get("caption"),
                "uploaded_by_id": actor.get("id"),
                "uploaded_by_name": actor.get("name"),
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def list_receipt_media(org_id: str, receipt_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from warehouse_receipt_media
                where org_id = :org_id
                  and receipt_id = :receipt_id
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "receipt_id": receipt_id,
            },
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def create_batch(org_id: str, payload: dict, actor: dict):
    batch_code = _code(payload["batch_type"])
    with engine.connect() as conn:
        batch = conn.execute(
            text("""
                insert into shipment_batches (
                    org_id,
                    batch_code,
                    batch_type,
                    route_origin_country,
                    route_origin_city,
                    route_destination_country,
                    route_destination_city,
                    origin_warehouse_id,
                    destination_warehouse_id,
                    carrier_name,
                    carrier_reference,
                    eta_at,
                    notes,
                    created_by_id,
                    created_by_name
                )
                values (
                    :org_id,
                    :batch_code,
                    :batch_type,
                    :route_origin_country,
                    :route_origin_city,
                    :route_destination_country,
                    :route_destination_city,
                    :origin_warehouse_id,
                    :destination_warehouse_id,
                    :carrier_name,
                    :carrier_reference,
                    :eta_at,
                    :notes,
                    :created_by_id,
                    :created_by_name
                )
                returning *
            """),
            {
                "org_id": org_id,
                "batch_code": batch_code,
                "batch_type": payload["batch_type"],
                "route_origin_country": payload.get("route_origin_country"),
                "route_origin_city": payload.get("route_origin_city"),
                "route_destination_country": payload.get("route_destination_country"),
                "route_destination_city": payload.get("route_destination_city"),
                "origin_warehouse_id": payload.get("origin_warehouse_id"),
                "destination_warehouse_id": payload.get("destination_warehouse_id"),
                "carrier_name": payload.get("carrier_name"),
                "carrier_reference": payload.get("carrier_reference"),
                "eta_at": payload.get("eta_at"),
                "notes": payload.get("notes"),
                "created_by_id": actor.get("id"),
                "created_by_name": actor.get("name"),
            },
        ).fetchone()
        batch_dict = dict(batch._mapping)
        conn.execute(
            text("""
                insert into shipment_batch_events (
                    org_id,
                    batch_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :batch_id,
                    null,
                    'DRAFT',
                    'BATCH_CREATED',
                    'MANAGER',
                    'Batch created',
                    :actor_id,
                    :actor_name
                )
            """),
            {
                "org_id": org_id,
                "batch_id": batch_dict["id"],
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        )
        conn.commit()
        return batch_dict


def list_batches(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_batches
                where org_id = :org_id
                order by created_at desc
                limit 100
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def add_batch_item(org_id: str, batch_id: str, shipment_id: str, actor: dict):
    with engine.connect() as conn:
        item = conn.execute(
            text("""
                insert into shipment_batch_items (
                    org_id,
                    batch_id,
                    shipment_id,
                    added_by_id,
                    added_by_name
                )
                values (
                    :org_id,
                    :batch_id,
                    :shipment_id,
                    :added_by_id,
                    :added_by_name
                )
                on conflict (batch_id, shipment_id) do nothing
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "shipment_id": shipment_id,
                "added_by_id": actor.get("id"),
                "added_by_name": actor.get("name"),
            },
        ).fetchone()
        conn.execute(
            text("""
                update shipments
                set
                    current_batch_id = :batch_id,
                    batch_status = 'ASSIGNED_TO_BATCH',
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "shipment_id": shipment_id,
            },
        )
        conn.execute(
            text("""
                insert into shipment_batch_events (
                    org_id,
                    batch_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    metadata,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :batch_id,
                    null,
                    'ITEM_ADDED',
                    'SHIPMENT_ADDED_TO_BATCH',
                    'MANAGER',
                    'Shipment added to batch',
                    :metadata,
                    :actor_id,
                    :actor_name
                )
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "metadata": {"shipment_id": shipment_id},
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        )
        conn.commit()
        return dict(item._mapping) if item else None


def list_batch_items(org_id: str, batch_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    i.*,
                    s.tracking_id,
                    s.current_status,
                    s.actual_weight_kg,
                    s.package_condition
                from shipment_batch_items i
                left join shipments s on s.id = i.shipment_id
                where i.org_id = :org_id
                  and i.batch_id = :batch_id
                order by i.added_at desc
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def update_batch_status(org_id: str, batch_id: str, status: str, actor: dict):
    shipment_status = None
    if status == "DISPATCHED":
        shipment_status = "IN_TRANSIT"
    if status == "ARRIVED":
        shipment_status = "ARRIVED_DESTINATION"

    with engine.connect() as conn:
        previous = conn.execute(
            text("""
                select *
                from shipment_batches
                where org_id = :org_id
                  and id = :batch_id
                limit 1
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchone()
        previous_status = dict(previous._mapping).get("status") if previous else None

        batch = conn.execute(
            text("""
                update shipment_batches
                set
                    status = :status,
                    updated_at = now(),
                    dispatched_at = case when :status = 'DISPATCHED' then now() else dispatched_at end,
                    arrived_at = case when :status = 'ARRIVED' then now() else arrived_at end
                where org_id = :org_id
                  and id = :batch_id
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "status": status,
            },
        ).fetchone()

        if shipment_status:
            conn.execute(
                text("""
                    update shipments
                    set
                        current_status = :shipment_status,
                        status = :shipment_status,
                        batch_status = :status,
                        status_updated_at = now(),
                        updated_at = now()
                    where org_id = :org_id
                      and current_batch_id = :batch_id
                """),
                {
                    "org_id": org_id,
                    "batch_id": batch_id,
                    "shipment_status": shipment_status,
                    "status": status,
                },
            )

        conn.execute(
            text("""
                insert into shipment_batch_events (
                    org_id,
                    batch_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :batch_id,
                    :previous_status,
                    :status,
                    'BATCH_STATUS_CHANGED',
                    'MANAGER',
                    :message,
                    :actor_id,
                    :actor_name
                )
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "previous_status": previous_status,
                "status": status,
                "message": f"Batch status changed to {status}",
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        )
        conn.commit()
        return dict(batch._mapping) if batch else None


def list_batch_events(org_id: str, batch_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_batch_events
                where org_id = :org_id
                  and batch_id = :batch_id
                order by created_at desc
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def create_manifest(org_id: str, batch_id: str, actor: dict):
    manifest_code = _code("MAN")
    with engine.connect() as conn:
        batch = conn.execute(
            text("""
                select *
                from shipment_batches
                where org_id = :org_id
                  and id = :batch_id
                limit 1
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchone()

        if not batch:
            return None

        shipments = conn.execute(
            text("""
                select
                    s.id,
                    s.tracking_id,
                    s.goods_type,
                    coalesce(s.actual_weight_kg, s.weight_kg) as weight_kg,
                    coalesce(s.actual_volume_cbm, s.volume_cbm) as volume_cbm
                from shipment_batch_items i
                join shipments s on s.id = i.shipment_id
                where i.org_id = :org_id
                  and i.batch_id = :batch_id
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
            },
        ).fetchall()

        shipment_rows = [dict(row._mapping) for row in shipments]
        total_weight = sum(float(row.get("weight_kg") or 0) for row in shipment_rows)
        total_volume = sum(float(row.get("volume_cbm") or 0) for row in shipment_rows)

        manifest = conn.execute(
            text("""
                insert into shipment_manifests (
                    org_id,
                    batch_id,
                    manifest_code,
                    manifest_type,
                    status,
                    total_shipments,
                    total_weight_kg,
                    total_volume_cbm,
                    generated_by_id,
                    generated_by_name,
                    raw_payload
                )
                values (
                    :org_id,
                    :batch_id,
                    :manifest_code,
                    'BATCH',
                    'GENERATED',
                    :total_shipments,
                    :total_weight_kg,
                    :total_volume_cbm,
                    :generated_by_id,
                    :generated_by_name,
                    :raw_payload
                )
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "manifest_code": manifest_code,
                "total_shipments": len(shipment_rows),
                "total_weight_kg": total_weight,
                "total_volume_cbm": total_volume,
                "generated_by_id": actor.get("id"),
                "generated_by_name": actor.get("name"),
                "raw_payload": {"shipments": shipment_rows},
            },
        ).fetchone()

        manifest_dict = dict(manifest._mapping)
        for item in shipment_rows:
            conn.execute(
                text("""
                    insert into shipment_manifest_items (
                        org_id,
                        manifest_id,
                        batch_id,
                        shipment_id,
                        tracking_id,
                        goods_type,
                        weight_kg,
                        volume_cbm
                    )
                    values (
                        :org_id,
                        :manifest_id,
                        :batch_id,
                        :shipment_id,
                        :tracking_id,
                        :goods_type,
                        :weight_kg,
                        :volume_cbm
                    )
                    on conflict (manifest_id, shipment_id) do nothing
                """),
                {
                    "org_id": org_id,
                    "manifest_id": manifest_dict["id"],
                    "batch_id": batch_id,
                    "shipment_id": item["id"],
                    "tracking_id": item.get("tracking_id"),
                    "goods_type": item.get("goods_type"),
                    "weight_kg": item.get("weight_kg"),
                    "volume_cbm": item.get("volume_cbm"),
                },
            )

        conn.execute(
            text("""
                update shipment_batches
                set
                    manifest_status = 'GENERATED',
                    last_manifest_id = :manifest_id,
                    updated_at = now()
                where org_id = :org_id
                  and id = :batch_id
            """),
            {
                "org_id": org_id,
                "batch_id": batch_id,
                "manifest_id": manifest_dict["id"],
            },
        )
        conn.commit()
        return manifest_dict


def list_manifests(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_manifests
                where org_id = :org_id
                order by created_at desc
                limit 100
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def get_manifest_items(org_id: str, manifest_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipment_manifest_items
                where org_id = :org_id
                  and manifest_id = :manifest_id
                order by created_at asc
            """),
            {
                "org_id": org_id,
                "manifest_id": manifest_id,
            },
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def create_batch_document(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into batch_documents (
                    org_id,
                    batch_id,
                    manifest_id,
                    document_type,
                    document_url,
                    document_status,
                    generated_by_id,
                    generated_by_name,
                    metadata
                )
                values (
                    :org_id,
                    :batch_id,
                    :manifest_id,
                    :document_type,
                    :document_url,
                    :document_status,
                    :generated_by_id,
                    :generated_by_name,
                    :metadata
                )
                returning *
            """),
            {
                "org_id": org_id,
                "batch_id": payload.get("batch_id"),
                "manifest_id": payload.get("manifest_id"),
                "document_type": payload["document_type"],
                "document_url": payload.get("document_url"),
                "document_status": payload.get("document_status") or "GENERATED",
                "generated_by_id": actor.get("id"),
                "generated_by_name": actor.get("name"),
                "metadata": payload.get("metadata") or {},
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def create_customs_case(org_id: str, payload: dict, actor: dict):
    case_code = _code("CUS")
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into customs_cases (
                    org_id,
                    shipment_id,
                    batch_id,
                    case_code,
                    customs_status,
                    risk_level,
                    country_code,
                    declared_value,
                    declared_currency,
                    goods_description,
                    blocked_reason,
                    opened_by_id,
                    opened_by_name,
                    raw_payload
                )
                values (
                    :org_id,
                    :shipment_id,
                    :batch_id,
                    :case_code,
                    :customs_status,
                    :risk_level,
                    :country_code,
                    :declared_value,
                    :declared_currency,
                    :goods_description,
                    :blocked_reason,
                    :opened_by_id,
                    :opened_by_name,
                    :raw_payload
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload.get("shipment_id"),
                "batch_id": payload.get("batch_id"),
                "case_code": case_code,
                "customs_status": payload.get("customs_status") or "OPEN",
                "risk_level": payload.get("risk_level") or "UNKNOWN",
                "country_code": payload.get("country_code"),
                "declared_value": payload.get("declared_value"),
                "declared_currency": payload.get("declared_currency"),
                "goods_description": payload.get("goods_description"),
                "blocked_reason": payload.get("blocked_reason"),
                "opened_by_id": actor.get("id"),
                "opened_by_name": actor.get("name"),
                "raw_payload": payload.get("raw_payload") or {},
            },
        ).fetchone()

        if payload.get("shipment_id"):
            conn.execute(
                text("""
                    update shipments
                    set
                        customs_status = :customs_status,
                        customs_risk_level = :risk_level,
                        compliance_hold = :compliance_hold,
                        updated_at = now()
                    where org_id = :org_id
                      and id = :shipment_id
                """),
                {
                    "org_id": org_id,
                    "shipment_id": payload.get("shipment_id"),
                    "customs_status": payload.get("customs_status") or "OPEN",
                    "risk_level": payload.get("risk_level") or "UNKNOWN",
                    "compliance_hold": bool(payload.get("compliance_hold", True)),
                },
            )

        conn.commit()
        return dict(row._mapping) if row else None


def list_customs_cases(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from customs_cases
                where org_id = :org_id
                order by created_at desc
                limit 100
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def resolve_customs_case(org_id: str, case_id: str, actor: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update customs_cases
                set
                    customs_status = 'RESOLVED',
                    resolved_by_id = :actor_id,
                    resolved_by_name = :actor_name,
                    resolved_at = now(),
                    updated_at = now()
                where org_id = :org_id
                  and id = :case_id
                returning *
            """),
            {
                "org_id": org_id,
                "case_id": case_id,
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        ).fetchone()

        if row:
            case = dict(row._mapping)
            if case.get("shipment_id"):
                conn.execute(
                    text("""
                        update shipments
                        set
                            customs_status = 'RESOLVED',
                            compliance_hold = false,
                            updated_at = now()
                        where org_id = :org_id
                          and id = :shipment_id
                    """),
                    {
                        "org_id": org_id,
                        "shipment_id": case["shipment_id"],
                    },
                )

        conn.commit()
        return dict(row._mapping) if row else None


def upsert_customs_rule(org_id: str, payload: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into customs_goods_rules (
                    org_id,
                    country_code,
                    goods_type,
                    risk_level,
                    requires_document,
                    forbidden,
                    rule_message,
                    active
                )
                values (
                    :org_id,
                    :country_code,
                    :goods_type,
                    :risk_level,
                    :requires_document,
                    :forbidden,
                    :rule_message,
                    :active
                )
                on conflict (org_id, country_code, goods_type)
                do update set
                    risk_level = excluded.risk_level,
                    requires_document = excluded.requires_document,
                    forbidden = excluded.forbidden,
                    rule_message = excluded.rule_message,
                    active = excluded.active
                returning *
            """),
            {
                "org_id": org_id,
                "country_code": payload.get("country_code"),
                "goods_type": payload["goods_type"],
                "risk_level": payload.get("risk_level") or "LOW",
                "requires_document": payload.get("requires_document") or False,
                "forbidden": payload.get("forbidden") or False,
                "rule_message": payload.get("rule_message"),
                "active": payload.get("active", True),
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def create_route(org_id: str, payload: dict):
    route_code = payload.get("route_code") or _code("ROUTE")
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into shipping_routes (
                    org_id,
                    route_code,
                    route_name,
                    origin_country,
                    origin_city,
                    destination_country,
                    destination_city,
                    transport_mode,
                    expected_duration_days,
                    active
                )
                values (
                    :org_id,
                    :route_code,
                    :route_name,
                    :origin_country,
                    :origin_city,
                    :destination_country,
                    :destination_city,
                    :transport_mode,
                    :expected_duration_days,
                    :active
                )
                returning *
            """),
            {
                "org_id": org_id,
                "route_code": route_code,
                "route_name": payload["route_name"],
                "origin_country": payload.get("origin_country"),
                "origin_city": payload.get("origin_city"),
                "destination_country": payload.get("destination_country"),
                "destination_city": payload.get("destination_city"),
                "transport_mode": payload.get("transport_mode") or "AIR",
                "expected_duration_days": payload.get("expected_duration_days"),
                "active": payload.get("active", True),
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def list_routes(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from shipping_routes
                where org_id = :org_id
                order by created_at desc
                limit 100
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def update_shipment_eta(org_id: str, shipment_id: str, payload: dict):
    with engine.connect() as conn:
        previous = conn.execute(
            text("""
                select eta_at
                from shipments
                where org_id = :org_id
                  and id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        ).fetchone()
        previous_eta = dict(previous._mapping).get("eta_at") if previous else None
        row = conn.execute(
            text("""
                update shipments
                set
                    route_id = :route_id,
                    eta_at = :eta_at,
                    estimated_arrival_at = :eta_at,
                    delay_status = :delay_status,
                    delay_reason = :delay_reason,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "route_id": payload.get("route_id"),
                "eta_at": payload["eta_at"],
                "delay_status": payload.get("delay_status") or "ON_TIME",
                "delay_reason": payload.get("delay_reason"),
            },
        ).fetchone()
        conn.execute(
            text("""
                insert into shipment_eta_tracking (
                    org_id,
                    shipment_id,
                    route_id,
                    previous_eta_at,
                    new_eta_at,
                    delay_status,
                    delay_reason,
                    event_source
                )
                values (
                    :org_id,
                    :shipment_id,
                    :route_id,
                    :previous_eta_at,
                    :new_eta_at,
                    :delay_status,
                    :delay_reason,
                    :event_source
                )
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "route_id": payload.get("route_id"),
                "previous_eta_at": previous_eta,
                "new_eta_at": payload["eta_at"],
                "delay_status": payload.get("delay_status") or "ON_TIME",
                "delay_reason": payload.get("delay_reason"),
                "event_source": payload.get("event_source") or "MANAGER",
            },
        )
        conn.commit()
        return dict(row._mapping) if row else None


def ensure_public_tracking_token(org_id: str, shipment_id: str):
    token = _code("TRK").replace("-", "")
    with engine.connect() as conn:
        current = conn.execute(
            text("""
                select public_tracking_token
                from shipments
                where org_id = :org_id
                  and id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
            },
        ).fetchone()
        current_token = dict(current._mapping).get("public_tracking_token") if current else None
        if current_token:
            return current_token

        row = conn.execute(
            text("""
                update shipments
                set
                    public_tracking_token = :token,
                    public_tracking_enabled = true,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
                returning public_tracking_token
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_id,
                "token": token,
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping)["public_tracking_token"] if row else None


def get_public_tracking(token: str, ip_address: str | None = None, user_agent: str | None = None):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    s.id,
                    s.org_id,
                    s.tracking_id,
                    s.current_status,
                    s.status,
                    s.origin_country,
                    s.origin_city,
                    s.destination_country,
                    s.destination_city,
                    s.goods_type,
                    s.eta_at,
                    s.delay_status,
                    s.delay_reason,
                    s.delivery_status,
                    s.public_tracking_enabled
                from shipments s
                where s.public_tracking_token = :token
                  and s.public_tracking_enabled = true
                limit 1
            """),
            {"token": token},
        ).fetchone()

        if not row:
            return None

        shipment = dict(row._mapping)
        conn.execute(
            text("""
                insert into shipment_public_access_logs (
                    org_id,
                    shipment_id,
                    tracking_token,
                    ip_address,
                    user_agent
                )
                values (
                    :org_id,
                    :shipment_id,
                    :tracking_token,
                    :ip_address,
                    :user_agent
                )
            """),
            {
                "org_id": shipment["org_id"],
                "shipment_id": shipment["id"],
                "tracking_token": token,
                "ip_address": ip_address,
                "user_agent": user_agent,
            },
        )
        events = conn.execute(
            text("""
                select
                    new_status,
                    event_type,
                    event_message,
                    created_at
                from shipment_lifecycle_events
                where org_id = :org_id
                  and shipment_id = :shipment_id
                order by created_at asc
            """),
            {
                "org_id": shipment["org_id"],
                "shipment_id": shipment["id"],
            },
        ).fetchall()
        conn.commit()
        shipment["events"] = [dict(event._mapping) for event in events]
        return shipment


def register_scan(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        shipment = conn.execute(
            text("""
                select id, dossier_id, current_status
                from shipments
                where org_id = :org_id
                  and (
                    id::text = :shipment_ref
                    or tracking_id = :shipment_ref
                    or barcode = :shipment_ref
                  )
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_ref": payload["shipment_ref"],
            },
        ).fetchone()
        if not shipment:
            return None
        shipment_dict = dict(shipment._mapping)
        barcode = payload.get("barcode") or payload["shipment_ref"]
        scan_type = payload["scan_type"]
        location_label = payload.get("location_label")
        row = conn.execute(
            text("""
                insert into shipment_scan_events (
                    org_id,
                    shipment_id,
                    barcode,
                    scan_type,
                    warehouse_id,
                    location_label,
                    scanned_by_id,
                    scanned_by_name,
                    metadata
                )
                values (
                    :org_id,
                    :shipment_id,
                    :barcode,
                    :scan_type,
                    :warehouse_id,
                    :location_label,
                    :scanned_by_id,
                    :scanned_by_name,
                    :metadata
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_dict["id"],
                "barcode": barcode,
                "scan_type": scan_type,
                "warehouse_id": payload.get("warehouse_id"),
                "location_label": location_label,
                "scanned_by_id": actor.get("id"),
                "scanned_by_name": actor.get("name"),
                "metadata": payload.get("metadata") or {},
            },
        ).fetchone()
        conn.execute(
            text("""
                update shipments
                set
                    barcode = coalesce(barcode, :barcode),
                    qr_code_value = coalesce(qr_code_value, :barcode),
                    current_warehouse_id = coalesce(:warehouse_id, current_warehouse_id),
                    last_scan_at = now(),
                    last_scan_location = :location_label,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "shipment_id": shipment_dict["id"],
                "barcode": barcode,
                "warehouse_id": payload.get("warehouse_id"),
                "location_label": location_label,
            },
        )
        conn.commit()
        return dict(row._mapping) if row else None


def store_inventory(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        inventory = conn.execute(
            text("""
                insert into shipment_inventory (
                    org_id,
                    shipment_id,
                    warehouse_id,
                    storage_location_id,
                    inventory_status
                )
                values (
                    :org_id,
                    :shipment_id,
                    :warehouse_id,
                    :storage_location_id,
                    'STORED'
                )
                on conflict (org_id, shipment_id)
                do update set
                    warehouse_id = excluded.warehouse_id,
                    storage_location_id = excluded.storage_location_id,
                    inventory_status = 'STORED',
                    removed_at = null,
                    updated_at = now()
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "warehouse_id": payload["warehouse_id"],
                "storage_location_id": payload["storage_location_id"],
            },
        ).fetchone()
        conn.execute(
            text("""
                insert into inventory_movements (
                    org_id,
                    shipment_id,
                    from_location_id,
                    to_location_id,
                    movement_type,
                    moved_by_id,
                    moved_by_name,
                    notes
                )
                values (
                    :org_id,
                    :shipment_id,
                    null,
                    :to_location_id,
                    'STORE',
                    :moved_by_id,
                    :moved_by_name,
                    :notes
                )
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "to_location_id": payload["storage_location_id"],
                "moved_by_id": actor.get("id"),
                "moved_by_name": actor.get("name"),
                "notes": payload.get("notes"),
            },
        )
        conn.execute(
            text("""
                update shipments
                set
                    current_warehouse_id = :warehouse_id,
                    storage_location_id = :storage_location_id,
                    inventory_status = 'STORED',
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "warehouse_id": payload["warehouse_id"],
                "storage_location_id": payload["storage_location_id"],
            },
        )
        conn.commit()
        return dict(inventory._mapping) if inventory else None


def list_inventory(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    inv.*,
                    s.tracking_id,
                    s.current_status,
                    loc.location_code,
                    loc.location_name
                from shipment_inventory inv
                left join shipments s on s.id = inv.shipment_id
                left join warehouse_storage_locations loc on loc.id = inv.storage_location_id
                where inv.org_id = :org_id
                order by inv.updated_at desc
                limit 200
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def create_delivery_job(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        job = conn.execute(
            text("""
                insert into shipment_delivery_jobs (
                    org_id,
                    shipment_id,
                    job_type,
                    status,
                    recipient_name,
                    recipient_phone,
                    pickup_location,
                    delivery_address,
                    scheduled_at,
                    assigned_manager_id,
                    assigned_manager_name,
                    notes
                )
                values (
                    :org_id,
                    :shipment_id,
                    :job_type,
                    'READY',
                    :recipient_name,
                    :recipient_phone,
                    :pickup_location,
                    :delivery_address,
                    :scheduled_at,
                    :assigned_manager_id,
                    :assigned_manager_name,
                    :notes
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "job_type": payload.get("job_type") or "PICKUP",
                "recipient_name": payload.get("recipient_name"),
                "recipient_phone": payload.get("recipient_phone"),
                "pickup_location": payload.get("pickup_location"),
                "delivery_address": payload.get("delivery_address"),
                "scheduled_at": payload.get("scheduled_at"),
                "assigned_manager_id": payload.get("assigned_manager_id") or actor.get("id"),
                "assigned_manager_name": payload.get("assigned_manager_name") or actor.get("name"),
                "notes": payload.get("notes"),
            },
        ).fetchone()
        conn.execute(
            text("""
                update shipments
                set
                    delivery_status = 'READY',
                    pickup_ready_at = now(),
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
            },
        )
        conn.commit()
        return dict(job._mapping) if job else None


def list_delivery_jobs(org_id: str):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    j.*,
                    s.tracking_id,
                    s.current_status,
                    s.payment_clearance_status,
                    s.final_release_status
                from shipment_delivery_jobs j
                left join shipments s on s.id = j.shipment_id
                where j.org_id = :org_id
                order by j.created_at desc
                limit 100
            """),
            {"org_id": org_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]


def create_delivery_proof(org_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into delivery_proofs (
                    org_id,
                    delivery_job_id,
                    shipment_id,
                    proof_type,
                    proof_url,
                    proof_text,
                    verified,
                    captured_by_id,
                    captured_by_name,
                    metadata,
                    verification_status
                )
                values (
                    :org_id,
                    :delivery_job_id,
                    :shipment_id,
                    :proof_type,
                    :proof_url,
                    :proof_text,
                    :verified,
                    :captured_by_id,
                    :captured_by_name,
                    :metadata,
                    :verification_status
                )
                returning *
            """),
            {
                "org_id": org_id,
                "delivery_job_id": payload["delivery_job_id"],
                "shipment_id": payload["shipment_id"],
                "proof_type": payload["proof_type"],
                "proof_url": payload.get("proof_url"),
                "proof_text": payload.get("proof_text"),
                "verified": payload.get("verified") or False,
                "captured_by_id": actor.get("id"),
                "captured_by_name": actor.get("name"),
                "metadata": payload.get("metadata") or {},
                "verification_status": payload.get("verification_status") or "PENDING",
            },
        ).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def create_payment_check(org_id: str, payload: dict, actor: dict):
    release_allowed = (payload.get("payment_status") == "PAID") or bool(
        payload.get("release_allowed")
    )
    with engine.connect() as conn:
        check = conn.execute(
            text("""
                insert into delivery_payment_checks (
                    org_id,
                    shipment_id,
                    delivery_job_id,
                    required_amount,
                    paid_amount,
                    currency,
                    payment_status,
                    release_allowed,
                    checked_by_id,
                    checked_by_name,
                    raw_payload
                )
                values (
                    :org_id,
                    :shipment_id,
                    :delivery_job_id,
                    :required_amount,
                    :paid_amount,
                    :currency,
                    :payment_status,
                    :release_allowed,
                    :checked_by_id,
                    :checked_by_name,
                    :raw_payload
                )
                returning *
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "delivery_job_id": payload.get("delivery_job_id"),
                "required_amount": payload.get("required_amount"),
                "paid_amount": payload.get("paid_amount"),
                "currency": payload.get("currency"),
                "payment_status": payload.get("payment_status") or "UNKNOWN",
                "release_allowed": release_allowed,
                "checked_by_id": actor.get("id"),
                "checked_by_name": actor.get("name"),
                "raw_payload": payload.get("raw_payload") or {},
            },
        ).fetchone()
        conn.execute(
            text("""
                update shipments
                set
                    payment_clearance_status = :payment_status,
                    final_release_status = case
                        when :release_allowed = true then 'ALLOWED'
                        else 'BLOCKED'
                    end,
                    delivery_blocked_reason = case
                        when :release_allowed = true then null
                        else 'PAYMENT_NOT_CLEARED'
                    end,
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "shipment_id": payload["shipment_id"],
                "payment_status": payload.get("payment_status") or "UNKNOWN",
                "release_allowed": release_allowed,
            },
        )
        conn.commit()
        return dict(check._mapping) if check else None


def complete_delivery_job(org_id: str, job_id: str, payload: dict, actor: dict):
    with engine.connect() as conn:
        job = conn.execute(
            text("""
                select *
                from shipment_delivery_jobs
                where org_id = :org_id
                  and id = :job_id
                limit 1
            """),
            {
                "org_id": org_id,
                "job_id": job_id,
            },
        ).fetchone()
        if not job:
            return None
        job_dict = dict(job._mapping)

        shipment = conn.execute(
            text("""
                select final_release_status, dossier_id, current_status
                from shipments
                where org_id = :org_id
                  and id = :shipment_id
                limit 1
            """),
            {
                "org_id": org_id,
                "shipment_id": job_dict["shipment_id"],
            },
        ).fetchone()
        shipment_dict = dict(shipment._mapping) if shipment else {}

        if shipment_dict.get("final_release_status") == "BLOCKED":
            return {
                "blocked": True,
                "reason": "delivery_payment_gate_blocked",
                "job": job_dict,
            }

        updated_job = conn.execute(
            text("""
                update shipment_delivery_jobs
                set
                    status = 'COMPLETED',
                    completed_at = now(),
                    recipient_name = coalesce(:recipient_name, recipient_name),
                    recipient_phone = coalesce(:recipient_phone, recipient_phone),
                    updated_at = now()
                where org_id = :org_id
                  and id = :job_id
                returning *
            """),
            {
                "org_id": org_id,
                "job_id": job_id,
                "recipient_name": payload.get("recipient_name"),
                "recipient_phone": payload.get("recipient_phone"),
            },
        ).fetchone()
        conn.execute(
            text("""
                update shipments
                set
                    current_status = 'DELIVERED',
                    status = 'DELIVERED',
                    delivery_status = 'COMPLETED',
                    pickup_completed_at = now(),
                    delivered_at = now(),
                    delivered_to_name = coalesce(:recipient_name, delivered_to_name),
                    delivered_to_phone = coalesce(:recipient_phone, delivered_to_phone),
                    status_updated_at = now(),
                    updated_at = now()
                where org_id = :org_id
                  and id = :shipment_id
            """),
            {
                "org_id": org_id,
                "shipment_id": job_dict["shipment_id"],
                "recipient_name": payload.get("recipient_name"),
                "recipient_phone": payload.get("recipient_phone"),
            },
        )
        conn.execute(
            text("""
                insert into shipment_lifecycle_events (
                    org_id,
                    shipment_id,
                    dossier_id,
                    previous_status,
                    new_status,
                    event_type,
                    event_source,
                    event_message,
                    metadata,
                    actor_id,
                    actor_name
                )
                values (
                    :org_id,
                    :shipment_id,
                    :dossier_id,
                    :previous_status,
                    'DELIVERED',
                    'DELIVERY_COMPLETED',
                    'MANAGER',
                    'Shipment delivered to customer',
                    :metadata,
                    :actor_id,
                    :actor_name
                )
            """),
            {
                "org_id": org_id,
                "shipment_id": job_dict["shipment_id"],
                "dossier_id": shipment_dict.get("dossier_id"),
                "previous_status": shipment_dict.get("current_status"),
                "metadata": {"delivery_job_id": job_id},
                "actor_id": actor.get("id"),
                "actor_name": actor.get("name"),
            },
        )
        conn.commit()
        return dict(updated_job._mapping) if updated_job else None

