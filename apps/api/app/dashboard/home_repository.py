from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text

from app.db.database import engine


RESOURCE_CATALOG = (
    {"key": "clients", "name": "Clients", "description": "Répertoire clients", "href": "/app/clients", "tone": "emerald"},
    {"key": "dossiers", "name": "Dossiers", "description": "Dossiers logistiques", "href": "/app/dossiers", "tone": "blue"},
    {"key": "shipments", "name": "Expéditions", "description": "Suivi des expéditions", "href": "/app/shipments", "tone": "violet"},
    {"key": "packages", "name": "Colis", "description": "Gestion des colis", "href": "/app/packages", "tone": "amber"},
    {"key": "inbox", "name": "WhatsApp Inbox", "description": "Conversations clients", "href": "/app/inbox", "tone": "green"},
    {"key": "reports", "name": "Rapports", "description": "Pilotage de l’activité", "href": "/app/reports", "tone": "slate"},
)


def _safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_safe(item) for item in value]
    return value


def _rows(conn, statement: str, params: dict) -> list[dict]:
    try:
        result = conn.execute(text(statement), params).fetchall()
        return [_safe(dict(row._mapping)) for row in result]
    except Exception:
        return []


def get_home(org_id: str | None, user_id: str, organization_name: str | None, manager: dict) -> dict:
    manager_name = manager.get("full_name") or manager.get("name") or manager.get("email") or "Manager Slaivio"
    resources = [dict(resource, is_starred=False, last_opened_at=None) for resource in RESOURCE_CATALOG]
    notifications: list[dict] = []

    if org_id:
        with engine.connect() as conn:
            preferences = _rows(
                conn,
                """
                select resource_key, is_starred, last_opened_at
                from dashboard_home_preferences
                where org_id = :org_id and user_id = :user_id
                """,
                {"org_id": org_id, "user_id": user_id},
            )
            by_key = {item["resource_key"]: item for item in preferences}
            resources = [dict(item, **by_key.get(item["key"], {})) for item in RESOURCE_CATALOG]
            notifications = _rows(
                conn,
                """
                select id::text, title, message, event_type, priority, is_read, created_at
                from manager_events
                where org_id = :org_id
                order by created_at desc
                limit 40
                """,
                {"org_id": org_id},
            )

    return {
        "status": "ok",
        "workspace": {"org_id": org_id, "name": organization_name or "Mon espace Slaivio"},
        "manager": {"name": manager_name, "email": manager.get("email") or "", "initials": _initials(manager_name)},
        "resources": resources,
        "notifications": notifications,
        "unread_count": sum(1 for item in notifications if not item.get("is_read")),
    }


def update_resource_preference(org_id: str, user_id: str, resource_key: str, *, is_starred: bool | None, opened: bool) -> dict | None:
    if resource_key not in {item["key"] for item in RESOURCE_CATALOG}:
        return None
    with engine.begin() as conn:
        row = conn.execute(
            text("""
                insert into dashboard_home_preferences (org_id, user_id, resource_key, is_starred, last_opened_at)
                values (:org_id, :user_id, :resource_key, coalesce(:is_starred, false), case when :opened then now() end)
                on conflict (org_id, user_id, resource_key) do update set
                    is_starred = coalesce(:is_starred, dashboard_home_preferences.is_starred),
                    last_opened_at = case when :opened then now() else dashboard_home_preferences.last_opened_at end,
                    updated_at = now()
                returning resource_key, is_starred, last_opened_at
            """),
            {"org_id": org_id, "user_id": user_id, "resource_key": resource_key, "is_starred": is_starred, "opened": opened},
        ).fetchone()
    return _safe(dict(row._mapping)) if row else None


def search_home(org_id: str, query: str, limit: int = 12) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []
    with engine.connect() as conn:
        return _rows(
            conn,
            """
            select * from (
                select 'client' as kind, c.id::text as id, coalesce(c.name, c.phone, 'Client') as title,
                       coalesce(c.phone, '') as subtitle, '/app/clients' as href, c.created_at
                from clients c where c.org_id = :org_id and (coalesce(c.name, '') ilike :query or coalesce(c.phone, '') ilike :query)
                union all
                select 'shipment', s.id::text, coalesce(s.tracking_id, 'Expédition'),
                       concat_ws(' → ', s.origin_city, s.destination_city), '/app/shipments', s.created_at
                from shipments s where s.org_id = :org_id and coalesce(s.tracking_id, '') ilike :query
                union all
                select 'dossier', d.id::text, coalesce(d.tracking_id, d.id::text),
                       coalesce(d.status_global, ''), '/app/dossiers', d.created_at
                from dossiers d where d.org_id = :org_id and coalesce(d.tracking_id, '') ilike :query
            ) results order by created_at desc limit :limit
            """,
            {"org_id": org_id, "query": f"%{query}%", "limit": limit},
        )


def _initials(name: str) -> str:
    parts = [part for part in name.replace("@", " ").split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "SL"
