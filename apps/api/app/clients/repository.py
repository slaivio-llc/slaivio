from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from math import ceil
from typing import Any

from sqlalchemy import text

from app.db.database import engine


CLIENT_STATUSES = {"lead", "active", "pending", "inactive", "blocked"}
CLIENT_TYPES = {"individual", "business", "agent", "partner"}
CLIENT_SOURCES = {"manual", "whatsapp", "website", "referral", "import", "api"}


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


def _one(row) -> dict | None:
    return _safe(dict(row._mapping)) if row else None


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().replace(" ", "").replace("-", "")
    return normalized or None


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _build_filters(
    org_id: str,
    q: str | None,
    status: str | None,
    customer_type: str | None,
    source: str | None,
    country: str | None,
    city: str | None,
) -> tuple[str, dict]:
    filters = ["org_id = :org_id", "deleted_at is null"]
    params: dict[str, Any] = {"org_id": org_id}

    if q:
        filters.append(
            """(
                coalesce(name, '') ilike :q
                or coalesce(display_name, '') ilike :q
                or coalesce(company_name, '') ilike :q
                or coalesce(phone, '') ilike :q
                or coalesce(whatsapp_phone, '') ilike :q
                or coalesce(email, '') ilike :q
            )"""
        )
        params["q"] = f"%{q.strip()}%"
    if status:
        filters.append("lifecycle_status = :status")
        params["status"] = status
    if customer_type:
        filters.append("customer_type = :customer_type")
        params["customer_type"] = customer_type
    if source:
        filters.append("source = :source")
        params["source"] = source
    if country:
        filters.append("country ilike :country")
        params["country"] = country.strip()
    if city:
        filters.append("city ilike :city")
        params["city"] = city.strip()

    return " and ".join(filters), params


