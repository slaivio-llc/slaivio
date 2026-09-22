from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import json
from math import ceil
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.database import engine


CLIENT_STATUSES = {"lead", "active", "pending", "inactive", "blocked"}
CLIENT_TYPES = {"individual", "business", "agent", "partner"}
CLIENT_SOURCES = {"manual", "whatsapp", "website", "referral", "import", "api"}
CLIENT_EXPORT_COLUMNS = [
    "display_name",
    "name",
    "company_name",
    "phone",
    "whatsapp_phone",
    "email",
    "country",
    "city",
    "customer_type",
    "lifecycle_status",
    "source",
    "preferred_language",
    "preferred_currency",
    "credit_enabled",
    "credit_limit",
    "current_balance",
    "total_spent",
    "payment_amount_due",
    "payment_amount_paid",
    "payment_currency",
    "notes",
]

CLIENT_RELATION_TABLES = (
    "dossiers", "messages_raw", "notification_outbox", "followup_tasks", "shipments",
    "cargo_packages", "expedition_packages", "expedition_financial_lines",
    "commercial_cases", "quote_requests", "procurement_requests", "cargo_restriction_checks",
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


def _one(row) -> dict | None:
    return _safe(dict(row._mapping)) if row else None


def _table_exists(conn, table_name: str) -> bool:
    return bool(conn.execute(text("select to_regclass(:table_name)"), {"table_name": f"public.{table_name}"}).scalar())


def _audit_client(conn, *, org_id: str, user_id: str, client_id: str, action: str,
                  changed_fields: list[str] | None = None) -> None:
    conn.execute(
        text("""
            insert into audit_logs (
                org_id, actor_id, entity_type, entity_id, action, metadata, severity
            ) values (
                :org_id, :user_id, 'client', :client_id, :action,
                cast(:metadata as jsonb), 'INFO'
            )
        """),
        {
            "org_id": org_id,
            "user_id": user_id,
            "client_id": client_id,
            "action": action,
            "metadata": json.dumps({"changed_fields": sorted(changed_fields or [])}),
        },
    )


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    raw = value.strip()
    prefix = "+" if raw.startswith("+") else ""
    digits = "".join(character for character in raw if character.isdigit())
    if digits.startswith("00"):
        prefix, digits = "+", digits[2:]
    if not digits:
        return None
    if len(digits) < 7 or len(digits) > 15:
        raise ValueError("invalid_phone")
    return f"{prefix}{digits}"


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized and ("@" not in normalized or normalized.startswith("@") or normalized.endswith("@")):
        raise ValueError("invalid_email")
    return normalized or None


def _build_filters(
    org_id: str,
    q: str | None,
    status: str | None,
    customer_type: str | None,
    source: str | None,
    country: str | None,
    city: str | None,
    *,
    archived: bool = False,
) -> tuple[str, dict]:
    filters = ["org_id = :org_id", "deleted_at is not null" if archived else "deleted_at is null"]
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
    archived: bool = False,
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size
    where_clause, params = _build_filters(
        org_id, q, status, customer_type, source, country, city, archived=archived
    )
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
                    c.payment_amount_due,
                    c.payment_amount_paid,
                    c.payment_currency,
                    case
                      when c.payment_amount_due <= 0 then 'NOT_SET'
                      when c.payment_amount_paid <= 0 then 'UNPAID'
                      when c.payment_amount_paid < c.payment_amount_due then 'PARTIAL'
                      else 'PAID'
                    end payment_status,
                    c.last_activity_at,
                    c.created_at,
                    c.updated_at,
                    c.row_version,
                    c.deleted_at,
                    coalesce(d.dossiers_count, 0)::int dossiers_count,
                    coalesce(s.shipments_count, 0)::int shipments_count,
                    coalesce(p.packages_count, 0)::int packages_count
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
                left join (
                    select client_id, count(*) packages_count
                    from cargo_packages
                    where org_id = :org_id and deleted_at is null
                    group by client_id
                ) p on p.client_id = c.id
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
                    c.payment_amount_due,
                    c.payment_amount_paid,
                    c.payment_currency,
                    case
                      when c.payment_amount_due <= 0 then 'NOT_SET'
                      when c.payment_amount_paid <= 0 then 'UNPAID'
                      when c.payment_amount_paid < c.payment_amount_due then 'PARTIAL'
                      else 'PAID'
                    end payment_status,
                    c.last_activity_at,
                    c.created_at,
                    c.updated_at,
                    c.row_version,
                    coalesce(d.dossiers_count, 0)::int dossiers_count,
                    coalesce(s.shipments_count, 0)::int shipments_count,
                    coalesce(p.packages_count, 0)::int packages_count
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
                left join (
                    select client_id, count(*) packages_count
                    from cargo_packages
                    where org_id = :org_id and deleted_at is null
                    group by client_id
                ) p on p.client_id = c.id
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

    try:
        with engine.begin() as conn:
            network_client_id = None
            network_phone = phone or whatsapp_phone
            if network_phone:
                network_client_id = conn.execute(
                    text("""
                        insert into organization_network_clients(group_id,normalized_phone,display_name,email)
                        select organization.group_id,:phone,:display_name,:email
                        from organizations organization
                        where organization.id=:org_id and organization.group_id is not null
                        on conflict(group_id,normalized_phone) do update set
                          display_name=coalesce(excluded.display_name,organization_network_clients.display_name),
                          email=coalesce(excluded.email,organization_network_clients.email),updated_at=now()
                        returning id
                    """),
                    {"org_id": org_id, "phone": network_phone, "display_name": display_name, "email": email},
                ).scalar()
            row = conn.execute(
            text("""
                insert into clients (
                    org_id, name, display_name, company_name, tax_id, phone, whatsapp_phone,
                    email, normalized_phone, normalized_email, country, city, address, customer_type, lifecycle_status,
                    source, preferred_language, preferred_currency, notes, credit_enabled,
                    credit_limit, current_balance, total_spent,
                    payment_amount_due, payment_amount_paid, payment_currency, network_client_id, last_activity_at,
                    created_by, updated_by
                )
                values (
                    :org_id, :name, :display_name, :company_name, :tax_id, :phone, :whatsapp_phone,
                    :email, :normalized_phone, :normalized_email, :country, :city, :address, :customer_type, :lifecycle_status,
                    :source, :preferred_language, :preferred_currency, :notes, :credit_enabled,
                    :credit_limit, :current_balance, :total_spent,
                    :payment_amount_due, :payment_amount_paid, :payment_currency, cast(:network_client_id as uuid), now(),
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
                "normalized_phone": phone or whatsapp_phone,
                "normalized_email": email,
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
                "payment_amount_due": payload.get("payment_amount_due") or 0,
                "payment_amount_paid": payload.get("payment_amount_paid") or 0,
                "payment_currency": (payload.get("payment_currency") or payload.get("preferred_currency") or "USD").upper(),
                "network_client_id": str(network_client_id) if network_client_id else None,
                },
            ).fetchone()
            if row is not None:
                _audit_client(
                    conn, org_id=org_id, user_id=user_id, client_id=str(row[0]),
                    action="client.created", changed_fields=list(payload.keys()),
                )
    except IntegrityError as exc:
        raise ValueError("duplicate_client") from exc

    if row is None:
        raise RuntimeError("client_insert_failed")
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
        "payment_amount_due": payload.get("payment_amount_due", existing.get("payment_amount_due")),
        "payment_amount_paid": payload.get("payment_amount_paid", existing.get("payment_amount_paid")),
        "payment_currency": (payload.get("payment_currency", existing.get("payment_currency")) or "USD").upper(),
    }
    expected_version = int(payload["row_version"])
    if not data["display_name"]:
        data["display_name"] = data["name"] or data["company_name"] or data["phone"] or data["email"]

    try:
        with engine.begin() as conn:
            network_client_id = None
            network_phone = phone or whatsapp_phone
            if network_phone:
                network_client_id = conn.execute(
                    text("""
                        insert into organization_network_clients(group_id,normalized_phone,display_name,email)
                        select organization.group_id,:phone,:display_name,:email
                        from organizations organization
                        where organization.id=:org_id and organization.group_id is not null
                        on conflict(group_id,normalized_phone) do update set
                          display_name=coalesce(excluded.display_name,organization_network_clients.display_name),
                          email=coalesce(excluded.email,organization_network_clients.email),updated_at=now()
                        returning id
                    """),
                    {
                        "org_id": org_id,
                        "phone": network_phone,
                        "display_name": data["display_name"],
                        "email": email,
                    },
                ).scalar()
            result = conn.execute(
            text("""
                update clients set
                    name = :name,
                    display_name = :display_name,
                    company_name = :company_name,
                    tax_id = :tax_id,
                    phone = :phone,
                    whatsapp_phone = :whatsapp_phone,
                    email = :email,
                    normalized_phone = :normalized_phone,
                    normalized_email = :normalized_email,
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
                    payment_amount_due = :payment_amount_due,
                    payment_amount_paid = :payment_amount_paid,
                    payment_currency = :payment_currency,
                    network_client_id = cast(:network_client_id as uuid),
                    updated_by = :user_id,
                    updated_at = now(),
                    row_version = row_version + 1
                where org_id = :org_id
                  and id = :client_id
                  and deleted_at is null
                  and row_version = :expected_version
            """),
            dict(data, org_id=org_id, client_id=client_id, user_id=user_id,
                 normalized_phone=phone or whatsapp_phone, normalized_email=email,
                 network_client_id=str(network_client_id) if network_client_id else None,
                 expected_version=expected_version),
            )
            if result.rowcount > 0:
                _audit_client(
                    conn, org_id=org_id, user_id=user_id, client_id=client_id,
                    action="client.updated",
                    changed_fields=[key for key in payload if key != "row_version"],
                )
    except IntegrityError as exc:
        raise ValueError("duplicate_client") from exc
    if result.rowcount == 0:
        if get_client(org_id, client_id):
            raise ValueError("stale_client_version")
        return None
    return get_client(org_id, client_id)


def soft_delete_client(
    org_id: str, client_id: str, user_id: str, *, expected_version: int
) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                update clients
                set deleted_at = now(), archived_by = :user_id, updated_by = :user_id,
                    updated_at = now(), row_version = row_version + 1
                where org_id = :org_id
                  and id = :client_id
                  and deleted_at is null
                  and row_version = :expected_version
            """),
            {
                "org_id": org_id,
                "client_id": client_id,
                "user_id": user_id,
                "expected_version": expected_version,
            },
        )
        if result.rowcount > 0:
            _audit_client(
                conn, org_id=org_id, user_id=user_id, client_id=client_id,
                action="client.archived",
            )
    if result.rowcount == 0 and get_client(org_id, client_id):
        raise ValueError("stale_client_version")
    return result.rowcount > 0


def restore_client(
    org_id: str, client_id: str, user_id: str, *, expected_version: int
) -> dict | None:
    try:
        with engine.begin() as conn:
            archived = conn.execute(
                text("""
                    select phone, whatsapp_phone, email, row_version
                    from clients
                    where org_id = :org_id and id = :client_id and deleted_at is not null
                    for update
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchone()
            if archived is None:
                return None
            if int(archived[3]) != expected_version:
                raise ValueError("stale_client_version")
            result = conn.execute(
                text("""
                    update clients
                    set deleted_at = null,
                        archived_by = null,
                        normalized_phone = :normalized_phone,
                        normalized_email = :normalized_email,
                        updated_by = :user_id,
                        updated_at = now(),
                        row_version = row_version + 1
                    where org_id = :org_id
                      and id = :client_id
                      and deleted_at is not null
                      and row_version = :expected_version
                """),
                {
                    "org_id": org_id,
                    "client_id": client_id,
                    "user_id": user_id,
                    "normalized_phone": normalize_phone(archived[0] or archived[1]),
                    "normalized_email": normalize_email(archived[2]),
                    "expected_version": expected_version,
                },
            )
            if result.rowcount == 0:
                return None
            _audit_client(
                conn, org_id=org_id, user_id=user_id, client_id=client_id,
                action="client.restored",
            )
    except IntegrityError as exc:
        raise ValueError("restore_identity_conflict") from exc
    return get_client(org_id, client_id)


def merge_clients(
    org_id: str,
    source_client_id: str,
    target_client_id: str,
    user_id: str,
    *,
    source_version: int,
    target_version: int,
    idempotency_key: str,
) -> dict:
    if source_client_id == target_client_id:
        raise ValueError("merge_same_client")
    try:
        with engine.begin() as conn:
            conn.execute(
                text("select pg_advisory_xact_lock(hashtextextended(:lock_key, 0))"),
                {"lock_key": f"{org_id}:{idempotency_key}"},
            )
            previous = conn.execute(
                text("""
                    select target_client_id::text
                    from client_merge_operations
                    where org_id = :org_id and idempotency_key = :idempotency_key
                """),
                {"org_id": org_id, "idempotency_key": idempotency_key},
            ).scalar()
            if previous:
                client = get_client(org_id, str(previous))
                if not client:
                    raise ValueError("merge_target_not_found")
                return client

            rows = conn.execute(
                text("""
                    select * from clients
                    where org_id = :org_id
                      and id in (:source_client_id, :target_client_id)
                      and deleted_at is null
                    order by id
                    for update
                """),
                {
                    "org_id": org_id,
                    "source_client_id": source_client_id,
                    "target_client_id": target_client_id,
                },
            ).fetchall()
            clients = {str(row._mapping["id"]): dict(row._mapping) for row in rows}
            source = clients.get(source_client_id)
            target = clients.get(target_client_id)
            if source is None or target is None:
                raise ValueError("merge_client_not_found")
            if int(source["row_version"]) != source_version or int(target["row_version"]) != target_version:
                raise ValueError("stale_client_version")

            conn.execute(
                text("""
                    update clients set
                        deleted_at = now(), archived_by = :user_id,
                        normalized_phone = null, normalized_email = null,
                        updated_by = :user_id, updated_at = now(), row_version = row_version + 1
                    where org_id = :org_id and id = :source_client_id
                """),
                {"org_id": org_id, "source_client_id": source_client_id, "user_id": user_id},
            )
            conn.execute(
                text("""
                    update clients set
                        name = coalesce(nullif(name, ''), :source_name),
                        display_name = coalesce(nullif(display_name, ''), :source_display_name),
                        company_name = coalesce(nullif(company_name, ''), :source_company_name),
                        phone = coalesce(nullif(phone, ''), :source_phone),
                        whatsapp_phone = coalesce(nullif(whatsapp_phone, ''), :source_whatsapp_phone),
                        email = coalesce(nullif(email, ''), :source_email),
                        normalized_phone = coalesce(normalized_phone, :source_normalized_phone),
                        normalized_email = coalesce(normalized_email, :source_normalized_email),
                        updated_by = :user_id, updated_at = now(), row_version = row_version + 1
                    where org_id = :org_id and id = :target_client_id
                """),
                {
                    "org_id": org_id, "target_client_id": target_client_id, "user_id": user_id,
                    "source_name": source.get("name"), "source_display_name": source.get("display_name"),
                    "source_company_name": source.get("company_name"), "source_phone": source.get("phone"),
                    "source_whatsapp_phone": source.get("whatsapp_phone"), "source_email": source.get("email"),
                    "source_normalized_phone": source.get("normalized_phone"),
                    "source_normalized_email": source.get("normalized_email"),
                },
            )

            moved: dict[str, int] = {}
            for table_name in CLIENT_RELATION_TABLES:
                if not _table_exists(conn, table_name):
                    continue
                result = conn.execute(
                    text(f"""
                        update {table_name}
                        set client_id = :target_client_id
                        where org_id = :org_id and client_id = :source_client_id
                    """),
                    {
                        "org_id": org_id,
                        "source_client_id": source_client_id,
                        "target_client_id": target_client_id,
                    },
                )
                moved[table_name] = result.rowcount

            conn.execute(
                text("""
                    update client_identity_conflicts
                    set resolved_at = now(), resolved_by = :user_id
                    where org_id = :org_id
                      and client_id = :source_client_id
                      and resolved_at is null
                """),
                {"org_id": org_id, "source_client_id": source_client_id, "user_id": user_id},
            )
            conn.execute(
                text("""
                    insert into client_merge_operations (
                        org_id, source_client_id, target_client_id, actor_id,
                        idempotency_key, moved_relations
                    ) values (
                        :org_id, :source_client_id, :target_client_id, :user_id,
                        :idempotency_key, cast(:moved_relations as jsonb)
                    )
                """),
                {
                    "org_id": org_id, "source_client_id": source_client_id,
                    "target_client_id": target_client_id, "user_id": user_id,
                    "idempotency_key": idempotency_key, "moved_relations": json.dumps(moved),
                },
            )
            _audit_client(
                conn, org_id=org_id, user_id=user_id, client_id=target_client_id,
                action="client.merged", changed_fields=[],
            )
            _audit_client(
                conn, org_id=org_id, user_id=user_id, client_id=source_client_id,
                action="client.merged_into", changed_fields=[],
            )
    except IntegrityError as exc:
        raise ValueError("merge_relationship_conflict") from exc
    merged = get_client(org_id, target_client_id)
    if not merged:
        raise ValueError("merge_target_not_found")
    return merged


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


def find_client_duplicates(
    org_id: str,
    *,
    client_id: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    name: str | None = None,
    limit: int = 12,
) -> list[dict]:
    normalized_phone = normalize_phone(phone)
    normalized_email = normalize_email(email)
    normalized_name = (name or "").strip()

    if client_id and (not normalized_phone and not normalized_email and not normalized_name):
        client = get_client(org_id, client_id)
        if not client:
            return []
        normalized_phone = normalize_phone(client.get("phone") or client.get("whatsapp_phone"))
        normalized_email = normalize_email(client.get("email"))
        normalized_name = (client.get("display_name") or client.get("name") or client.get("company_name") or "").strip()

    clauses = ["org_id = :org_id", "deleted_at is null"]
    params: dict[str, Any] = {"org_id": org_id, "limit": min(max(limit, 1), 30)}
    signals: list[str] = []

    if client_id:
        clauses.append("id <> :client_id")
        params["client_id"] = client_id
    if normalized_phone:
        signals.append("(phone = :phone or whatsapp_phone = :phone)")
        params["phone"] = normalized_phone
    if normalized_email:
        signals.append("email = :email")
        params["email"] = normalized_email
    if normalized_name:
        signals.append("(coalesce(display_name, '') ilike :name or coalesce(name, '') ilike :name or coalesce(company_name, '') ilike :name)")
        params["name"] = f"%{normalized_name}%"

    if not signals:
        return []
    clauses.append("(" + " or ".join(signals) + ")")

    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select
                    id::text,
                    coalesce(display_name, name, company_name, phone, email) display_name,
                    name,
                    company_name,
                    phone,
                    whatsapp_phone,
                    email,
                    country,
                    city,
                    customer_type,
                    lifecycle_status,
                    row_version,
                    case
                        when :phone is not null and (phone = :phone or whatsapp_phone = :phone) then 'phone'
                        when :email is not null and email = :email then 'email'
                        else 'name'
                    end match_reason,
                    created_at
                from clients
                where {" and ".join(clauses)}
                order by
                    case
                        when :phone is not null and (phone = :phone or whatsapp_phone = :phone) then 1
                        when :email is not null and email = :email then 2
                        else 3
                    end,
                    updated_at desc
                limit :limit
            """),
            params,
        ).fetchall()
    return [_safe(dict(row._mapping)) for row in rows]


def client_timeline(org_id: str, client_id: str, *, limit: int = 50) -> list[dict]:
    client = get_client(org_id, client_id)
    if not client:
        return []

    events: list[dict] = [
        {
            "id": f"client-created-{client_id}",
            "type": "client",
            "title": "Client créé",
            "description": client.get("display_name") or client.get("name") or "Fiche client créée",
            "occurred_at": client.get("created_at"),
            "metadata": {"status": client.get("lifecycle_status"), "source": client.get("source")},
        }
    ]
    if client.get("updated_at") and client.get("updated_at") != client.get("created_at"):
        events.append(
            {
                "id": f"client-updated-{client_id}",
                "type": "client",
                "title": "Client mis à jour",
                "description": "Les informations de la fiche client ont été modifiées.",
                "occurred_at": client.get("updated_at"),
                "metadata": {},
            }
        )

    with engine.connect() as conn:
        if _table_exists(conn, "audit_logs"):
            audit_rows = conn.execute(
                text("""
                    select id::text, action, metadata, created_at
                    from audit_logs
                    where org_id = :org_id
                      and entity_type = 'client'
                      and entity_id = :client_id
                    order by created_at desc
                    limit 30
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            if audit_rows:
                action_titles = {
                    "client.created": "Client créé",
                    "client.updated": "Client mis à jour",
                    "client.archived": "Client archivé",
                    "client.restored": "Client restauré",
                    "client.merged": "Doublon fusionné dans ce client",
                    "client.merged_into": "Client fusionné dans une fiche principale",
                }
                events = [
                    {
                        "id": f"audit-{item.id}",
                        "type": "audit",
                        "title": action_titles.get(item.action, item.action),
                        "description": "Action enregistrée dans le journal d’audit.",
                        "occurred_at": item.created_at,
                        "metadata": item.metadata or {},
                    }
                    for item in audit_rows
                ]

        if _table_exists(conn, "dossiers"):
            rows = conn.execute(
                text("""
                    select
                        id::text,
                        coalesce(tracking_id, id::text) reference,
                        coalesce(status_global, validation_status, intake_status, 'UNKNOWN') status,
                        created_at
                    from dossiers
                    where org_id = :org_id and client_id = :client_id
                    order by created_at desc
                    limit 20
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                events.append(
                    {
                        "id": f"dossier-{item['id']}",
                        "type": "dossier",
                        "title": "Dossier créé",
                        "description": f"{item.get('reference') or 'Dossier'} · {item.get('status') or 'Statut inconnu'}",
                        "occurred_at": item.get("created_at"),
                        "metadata": {"dossier_id": item.get("id"), "status": item.get("status")},
                    }
                )

        if _table_exists(conn, "shipments"):
            rows = conn.execute(
                text("""
                    select id::text, tracking_id, status, origin_city, origin_country, destination_city, destination_country, created_at
                    from shipments
                    where org_id = :org_id and client_id = :client_id
                    order by created_at desc
                    limit 20
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                route = " → ".join(filter(None, [item.get("origin_city") or item.get("origin_country"), item.get("destination_city") or item.get("destination_country")]))
                events.append(
                    {
                        "id": f"shipment-{item['id']}",
                        "type": "shipment",
                        "title": "Expédition liée",
                        "description": f"{item.get('tracking_id') or 'Expédition'}{f' · {route}' if route else ''}",
                        "occurred_at": item.get("created_at"),
                        "metadata": {"shipment_id": item.get("id"), "status": item.get("status")},
                    }
                )

        if _table_exists(conn, "cargo_packages"):
            rows = conn.execute(
                text("""
                    select id::text, package_reference, tracking_id, status,
                           destination_city, destination_country, created_at, updated_at
                    from cargo_packages
                    where org_id=:org_id and client_id=cast(:client_id as uuid)
                      and deleted_at is null
                    order by updated_at desc
                    limit 30
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                destination = ", ".join(filter(None, [item.get("destination_city"), item.get("destination_country")]))
                events.append({
                    "id": f"package-{item['id']}",
                    "type": "package",
                    "title": "Colis mis à jour",
                    "description": f"{item.get('tracking_id') or item.get('package_reference') or 'Colis'} · {item.get('status') or 'UNKNOWN'}{f' · {destination}' if destination else ''}",
                    "occurred_at": item.get("updated_at") or item.get("created_at"),
                    "metadata": {"package_id": item.get("id"), "status": item.get("status")},
                })

        if _table_exists(conn, "finance_payments") and _table_exists(conn, "finance_documents"):
            rows = conn.execute(
                text("""
                    select payment.id::text, payment.amount, payment.currency, payment.status,
                           payment.receipt_number, payment.paid_at, document.document_number
                    from finance_payments payment
                    join finance_documents document on document.id=payment.document_id
                      and document.org_id=payment.org_id
                    where payment.org_id=:org_id
                      and document.client_id=cast(:client_id as uuid)
                    order by payment.paid_at desc
                    limit 30
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                events.append({
                    "id": f"payment-{item['id']}",
                    "type": "payment",
                    "title": "Paiement enregistré",
                    "description": f"{item.get('amount') or 0} {item.get('currency') or ''} · {item.get('document_number') or item.get('receipt_number') or 'Paiement'}",
                    "occurred_at": item.get("paid_at"),
                    "metadata": {"status": item.get("status"), "receipt_number": item.get("receipt_number")},
                })

        if _table_exists(conn, "messages_raw"):
            rows = conn.execute(
                text("""
                    select id::text, sender_phone, left(coalesce(message_text, ''), 140) message_text, created_at
                    from messages_raw
                    where org_id = :org_id and client_id = :client_id
                    order by created_at desc
                    limit 20
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                events.append(
                    {
                        "id": f"message-{item['id']}",
                        "type": "message",
                        "title": "Message reçu",
                        "description": item.get("message_text") or item.get("sender_phone") or "Message client",
                        "occurred_at": item.get("created_at"),
                        "metadata": {"sender_phone": item.get("sender_phone")},
                    }
                )

        if _table_exists(conn, "followup_tasks"):
            rows = conn.execute(
                text("""
                    select id::text, followup_type, status, due_at, created_at
                    from followup_tasks
                    where org_id = :org_id and client_id = :client_id
                    order by created_at desc
                    limit 20
                """),
                {"org_id": org_id, "client_id": client_id},
            ).fetchall()
            for row in rows:
                item = dict(row._mapping)
                events.append(
                    {
                        "id": f"followup-{item['id']}",
                        "type": "followup",
                        "title": "Relance planifiée",
                        "description": f"{item.get('followup_type') or 'Relance'} · {item.get('status') or 'Statut inconnu'}",
                        "occurred_at": item.get("created_at"),
                        "metadata": {"due_at": _safe(item.get("due_at")), "status": item.get("status")},
                    }
                )

    events = [_safe(event) for event in events if event.get("occurred_at")]
    events.sort(key=lambda event: event.get("occurred_at") or "", reverse=True)
    return events[: min(max(limit, 1), 100)]


def client_workspace(org_id: str, client_id: str) -> dict | None:
    """Return the operational 360° view without leaking data across agencies."""
    client = get_client(org_id, client_id)
    if not client:
        return None

    packages: list[dict] = []
    messages: list[dict] = []
    documents: list[dict] = []
    payments: list[dict] = []
    with engine.connect() as conn:
        if (_table_exists(conn, "cargo_packages") and
                _table_exists(conn, "departure_package_allocations") and
                _table_exists(conn, "cargo_departures")):
            packages = [_safe(dict(row._mapping)) for row in conn.execute(text("""
                select p.id::text, p.package_reference, p.tracking_id, p.status,
                       p.weight_kg, p.destination_city, p.destination_country,
                       p.received_at, p.dispatched_at, p.delivered_at, p.updated_at,
                       departure.id::text departure_id, departure.departure_code,
                       departure.scheduled_at departure_scheduled_at,
                       departure.status departure_status
                from cargo_packages p
                left join lateral (
                    select d.id, d.departure_code, d.scheduled_at, d.status
                    from departure_package_allocations allocation
                    join cargo_departures d on d.id=allocation.departure_id
                      and d.org_id=allocation.org_id
                    where allocation.org_id=p.org_id and allocation.package_id=p.id
                      and allocation.status<>'REMOVED'
                    order by allocation.created_at desc
                    limit 1
                ) departure on true
                where p.org_id=:org_id and p.client_id=cast(:client_id as uuid)
                  and p.deleted_at is null
                order by p.updated_at desc
                limit 100
            """), {"org_id": org_id, "client_id": client_id}).fetchall()]

        if _table_exists(conn, "messages"):
            messages = [_safe(dict(row._mapping)) for row in conn.execute(text("""
                select id::text, direction, text_body, message_type, send_status,
                       error_message, from_phone, to_phone, sender_name, is_group,
                       media_mime_type, media_file_name, created_at
                from messages
                where org_id=:org_id and client_id=cast(:client_id as uuid)
                  and coalesce(sender_jid, '') not like '%@newsletter'
                  and coalesce(conversation_jid, '') not like '%@newsletter'
                order by created_at desc
                limit 100
            """), {"org_id": org_id, "client_id": client_id}).fetchall()]

        if _table_exists(conn, "finance_documents"):
            documents = [_safe(dict(row._mapping)) for row in conn.execute(text("""
                select id::text, document_type, document_number, status, currency,
                       total, amount_paid, balance_due, issue_date, due_date, created_at
                from finance_documents
                where org_id=:org_id and client_id=cast(:client_id as uuid)
                order by created_at desc
                limit 100
            """), {"org_id": org_id, "client_id": client_id}).fetchall()]

        if _table_exists(conn, "finance_payments") and _table_exists(conn, "finance_documents"):
            payments = [_safe(dict(row._mapping)) for row in conn.execute(text("""
                select payment.id::text, payment.receipt_number, payment.amount,
                       payment.currency, payment.method, payment.reference,
                       payment.paid_at, payment.status,
                       document.id::text document_id, document.document_number
                from finance_payments payment
                join finance_documents document on document.id=payment.document_id
                  and document.org_id=payment.org_id
                where payment.org_id=:org_id
                  and document.client_id=cast(:client_id as uuid)
                order by payment.paid_at desc
                limit 100
            """), {"org_id": org_id, "client_id": client_id}).fetchall()]

    outstanding = sum(float(item.get("balance_due") or 0) for item in documents
                      if item.get("status") not in {"VOID", "PAID"})
    paid = sum(float(item.get("amount") or 0) for item in payments
               if item.get("status") == "CONFIRMED")
    return {
        "client": client,
        "packages": packages,
        "messages": messages,
        "documents": documents,
        "payments": payments,
        "summary": {
            "packages": len(packages),
            "active_packages": sum(1 for item in packages if item.get("status") not in {"DELIVERED", "CANCELLED", "RETURNED"}),
            "messages": len(messages),
            "documents": len(documents),
            "payments": len(payments),
            "outstanding": round(outstanding, 2),
            "paid": round(paid, 2),
        },
    }


def export_clients(org_id: str, *, limit: int = 50_001, **filters) -> list[dict]:
    where_clause, params = _build_filters(
        org_id,
        filters.get("q"),
        filters.get("status"),
        filters.get("customer_type"),
        filters.get("source"),
        filters.get("country"),
        filters.get("city"),
    )
    sort = filters.get("sort") or "created_desc"
    order_by = {
        "created_asc": "created_at asc",
        "name_asc": "coalesce(display_name, name, phone, email) asc nulls last",
        "name_desc": "coalesce(display_name, name, phone, email) desc nulls last",
        "activity_desc": "last_activity_at desc nulls last, updated_at desc",
        "activity_asc": "last_activity_at asc nulls last, updated_at asc",
    }.get(sort, "created_at desc")
    columns = ", ".join(CLIENT_EXPORT_COLUMNS)
    with engine.connect() as conn:
        rows = conn.execute(
            text(f"""
                select {columns}
                from clients
                where {where_clause}
                order by {order_by}
                limit :limit
            """),
            dict(params, limit=min(max(limit, 1), 50_001)),
        ).fetchall()
    return [_safe(dict(row._mapping)) for row in rows]


def import_clients(org_id: str, user_id: str, rows: list[dict]) -> dict:
    created = 0
    skipped = 0
    errors: list[dict] = []
    created_clients: list[dict] = []

    for index, row in enumerate(rows, start=2):
        row_number = int(row.get("_csv_row") or index)
        payload = {
            "display_name": row.get("display_name") or row.get("nom_affiche"),
            "name": row.get("name") or row.get("nom") or row.get("client"),
            "company_name": row.get("company_name") or row.get("entreprise"),
            "tax_id": row.get("tax_id") or row.get("id_fiscal"),
            "phone": row.get("phone") or row.get("telephone") or row.get("téléphone"),
            "whatsapp_phone": row.get("whatsapp_phone") or row.get("whatsapp"),
            "email": row.get("email"),
            "country": row.get("country") or row.get("pays"),
            "city": row.get("city") or row.get("ville"),
            "address": row.get("address") or row.get("adresse"),
            "customer_type": row.get("customer_type") or row.get("type") or "individual",
            "lifecycle_status": row.get("lifecycle_status") or row.get("status") or row.get("statut") or "lead",
            "source": "import",
            "preferred_language": row.get("preferred_language") or row.get("langue") or "FR",
            "preferred_currency": row.get("preferred_currency") or row.get("devise"),
            "notes": row.get("notes"),
            "credit_enabled": str(row.get("credit_enabled") or "").lower() in {"true", "1", "yes", "oui"},
            "credit_limit": row.get("credit_limit") or 0,
            "payment_amount_due": row.get("payment_amount_due") or row.get("montant_attendu") or 0,
            "payment_amount_paid": row.get("payment_amount_paid") or row.get("montant_paye") or 0,
            "payment_currency": row.get("payment_currency") or row.get("devise_paiement") or row.get("devise") or "USD",
        }
        if payload["customer_type"] not in CLIENT_TYPES:
            errors.append({"row": row_number, "error": "invalid_customer_type"})
            continue
        if payload["lifecycle_status"] not in CLIENT_STATUSES:
            errors.append({"row": row_number, "error": "invalid_lifecycle_status"})
            continue
        if not any(payload.get(key) for key in ("name", "company_name", "phone", "email")):
            errors.append({"row": row_number, "error": "name_company_phone_or_email_required"})
            continue
        try:
            payload["credit_limit"] = float(payload["credit_limit"] or 0)
            if payload["credit_limit"] < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors.append({"row": row_number, "error": "invalid_credit_limit"})
            continue
        try:
            payload["payment_amount_due"] = float(payload["payment_amount_due"] or 0)
            payload["payment_amount_paid"] = float(payload["payment_amount_paid"] or 0)
            if payload["payment_amount_due"] < 0 or payload["payment_amount_paid"] < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors.append({"row": row_number, "error": "invalid_payment_amount"})
            continue

        try:
            client = create_client(org_id, user_id, payload)
            created += 1
            created_clients.append(client)
        except ValueError as exc:
            if str(exc) == "duplicate_client":
                skipped += 1
                continue
            errors.append({"row": row_number, "error": str(exc)})
        except Exception:  # pragma: no cover - defensive import reporting
            errors.append({"row": row_number, "error": "client_import_row_failed"})

    return {
        "processed": len(rows),
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "clients": created_clients[:20],
    }
