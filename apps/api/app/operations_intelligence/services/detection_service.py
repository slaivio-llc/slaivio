from sqlalchemy import text

from app.db.database import engine
from app.operations_intelligence.repositories.insight_repository import (
    create_insight,
    find_existing_open_insight,
)
from app.operations_intelligence.repositories.rule_repository import (
    get_rule_by_code,
)


def run_operations_detection(
    org_id: str,
):
    created = []
    skipped = []

    for detector in (
        detect_delayed_shipments,
        detect_stuck_warehouse_shipments,
        detect_delivery_pending,
        detect_payment_blocking_delivery,
        detect_low_wallet,
        detect_customs_blocked,
    ):
        result = detector(org_id)
        created.extend(result["created"])
        skipped.extend(result["skipped"])

    return {
        "status": "ok",
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": created,
        "skipped": skipped,
    }


def detect_delayed_shipments(
    org_id: str,
):
    rule = _rule(
        org_id,
        "SHIPMENT_DELAY_OVER_2_DAYS",
        threshold_value=2,
        severity="HIGH",
    )
    threshold_days = int(rule["threshold_value"] or 2)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    tracking_id,
                    current_status,
                    eta_at,
                    delay_status,
                    extract(
                        epoch from (now() - eta_at)
                    ) / 86400 as delay_days
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status, 'DRAFT')
                      not in ('DELIVERED', 'CANCELLED', 'LOST', 'RETURNED')
                  and (
                      delay_status = 'DELAYED'
                      or (
                          eta_at is not null
                          and eta_at < now() - (:threshold_days * interval '1 day')
                      )
                  )
                order by eta_at asc nulls last
                limit 50
            """),
            {
                "org_id": org_id,
                "threshold_days": threshold_days,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="SHIPMENT_DELAYED",
        severity=rule["severity"],
        entity_type="shipment",
        title_builder=lambda row: "Shipment delayed",
        message_builder=lambda row: (
            f"Shipment {row['tracking_id']} is delayed by "
            f"{int(row['delay_days'] or threshold_days)} day(s)."
        ),
        action="Contact carrier or update customer ETA.",
    )


def detect_stuck_warehouse_shipments(
    org_id: str,
):
    rule = _rule(
        org_id,
        "WAREHOUSE_STUCK_48H",
        threshold_value=48,
        severity="HIGH",
    )
    threshold_hours = int(rule["threshold_value"] or 48)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    tracking_id,
                    current_status,
                    received_at_origin_at,
                    extract(
                        epoch from (
                            now() - coalesce(received_at_origin_at, status_updated_at, updated_at)
                        )
                    ) / 3600 as stuck_hours
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status)
                      in ('RECEIVED_AT_ORIGIN', 'WAREHOUSE_PROCESSING')
                  and coalesce(received_at_origin_at, status_updated_at, updated_at)
                      < now() - (:threshold_hours * interval '1 hour')
                order by coalesce(received_at_origin_at, status_updated_at, updated_at)
                limit 50
            """),
            {
                "org_id": org_id,
                "threshold_hours": threshold_hours,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="WAREHOUSE_STUCK",
        severity=rule["severity"],
        entity_type="shipment",
        title_builder=lambda row: "Warehouse stuck shipment",
        message_builder=lambda row: (
            f"Shipment {row['tracking_id']} is stuck in warehouse for "
            f"{int(row['stuck_hours'] or threshold_hours)} hour(s)."
        ),
        action="Verify customs, batch assignment, or dispatch readiness.",
    )


