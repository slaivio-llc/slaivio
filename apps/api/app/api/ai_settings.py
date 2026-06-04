from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text

from app.core.auth import get_current_manager
from app.db.database import engine
from app.services.whatsapp_outbound_resolver import (
    resolve_outbound_whatsapp_sender,
)


router = APIRouter()


class UpdateAISettingsRequest(BaseModel):
    enabled: bool | None = None
    auto_reply_enabled: bool | None = None
    auto_reply_min_confidence: float | None = None
    escalation_threshold: float | None = None


def _default_settings(org_id: str):
    return {
        "org_id": org_id,
        "enabled": True,
        "provider": "MISTRAL",
        "model_name": "mistral-large-latest",
        "temperature": 0.2,
        "max_tokens": 700,
        "escalation_confidence": 0.4,
        "escalation_threshold": 0.60,
        "auto_escalation_enabled": True,
        "auto_reply_enabled": False,
        "auto_reply_min_confidence": 0.75,
    }


def _get_or_create_ai_settings(org_id: str):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into ai_settings (
                    org_id
                )
                values (
                    :org_id
                )
                on conflict (org_id) do nothing
                returning *
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        if not row:
            row = conn.execute(
                text("""
                    select *
                    from ai_settings
                    where org_id = :org_id
                    limit 1
                """),
                {
                    "org_id": org_id,
                },
            ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else _default_settings(org_id)


def _sender_status(org_id: str):
    route = resolve_outbound_whatsapp_sender(
        org_id=org_id,
        preferred_role="SUPPORT",
    )

    number = route.get("number") if route.get("resolved") else None

    return {
        "can_send": bool(route.get("resolved")),
        "strategy": route.get("strategy"),
        "display_phone_number": (
            number.get("display_phone_number")
            if number
            else None
        ),
        "phone_number_id": (
            number.get("phone_number_id")
            if number
            else None
        ),
        "has_access_token": bool(
            number.get("access_token")
            if number
            else None
        ),
    }


@router.get("/settings/ai")
def read_ai_settings(manager=Depends(get_current_manager)):
    org_id = manager["org_id"]
    settings = _get_or_create_ai_settings(org_id)

    return {
        "status": "ok",
        "settings": settings,
        "whatsapp_sender": _sender_status(org_id),
    }


@router.patch("/settings/ai")
def update_ai_settings(
    body: UpdateAISettingsRequest,
    manager=Depends(get_current_manager),
):
    org_id = manager["org_id"]
    _get_or_create_ai_settings(org_id)

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                update ai_settings
                set
                    enabled = coalesce(:enabled, enabled),
                    auto_reply_enabled = coalesce(
                        :auto_reply_enabled,
                        auto_reply_enabled
                    ),
                    auto_reply_min_confidence = coalesce(
                        :auto_reply_min_confidence,
                        auto_reply_min_confidence
                    ),
                    escalation_threshold = coalesce(
                        :escalation_threshold,
                        escalation_threshold
                    ),
                    updated_at = now()
                where org_id = :org_id
                returning *
            """),
            {
                "org_id": org_id,
                "enabled": body.enabled,
                "auto_reply_enabled": body.auto_reply_enabled,
                "auto_reply_min_confidence": body.auto_reply_min_confidence,
                "escalation_threshold": body.escalation_threshold,
            },
        ).fetchone()

        conn.commit()

    return {
        "status": "ok",
        "settings": dict(row._mapping) if row else None,
        "whatsapp_sender": _sender_status(org_id),
    }
