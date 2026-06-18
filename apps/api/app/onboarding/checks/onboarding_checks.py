from app.onboarding.repositories.onboarding_repository import (
    count_rows,
    get_agency_profile,
)


ONBOARDING_STEPS = [
    "AGENCY_PROFILE",
    "WORKSPACES",
    "WAREHOUSES",
    "SHIPPING_SERVICES",
    "PRICING",
    "GOODS_RULES",
    "NOTIFICATIONS",
    "TEAM",
]


def evaluate_onboarding(org_id: str):
    completed = []
    missing = []

    profile = get_agency_profile(org_id)

    if profile and profile.get("brand_name") and profile.get("country"):
        completed.append("AGENCY_PROFILE")
    else:
        missing.append("AGENCY_PROFILE")

    workspaces_count = count_rows("workspaces", org_id)

    _append_check(
        completed,
        missing,
        "WORKSPACES",
        workspaces_count > 0,
    )
    _append_check(
        completed,
        missing,
        "WAREHOUSES",
        count_rows("warehouses", org_id) > 0,
    )
    _append_check(
        completed,
        missing,
        "SHIPPING_SERVICES",
        count_rows("shipping_services", org_id) > 0,
    )
    _append_check(
        completed,
        missing,
        "PRICING",
        count_rows("pricing_components", org_id) > 0,
    )
    _append_check(
        completed,
        missing,
        "GOODS_RULES",
        count_rows("advanced_goods_rules", org_id) > 0,
    )
    _append_check(
        completed,
        missing,
        "NOTIFICATIONS",
        count_rows("notification_policies", org_id) > 0,
    )

    # Full team invite validation belongs to Bloc 1 workspace/user management.
    _append_check(completed, missing, "TEAM", workspaces_count > 0)

    status = "COMPLETED" if not missing else "IN_PROGRESS"
    current_step = missing[0] if missing else "COMPLETED"

    return {
        "status": status,
        "current_step": current_step,
        "completed_steps": completed,
        "missing_steps": missing,
    }


def _append_check(
    completed: list[str],
    missing: list[str],
    step_key: str,
    is_complete: bool,
):
    if is_complete:
        completed.append(step_key)
    else:
        missing.append(step_key)
