from fastapi import HTTPException

from app.permissions.repositories.permission_repository import (
    get_user_permissions,
    user_has_permission,
)


def assert_permission(
    user_id: str,
    org_id: str,
    permission_code: str,
):
    allowed = user_has_permission(
        user_id=user_id,
        org_id=org_id,
        permission_code=permission_code,
    )

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "permission_denied",
                "permission": permission_code,
            },
        )

    return True


def list_permissions_for_user(
    user_id: str,
    org_id: str,
):
    return get_user_permissions(
        user_id=user_id,
        org_id=org_id,
    )

