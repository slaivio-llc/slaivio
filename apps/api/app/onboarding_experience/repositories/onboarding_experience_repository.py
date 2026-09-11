from sqlalchemy import text

from app.core.json_utils import json_dumps
from app.db.database import engine


ONBOARDING_STEPS = [
    ("WELCOME", "Bienvenue", 1, True),
    ("AGENCY_PROFILE", "Entreprise", 2, True),
    ("OPERATIONS", "Opérations", 3, False),
    ("WHATSAPP", "WhatsApp", 4, False),
    ("AI_KNOWLEDGE", "IA et connaissances", 5, False),
    ("REVIEW", "Vérification", 6, True),
    ("GO_LIVE", "Terminé", 7, True),
]


def _json(value):
    return json_dumps(value)


def fetch_one(query: str, params: dict):
    with engine.connect() as conn:
        row = conn.execute(text(query), params).fetchone()
        conn.commit()
        return dict(row._mapping) if row else None


def fetch_all(query: str, params: dict):
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).fetchall()
        return [dict(row._mapping) for row in rows]


def get_or_create_journey(org_id: str, journey_version: str = "v2"):
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

    journey = existing or fetch_one(
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
            do update set
                step_name = excluded.step_name,
                step_order = excluded.step_order,
                required = excluded.required
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
                when :status in ('COMPLETED', 'SKIPPED') then now()
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


def get_business_type(org_id: str):
    row = fetch_one(
        """
        select case
            when profile.business_type = 'PARCEL_FREIGHT'
              or organization.organization_type = 'PARCEL_FREIGHT'
                then 'PARCEL_FREIGHT'
            else 'VEHICLE_IMPORT'
        end as business_type
        from organizations organization
        left join agency_profile profile on profile.org_id = organization.id
        where organization.id = :org_id
        limit 1
        """,
        {"org_id": org_id},
    )
    return (row or {}).get("business_type", "VEHICLE_IMPORT")


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