def list_clients(
    org_id: str,
    *,
    q: str | None = None,
    status: str | None = None,
    customer_type: str | None = None,
    source: str | None = None,
    country: str | None = None,
    city: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "created_desc",
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size
    where_clause, params = _build_filters(org_id, q, status, customer_type, source, country, city)
    order_by = {
        "created_asc": "created_at asc",
        "name_asc": "coalesce(display_name, name, phone, email) asc nulls last",
        "name_desc": "coalesce(display_name, name, phone, email) desc nulls last",
        "activity_desc": "last_activity_at desc nulls last, updated_at desc",
        "activity_asc": "last_activity_at asc nulls last, updated_at asc",
    }.get(sort, "created_at desc")

    with engine.connect() as conn:
        total = conn.execute(
            text(f"select count(*)::int total from clients where {where_clause}"),
            params,
        ).scalar() or 0
        rows = conn.execute(
            text(f"""
                select
                    c.id::text,
                    c.org_id,
                    coalesce(c.display_name, c.name, c.company_name, c.phone, c.email) display_name,
                    c.name,
                    c.company_name,
                    c.phone,
                    c.whatsapp_phone,
                    c.email,
                    c.country,
                    c.city,
                    c.customer_type,
                    c.lifecycle_status,
                    c.source,
                    c.preferred_language,
                    c.preferred_currency,
                    c.credit_enabled,
                    c.credit_limit,
                    c.current_balance,
                    c.total_spent,
                    c.last_activity_at,
                    c.created_at,
                    c.updated_at,
                    coalesce(d.dossiers_count, 0)::int dossiers_count,
                    coalesce(s.shipments_count, 0)::int shipments_count
                from clients c
                left join (
                    select client_id, count(*) dossiers_count
                    from dossiers
                    where org_id = :org_id
                    group by client_id
                ) d on d.client_id = c.id
                left join (
                    select client_id, count(*) shipments_count
                    from shipments
                    where org_id = :org_id
                    group by client_id
                ) s on s.client_id = c.id
                where {where_clause}
                order by {order_by}
                limit :limit offset :offset
            """),
            dict(params, limit=page_size, offset=offset),
        ).fetchall()

    return {
        "items": [_safe(dict(row._mapping)) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": ceil(total / page_size) if total else 0,
        },
    }


def get_client(org_id: str, client_id: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    c.id::text,
                    c.org_id,
                    coalesce(c.display_name, c.name, c.company_name, c.phone, c.email) display_name,
                    c.name,
                    c.company_name,
                    c.tax_id,
                    c.phone,
                    c.whatsapp_phone,
                    c.email,
                    c.country,
                    c.city,
                    c.address,
                    c.customer_type,
                    c.lifecycle_status,
                    c.source,
                    c.preferred_language,
                    c.preferred_currency,
                    c.notes,
                    c.tags,
                    c.credit_enabled,
                    c.credit_limit,
                    c.current_balance,
                    c.total_spent,
                    c.last_activity_at,
                    c.created_at,
                    c.updated_at,
                    coalesce(d.dossiers_count, 0)::int dossiers_count,
                    coalesce(s.shipments_count, 0)::int shipments_count
                from clients c
                left join (
                    select client_id, count(*) dossiers_count
                    from dossiers
                    where org_id = :org_id
                    group by client_id
                ) d on d.client_id = c.id
                left join (
                    select client_id, count(*) shipments_count
                    from shipments
                    where org_id = :org_id
                    group by client_id
                ) s on s.client_id = c.id
                where c.org_id = :org_id
                  and c.id = :client_id
                  and c.deleted_at is null
                limit 1
            """),
            {"org_id": org_id, "client_id": client_id},
        ).fetchone()
    return _one(row)


def _find_duplicate(org_id: str, phone: str | None, email: str | None, exclude_id: str | None = None) -> dict | None:
    clauses = ["org_id = :org_id", "deleted_at is null"]
    params: dict[str, Any] = {"org_id": org_id}
    identity_filters = []
    if phone:
        identity_filters.append("phone = :phone or whatsapp_phone = :phone")
        params["phone"] = phone
    if email:
        identity_filters.append("email = :email")
        params["email"] = email
    if not identity_filters:
        return None
    clauses.append("(" + " or ".join(f"({item})" for item in identity_filters) + ")")
    if exclude_id:
        clauses.append("id <> :exclude_id")
        params["exclude_id"] = exclude_id

    with engine.connect() as conn:
        row = conn.execute(
            text(f"""
                select id::text, coalesce(display_name, name, phone, email) display_name, phone, email
                from clients
                where {" and ".join(clauses)}
                order by created_at desc
                limit 1
            """),
            params,
        ).fetchone()
    return _one(row)


def create_client(org_id: str, user_id: str, payload: dict) -> dict:
    phone = normalize_phone(payload.get("phone"))
    whatsapp_phone = normalize_phone(payload.get("whatsapp_phone")) or phone
    email = normalize_email(payload.get("email"))
    name = (payload.get("name") or "").strip() or None
    company_name = (payload.get("company_name") or "").strip() or None
    display_name = (payload.get("display_name") or name or company_name or phone or email or "").strip()

    duplicate = _find_duplicate(org_id, phone or whatsapp_phone, email)
    if duplicate:
        raise ValueError("duplicate_client")

    with engine.begin() as conn:
        row = conn.execute(
            text("""
                insert into clients (
                    org_id, name, display_name, company_name, tax_id, phone, whatsapp_phone,
                    email, country, city, address, customer_type, lifecycle_status,
                    source, preferred_language, preferred_currency, notes, credit_enabled,
                    credit_limit, current_balance, total_spent, last_activity_at,
                    created_by, updated_by
                )
                values (
                    :org_id, :name, :display_name, :company_name, :tax_id, :phone, :whatsapp_phone,
                    :email, :country, :city, :address, :customer_type, :lifecycle_status,
                    :source, :preferred_language, :preferred_currency, :notes, :credit_enabled,
                    :credit_limit, :current_balance, :total_spent, now(),
                    :user_id, :user_id
                )
                returning id::text
            """),
            {
                "org_id": org_id,
                "user_id": user_id,
                "name": name,
                "display_name": display_name,
                "company_name": company_name,
                "tax_id": payload.get("tax_id"),
                "phone": phone,
                "whatsapp_phone": whatsapp_phone,
                "email": email,
                "country": payload.get("country"),
                "city": payload.get("city"),
                "address": payload.get("address"),
                "customer_type": payload.get("customer_type") or "individual",
                "lifecycle_status": payload.get("lifecycle_status") or "lead",
                "source": payload.get("source") or "manual",
                "preferred_language": payload.get("preferred_language") or "FR",
                "preferred_currency": payload.get("preferred_currency"),
                "notes": payload.get("notes"),
                "credit_enabled": bool(payload.get("credit_enabled") or False),
                "credit_limit": payload.get("credit_limit") or 0,
                "current_balance": payload.get("current_balance") or 0,
                "total_spent": payload.get("total_spent") or 0,
            },
        ).fetchone()

    created = get_client(org_id, row[0])
    return created or {}


def update_client(org_id: str, client_id: str, user_id: str, payload: dict) -> dict | None:
    existing = get_client(org_id, client_id)
    if not existing:
        return None

    phone = normalize_phone(payload.get("phone")) if "phone" in payload else existing.get("phone")
    whatsapp_phone = normalize_phone(payload.get("whatsapp_phone")) if "whatsapp_phone" in payload else existing.get("whatsapp_phone")
    email = normalize_email(payload.get("email")) if "email" in payload else existing.get("email")
    duplicate = _find_duplicate(org_id, phone or whatsapp_phone, email, exclude_id=client_id)
    if duplicate:
        raise ValueError("duplicate_client")

    data = {
        "name": payload.get("name", existing.get("name")),
        "display_name": payload.get("display_name", existing.get("display_name")),
        "company_name": payload.get("company_name", existing.get("company_name")),
        "tax_id": payload.get("tax_id", existing.get("tax_id")),
        "phone": phone,
        "whatsapp_phone": whatsapp_phone,
        "email": email,
        "country": payload.get("country", existing.get("country")),
        "city": payload.get("city", existing.get("city")),
        "address": payload.get("address", existing.get("address")),
        "customer_type": payload.get("customer_type", existing.get("customer_type")),
        "lifecycle_status": payload.get("lifecycle_status", existing.get("lifecycle_status")),
        "source": payload.get("source", existing.get("source")),
        "preferred_language": payload.get("preferred_language", existing.get("preferred_language")),
        "preferred_currency": payload.get("preferred_currency", existing.get("preferred_currency")),
        "notes": payload.get("notes", existing.get("notes")),
        "credit_enabled": payload.get("credit_enabled", existing.get("credit_enabled")),
        "credit_limit": payload.get("credit_limit", existing.get("credit_limit")),
        "current_balance": payload.get("current_balance", existing.get("current_balance")),
        "total_spent": payload.get("total_spent", existing.get("total_spent")),
    }
    if not data["display_name"]:
        data["display_name"] = data["name"] or data["company_name"] or data["phone"] or data["email"]

    with engine.begin() as conn:
        conn.execute(
            text("""
                update clients set
                    name = :name,
                    display_name = :display_name,
                    company_name = :company_name,
                    tax_id = :tax_id,
                    phone = :phone,
                    whatsapp_phone = :whatsapp_phone,
                    email = :email,
                    country = :country,
                    city = :city,
                    address = :address,
                    customer_type = :customer_type,
                    lifecycle_status = :lifecycle_status,
                    source = :source,
                    preferred_language = :preferred_language,
                    preferred_currency = :preferred_currency,
                    notes = :notes,
                    credit_enabled = :credit_enabled,
                    credit_limit = :credit_limit,
                    current_balance = :current_balance,
                    total_spent = :total_spent,
                    updated_by = :user_id,
                    updated_at = now()
                where org_id = :org_id
                  and id = :client_id
                  and deleted_at is null
            """),
            dict(data, org_id=org_id, client_id=client_id, user_id=user_id),
        )
    return get_client(org_id, client_id)


def soft_delete_client(org_id: str, client_id: str, user_id: str) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                update clients
                set deleted_at = now(), updated_by = :user_id, updated_at = now()
                where org_id = :org_id
                  and id = :client_id
                  and deleted_at is null
            """),
            {"org_id": org_id, "client_id": client_id, "user_id": user_id},
        )
    return result.rowcount > 0


def client_stats(org_id: str) -> dict:
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select
                    count(*)::int total,
                    count(*) filter (where lifecycle_status = 'lead')::int leads,
                    count(*) filter (where lifecycle_status = 'active')::int active,
                    count(*) filter (where lifecycle_status = 'pending')::int pending,
                    count(*) filter (where lifecycle_status = 'inactive')::int inactive,
                    count(*) filter (where lifecycle_status = 'blocked')::int blocked,
                    count(*) filter (where created_at >= date_trunc('month', now()))::int new_this_month
                from clients
                where org_id = :org_id
                  and deleted_at is null
            """),
            {"org_id": org_id},
        ).fetchone()
    return _one(row) or {"total": 0, "leads": 0, "active": 0, "pending": 0, "inactive": 0, "blocked": 0, "new_this_month": 0}
