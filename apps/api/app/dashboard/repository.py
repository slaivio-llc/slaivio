from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text

from app.db.database import engine


ACTIVE_SHIPMENT_STATUSES = {
    "CREATED",
    "RECEIVED_AT_ORIGIN",
    "SCHEDULED_FOR_DEPARTURE",
    "READY_FOR_DEPARTURE",
    "DEPARTED",
    "IN_TRANSIT",
    "ARRIVED_HUB",
    "IN_LOCAL_TRANSIT",
    "ARRIVED_DESTINATION",
    "READY_FOR_PICKUP",
    "BLOCKED",
    "ISSUE",
}

IN_TRANSIT_STATUSES = {
    "DEPARTED",
    "IN_TRANSIT",
    "ARRIVED_HUB",
    "IN_LOCAL_TRANSIT",
}

ACTIVE_STATUS_SQL = ", ".join(f"'{status}'" for status in sorted(ACTIVE_SHIPMENT_STATUSES))
IN_TRANSIT_STATUS_SQL = ", ".join(f"'{status}'" for status in sorted(IN_TRANSIT_STATUSES))


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _empty_overview(org_id: str | None, organization_name: str | None, manager: dict):
    manager_name = (
        manager.get("full_name")
        or manager.get("name")
        or manager.get("email")
        or "Admin"
    )

    return {
        "status": "ok",
        "workspace": {
            "org_id": org_id,
            "name": organization_name or "Workspace",
            "country": "RDC",
        },
        "manager": {
            "name": manager_name,
            "initials": _initials(manager_name),
        },
        "stats": {
            "active_clients": {"value": 0, "delta": 0},
            "transit_packages": {"value": 0, "delta": 0},
            "active_shipments": {"value": 0, "delta": 0},
            "monthly_revenue": {"value": 0, "currency": "USD", "delta": 0},
        },
        "shipment_trends": [],
        "status_breakdown": [],
        "recent_shipments": [],
        "whatsapp_preview": {
            "unread_count": 0,
            "conversations": [],
        },
        "notifications": [],
        "empty": True,
    }


def _initials(name: str) -> str:
    parts = [part for part in name.replace("@", " ").split() if part]
    if not parts:
        return "AD"
    return "".join(part[0].upper() for part in parts[:2])


def _safe_count(conn, sql: str, params: dict) -> int:
    try:
        return int(conn.execute(text(sql), params).scalar() or 0)
    except Exception:
        return 0


def _safe_rows(conn, sql: str, params: dict) -> list[dict]:
    try:
        rows = conn.execute(text(sql), params).fetchall()
        return [_json_safe(dict(row._mapping)) for row in rows]
    except Exception:
        return []


def get_dashboard_overview(
    org_id: str | None,
    organization_name: str | None,
    manager: dict,
) -> dict:
    overview = _empty_overview(org_id, organization_name, manager)

    if not org_id:
        return overview

    with engine.connect() as conn:
        active_clients = _safe_count(
            conn,
            """
                select count(*)
                from clients
                where org_id = :org_id
                  and coalesce(status, 'ACTIVE') not in ('INACTIVE', 'ARCHIVED')
            """,
            {"org_id": org_id},
        )

        transit_packages = _safe_count(
            conn,
            f"""
                select count(*)
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status) in ({IN_TRANSIT_STATUS_SQL})
            """,
            {"org_id": org_id},
        )

        active_shipments = _safe_count(
            conn,
            f"""
                select count(*)
                from shipments
                where org_id = :org_id
                  and coalesce(current_status, status) in ({ACTIVE_STATUS_SQL})
            """,
            {"org_id": org_id},
        )

        monthly_revenue = _safe_count(
            conn,
            """
                select coalesce(sum(amount_minor), 0) / 100
                from payment_requests
                where org_id = :org_id
                  and status in ('SUCCEEDED', 'PAID', 'RECEIVED')
                  and coalesce(paid_at, updated_at, created_at) >= date_trunc('month', now())
            """,
            {"org_id": org_id},
        )

        trends = _safe_rows(
            conn,
            """
                with days as (
                    select generate_series(
                        current_date - interval '6 days',
                        current_date,
                        interval '1 day'
                    )::date as day
                )
                select
                    to_char(days.day, 'DD Mon') as label,
                    coalesce(count(s.id), 0)::int as shipments,
                    coalesce(count(s.id) filter (
                        where coalesce(s.current_status, s.status) = 'DELIVERED'
                    ), 0)::int as deliveries
                from days
                left join shipments s
                    on s.org_id = :org_id
                   and s.created_at::date = days.day
                group by days.day
                order by days.day
            """,
            {"org_id": org_id},
        )

        breakdown = _safe_rows(
            conn,
            """
                select
                    coalesce(current_status, status, 'UNKNOWN') as status,
                    count(*)::int as value
                from shipments
                where org_id = :org_id
                group by coalesce(current_status, status, 'UNKNOWN')
                order by value desc
                limit 6
            """,
            {"org_id": org_id},
        )

        recent_shipments = _safe_rows(
            conn,
            """
                select
                    coalesce(s.tracking_id, concat('EXP-', left(s.id::text, 8))) as reference,
                    coalesce(c.name, c.phone, 'Client') as client_name,
                    concat_ws(', ', s.origin_city, s.origin_country) as origin,
                    concat_ws(', ', s.destination_city, s.destination_country) as destination,
                    coalesce(s.current_status, s.status, 'CREATED') as status,
                    coalesce(s.updated_at, s.created_at) as updated_at
                from shipments s
                left join clients c on c.id = s.client_id
                where s.org_id = :org_id
                order by coalesce(s.updated_at, s.created_at) desc
                limit 5
            """,
            {"org_id": org_id},
        )

        conversations = _safe_rows(
            conn,
            """
                select
                    coalesce(c.name, m.sender_phone, 'Client') as name,
                    coalesce(m.message_text, '') as preview,
                    m.sender_phone as phone,
                    m.created_at
                from messages_raw m
                left join clients c on c.id = m.client_id
                where m.org_id = :org_id
                order by m.created_at desc
                limit 3
            """,
            {"org_id": org_id},
        )

        notifications = _safe_rows(
            conn,
            """
                select
                    notification_type as title,
                    message,
                    status,
                    created_at
                from notification_outbox
                where org_id = :org_id
                order by created_at desc
                limit 3
            """,
            {"org_id": org_id},
        )

    overview["stats"] = {
        "active_clients": {"value": active_clients, "delta": 0},
        "transit_packages": {"value": transit_packages, "delta": 0},
        "active_shipments": {"value": active_shipments, "delta": 0},
        "monthly_revenue": {
            "value": monthly_revenue,
            "currency": "USD",
            "delta": 0,
        },
    }
    overview["shipment_trends"] = trends
    overview["status_breakdown"] = breakdown
    overview["recent_shipments"] = recent_shipments
    overview["whatsapp_preview"] = {
        "unread_count": len(conversations),
        "conversations": conversations,
    }
    overview["notifications"] = notifications
    overview["empty"] = not any(
        [
            active_clients,
            transit_packages,
            active_shipments,
            monthly_revenue,
            trends,
            breakdown,
            recent_shipments,
            conversations,
            notifications,
        ]
    )

    return overview
