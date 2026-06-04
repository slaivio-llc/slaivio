from app.core.config import settings
from app.db.organization_whatsapp_repository import get_active_whatsapp_settings
from app.services.whatsapp_routing_service import resolve_outbound_number


def resolve_outbound_whatsapp_sender(
    org_id: str,
    preferred_role: str | None = None,
):
    route = resolve_outbound_number(
        org_id=org_id,
        preferred_role=preferred_role,
    )

    if route["resolved"]:
        return {
            "resolved": True,
            "strategy": route["strategy"],
            "number": route["number"],
        }

    org_settings = get_active_whatsapp_settings(
        org_id=org_id,
        provider="meta",
    )

    if org_settings and org_settings.get("meta_phone_number_id"):
        return {
            "resolved": True,
            "strategy": "legacy_meta_settings",
            "number": {
                "id": None,
                "phone_number_id": org_settings.get("meta_phone_number_id"),
                "display_phone_number": org_settings.get(
                    "meta_whatsapp_display_phone"
                ),
                "waba_id": org_settings.get("meta_waba_id"),
                "number_role": preferred_role or "PRIMARY",
                "access_token": settings.meta_wa_access_token,
            },
        }

    if settings.whatsapp_provider == "mock":
        return {
            "resolved": True,
            "strategy": "mock",
            "number": {
                "id": None,
                "phone_number_id": None,
                "display_phone_number": "MOCK_WHATSAPP",
                "waba_id": None,
                "number_role": preferred_role or "SUPPORT",
                "access_token": None,
            },
        }

    return {
        "resolved": False,
        "strategy": None,
        "number": None,
    }
