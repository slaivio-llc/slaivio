from fastapi import HTTPException

from app.entitlements.repositories.entitlement_repository import get_entitlement


def is_boolean_entitlement_enabled(
    org_id: str,
    entitlement_key: str,
):
    entitlement = get_entitlement(
        org_id=org_id,
        entitlement_key=entitlement_key,
    )

    if not entitlement or entitlement["entitlement_type"] != "BOOLEAN":
        return False

    return bool(entitlement["boolean_value"])


def get_limit_entitlement(
    org_id: str,
    entitlement_key: str,
):
    entitlement = get_entitlement(
        org_id=org_id,
        entitlement_key=entitlement_key,
    )

    if not entitlement or entitlement["entitlement_type"] != "LIMIT":
        return 0

    return int(entitlement["limit_value"] or 0)


def assert_entitlement_enabled(
    org_id: str,
    entitlement_key: str,
):
    if not is_boolean_entitlement_enabled(
        org_id=org_id,
        entitlement_key=entitlement_key,
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "entitlement_required",
                "entitlement": entitlement_key,
            },
        )

    return True


def assert_under_limit(
    org_id: str,
    entitlement_key: str,
    current_value: int,
):
    limit = get_limit_entitlement(
        org_id=org_id,
        entitlement_key=entitlement_key,
    )

    if current_value >= limit:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_limit_reached",
                "entitlement": entitlement_key,
                "limit": limit,
                "current": current_value,
            },
        )

    return True

