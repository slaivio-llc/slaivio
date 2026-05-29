from app.db.whatsapp_routing_repository import (
    find_number_by_phone_number_id,
    get_default_number_for_org,
    get_numbers_by_role,
)


def resolve_inbound_route(
    provider_phone_number_id: str,
):
    number = find_number_by_phone_number_id(
        provider_phone_number_id
    )

    if not number:
        return {
            "resolved": False,
            "reason": "number_not_found",
            "number": None,
        }

    return {
        "resolved": True,
        "number": number,
        "org_id": number["org_id"],
        "number_role": number["number_role"],
        "waba_id": number["waba_id"],
    }


def resolve_outbound_number(
    org_id: str,
    preferred_role: str | None = None,
):
    if preferred_role:
        numbers = get_numbers_by_role(
            org_id=org_id,
            number_role=preferred_role,
        )

        if numbers:
            return {
                "resolved": True,
                "strategy": "role",
                "number": numbers[0],
            }

    default_number = get_default_number_for_org(
        org_id
    )

    if default_number:
        return {
            "resolved": True,
            "strategy": "default",
            "number": default_number,
        }

    return {
        "resolved": False,
        "strategy": None,
        "number": None,
    }
