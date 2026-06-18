import json

from sqlalchemy import text

from app.db.database import engine


ALLOWED_COUNT_TABLES = {
    "workspaces",
    "warehouses",
    "shipping_services",
    "pricing_components",
    "advanced_goods_rules",
    "notification_policies",
}


def _json(value):
    return json.dumps(value)


def fetch_one(query: str, params: dict):
    with engine.connect() as conn:
        row = conn.execute(text(query), params).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def fetch_all(query: str, params: dict):
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).fetchall()
        return [dict(row._mapping) for row in rows]


def get_or_create_onboarding(org_id: str):
    existing = fetch_one(
        """
        select *
        from agency_onboarding
        where org_id = :org_id
        limit 1
        """,
        {"org_id": org_id},
    )

    if existing:
        return existing

    return fetch_one(
        """
        insert into agency_onboarding (
            org_id,
            status,
            current_step,
            completed_steps,
            missing_steps
        )
        values (
            :org_id,
            'IN_PROGRESS',
            'AGENCY_PROFILE',
            '[]'::jsonb,
            '[]'::jsonb
        )
        returning *
        """,
        {"org_id": org_id},
    )


def upsert_agency_profile(org_id: str, data: dict):
    return fetch_one(
        """
        insert into agency_profile (
            org_id,
            legal_name,
            brand_name,
            country,
            city,
            address,
            phone,
            email,
            website,
            default_language,
            default_currency,
            business_type,
            metadata
        )
        values (
            :org_id,
            :legal_name,
            :brand_name,
            :country,
            :city,
            :address,
            :phone,
            :email,
            :website,
            :default_language,
            :default_currency,
            :business_type,
            cast(:metadata as jsonb)
        )
        on conflict (org_id)
        do update set
            legal_name = excluded.legal_name,
            brand_name = excluded.brand_name,
            country = excluded.country,
            city = excluded.city,
            address = excluded.address,
            phone = excluded.phone,
            email = excluded.email,
            website = excluded.website,
            default_language = excluded.default_language,
            default_currency = excluded.default_currency,
            business_type = excluded.business_type,
            metadata = excluded.metadata,
            updated_at = now()
        returning *
        """,
        {
            "org_id": org_id,
            "legal_name": data.get("legal_name"),
            "brand_name": data.get("brand_name"),
            "country": data.get("country"),
            "city": data.get("city"),
            "address": data.get("address"),
            "phone": data.get("phone"),
            "email": data.get("email"),
            "website": data.get("website"),
            "default_language": data.get("default_language"),
            "default_currency": data.get("default_currency"),
            "business_type": data.get("business_type"),
            "metadata": _json(data.get("metadata", {})),
        },
    )


def get_agency_profile(org_id: str):
    return fetch_one(
        """
        select *
        from agency_profile
        where org_id = :org_id
        limit 1
        """,
        {"org_id": org_id},
    )


def update_onboarding_state(
    org_id: str,
    status: str,
    current_step: str,
    completed_steps: list[str],
    missing_steps: list[str],
):
    return fetch_one(
        """
        update agency_onboarding
        set
            status = :status,
            current_step = :current_step,
            completed_steps = cast(:completed_steps as jsonb),
            missing_steps = cast(:missing_steps as jsonb),
            completed_at = case
                when :status = 'COMPLETED' then now()
                else completed_at
            end,
            updated_at = now()
        where org_id = :org_id
        returning *
        """,
        {
            "org_id": org_id,
            "status": status,
            "current_step": current_step,
            "completed_steps": _json(completed_steps),
            "missing_steps": _json(missing_steps),
        },
    )


def record_onboarding_event(
    org_id: str,
    user_id: str | None,
    event_name: str,
    payload: dict,
):
    return fetch_one(
        """
        insert into onboarding_events (
            org_id,
            user_id,
            event_name,
            payload
        )
        values (
            :org_id,
            :user_id,
            :event_name,
            cast(:payload as jsonb)
        )
        returning *
        """,
        {
            "org_id": org_id,
            "user_id": user_id,
            "event_name": event_name,
            "payload": _json(payload),
        },
    )


def table_exists(table_name: str):
    if table_name not in ALLOWED_COUNT_TABLES:
        raise ValueError("Invalid table name.")

    with engine.connect() as conn:
        return bool(
            conn.execute(
                text("select to_regclass(:table_name) is not null"),
                {"table_name": f"public.{table_name}"},
            ).scalar()
        )


def count_rows(table_name: str, org_id: str):
    if table_name not in ALLOWED_COUNT_TABLES:
        raise ValueError("Invalid table name.")

    if not table_exists(table_name):
        return 0

    with engine.connect() as conn:
        count = conn.execute(
            text(f"""
                select count(*)::int
                from {table_name}
                where org_id = :org_id
            """),
            {"org_id": org_id},
        ).scalar()

        return int(count or 0)
