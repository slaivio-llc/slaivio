from fastapi import HTTPException

from app.features.repositories.feature_repository import is_feature_enabled_for_org


def assert_feature_enabled(
    org_id: str,
    flag_key: str,
):
    enabled = is_feature_enabled_for_org(
        org_id=org_id,
        flag_key=flag_key,
    )

    if not enabled:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "feature_disabled",
                "feature": flag_key,
            },
        )

    return True