def detect_delivery_pending(
    org_id: str,
):
    rule = _rule(
        org_id,
        "DELIVERY_PENDING_24H",
        threshold_value=24,
        severity="MEDIUM",
    )
    threshold_hours = int(rule["threshold_value"] or 24)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    tracking_id,
                    current_status,
                    pickup_ready_at,
                    extract(
                        epoch from (
                            now() - coalesce(pickup_ready_at, status_updated_at, updated_at)
                        )
                    ) / 3600 as pending_hours
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status)
                      in ('READY_PICKUP', 'READY_FOR_PICKUP')
                  and pickup_completed_at is null
                  and coalesce(pickup_ready_at, status_updated_at, updated_at)
                      < now() - (:threshold_hours * interval '1 hour')
                order by coalesce(pickup_ready_at, status_updated_at, updated_at)
                limit 50
            """),
            {
                "org_id": org_id,
                "threshold_hours": threshold_hours,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="DELIVERY_PENDING_TOO_LONG",
        severity=rule["severity"],
        entity_type="shipment",
        title_builder=lambda row: "Delivery pending too long",
        message_builder=lambda row: (
            f"Shipment {row['tracking_id']} has been ready for pickup for "
            f"{int(row['pending_hours'] or threshold_hours)} hour(s)."
        ),
        action="Contact customer and schedule delivery or pickup.",
    )


def detect_payment_blocking_delivery(
    org_id: str,
):
    rule = _rule(
        org_id,
        "PAYMENT_BLOCKING_DELIVERY",
        severity="CRITICAL",
    )

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    tracking_id,
                    current_status,
                    payment_status,
                    payment_clearance_status
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status)
                      in ('READY_PICKUP', 'READY_FOR_PICKUP')
                  and coalesce(payment_clearance_status, payment_status, 'UNKNOWN')
                      not in ('PAID', 'CLEARED')
                order by updated_at desc
                limit 50
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="PAYMENT_BLOCKING_DELIVERY",
        severity=rule["severity"],
        entity_type="shipment",
        title_builder=lambda row: "Payment blocking delivery",
        message_builder=lambda row: (
            f"Shipment {row['tracking_id']} is ready for pickup but payment is not cleared."
        ),
        action="Request payment confirmation before releasing cargo.",
    )


def detect_low_wallet(
    org_id: str,
):
    rule = _rule(
        org_id,
        "LOW_WALLET_UNDER_10_USD",
        threshold_value=1000,
        severity="HIGH",
    )
    threshold_minor = int(rule["threshold_value"] or 1000)

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    org_id,
                    balance_minor,
                    currency_code,
                    low_balance_threshold_minor
                from agency_wallets
                where org_id = :org_id
                  and balance_minor < coalesce(
                      low_balance_threshold_minor,
                      :threshold_minor
                  )
                limit 10
            """),
            {
                "org_id": org_id,
                "threshold_minor": threshold_minor,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="LOW_WALLET_BALANCE",
        severity=rule["severity"],
        entity_type="wallet",
        title_builder=lambda row: "Low wallet balance",
        message_builder=lambda row: (
            f"Wallet balance is {row['balance_minor']} minor units "
            f"({row['currency_code']})."
        ),
        action="Top up the agency wallet to avoid blocked automated operations.",
    )


def detect_customs_blocked(
    org_id: str,
):
    rule = _rule(
        org_id,
        "CUSTOMS_BLOCKED",
        severity="HIGH",
    )

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select
                    id,
                    tracking_id,
                    customs_status,
                    customs_risk_level,
                    compliance_hold,
                    delay_reason
                from shipments
                where org_id = :org_id
                  and (
                      compliance_hold = true
                      or customs_status in ('BLOCKED', 'HOLD', 'DOCUMENTS_REQUIRED')
                  )
                order by updated_at desc
                limit 50
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

    return _create_for_rows(
        org_id=org_id,
        rows=rows,
        insight_type="CUSTOMS_BLOCKED",
        severity=rule["severity"],
        entity_type="shipment",
        title_builder=lambda row: "Customs blocked shipment",
        message_builder=lambda row: (
            f"Shipment {row['tracking_id']} is blocked by customs or compliance."
        ),
        action="Review customs documents and resolve the compliance hold.",
    )


def _rule(
    org_id: str,
    rule_code: str,
    threshold_value: int | None = None,
    severity: str = "MEDIUM",
):
    return get_rule_by_code(org_id, rule_code) or {
        "rule_code": rule_code,
        "threshold_value": threshold_value,
        "severity": severity,
    }


def _create_for_rows(
    org_id: str,
    rows,
    insight_type: str,
    severity: str,
    entity_type: str,
    title_builder,
    message_builder,
    action: str,
):
    created = []
    skipped = []

    for row in rows:
        item = dict(row._mapping)
        entity_id = str(item["id"])
        existing = find_existing_open_insight(
            org_id=org_id,
            insight_type=insight_type,
            entity_type=entity_type,
            entity_id=entity_id,
        )

        if existing:
            skipped.append({
                "insight_type": insight_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "reason": "existing_open_insight",
            })
            continue

        insight = create_insight(
            org_id=org_id,
            insight_type=insight_type,
            severity=severity,
            entity_type=entity_type,
            entity_id=entity_id,
            title=title_builder(item),
            message=message_builder(item),
            recommended_action=action,
            metadata=item,
        )
        created.append(insight)

    return {
        "created": created,
        "skipped": skipped,
    }
