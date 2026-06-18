import json

from sqlalchemy import text

from app.db.database import engine


ONBOARDING_STEPS = [
    ("WELCOME", "Welcome", 1, True),
    ("AGENCY_PROFILE", "Agency Profile", 2, True),
    ("WORKSPACES", "Offices / Workspaces", 3, True),
    ("WAREHOUSES", "Warehouses", 4, True),
    ("ROUTES", "Routes", 5, True),
    ("SHIPPING_SERVICES", "Shipping Services", 6, True),
    ("PRICING", "Pricing", 7, True),
    ("GOODS_RULES", "Goods Rules", 8, True),
    ("NOTIFICATIONS", "Notifications", 9, True),
    ("TEAM", "Team", 10, False),
    ("WHATSAPP", "WhatsApp", 11, True),
    ("REVIEW", "Review", 12, True),
    ("GO_LIVE", "Go Live", 13, True),
]


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


def get_or_create_journey(org_id: str, journey_version: str = "v1"):
    existing = fetch_one(
        """
        select *
        from onboarding_journeys
        where org_id = :org_id
          and journey_version = :journey_version
        limit 1
        """,
        {
            "org_id": org_id,
            "journey_version": journey_version,
        },
    )

    if existing:
        return existing

    journey = fetch_one(
        """
        insert into onboarding_journeys (
            org_id,
            journey_version,
            status
        )
        values (
            :org_id,
            :journey_version,
            'ACTIVE'
        )
        returning *
        """,
        {
            "org_id": org_id,
            "journey_version": journey_version,
        },
    )

    for step_key, step_name, step_order, required in ONBOARDING_STEPS:
        fetch_one(
            """
            insert into onboarding_steps (
                org_id,
                journey_id,
                step_key,
                step_name,
                step_order,
                required,
                status
            )
            values (
                :org_id,
                :journey_id,
                :step_key,
                :step_name,
                :step_order,
                :required,
                :status
            )
            on conflict (org_id, journey_id, step_key)
            do nothing
            returning *
            """,
            {
                "org_id": org_id,
                "journey_id": journey["id"],
                "step_key": step_key,
                "step_name": step_name,
                "step_order": step_order,
                "required": required,
                "status": "IN_PROGRESS" if step_key == "WELCOME" else "PENDING",
            },
        )

    return journey


def list_steps(org_id: str, journey_id: str):
    return fetch_all(
        """
        select *
        from onboarding_steps
        where org_id = :org_id
          and journey_id = :journey_id
        order by step_order asc
        """,
        {
            "org_id": org_id,
            "journey_id": journey_id,
        },
    )


def update_step_status(
    org_id: str,
    journey_id: str,
    step_key: str,
    status: str,
):
    return fetch_one(
        """
        update onboarding_steps
        set
            status = :status,
            started_at = case
                when :status = 'IN_PROGRESS' and started_at is null then now()
                else started_at
            end,
            completed_at = case
                when :status = 'COMPLETED' then now()
                else completed_at
            end
        where org_id = :org_id
          and journey_id = :journey_id
          and step_key = :step_key
        returning *
        """,
        {
            "org_id": org_id,
            "journey_id": journey_id,
            "step_key": step_key,
            "status": status,
        },
    )


def complete_journey(org_id: str, journey_id: str):
    return fetch_one(
        """
        update onboarding_journeys
        set
            status = 'COMPLETED',
            completed_at = now()
        where org_id = :org_id
          and id = :journey_id
        returning *
        """,
        {
            "org_id": org_id,
            "journey_id": journey_id,
        },
    )


def record_step_event(
    org_id: str,
    journey_id: str | None,
    step_key: str | None,
    user_id: str | None,
    event_name: str,
    payload: dict,
):
    return fetch_one(
        """
        insert into onboarding_step_events (
            org_id,
            journey_id,
            step_key,
            user_id,
            event_name,
            payload
        )
        values (
            :org_id,
            :journey_id,
            :step_key,
            :user_id,
            :event_name,
            cast(:payload as jsonb)
        )
        returning *
        """,
        {
            "org_id": org_id,
            "journey_id": journey_id,
            "step_key": step_key,
            "user_id": user_id,
            "event_name": event_name,
            "payload": _json(payload),
        },
    )
