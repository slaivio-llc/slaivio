from app.tenant.repositories.tenant_repository import (
    get_active_tenant,
    list_user_tenants,
    set_active_tenant,
)


def get_tenant_context(
    clerk_user_id: str,
):
    active = get_active_tenant(clerk_user_id)
    tenants = list_user_tenants(clerk_user_id)

    if not active and tenants:
        first = tenants[0]
        active = set_active_tenant(
            clerk_user_id=clerk_user_id,
            org_id=str(first["org_id"]),
            clerk_org_id=first.get("clerk_org_id"),
        )
        active = get_active_tenant(clerk_user_id) or active

    return {
        "active_tenant": active,
        "tenants": tenants,
    }


def switch_tenant(
    clerk_user_id: str,
    org_id: str,
):
    tenants = list_user_tenants(clerk_user_id)
    selected = next(
        (
            tenant
            for tenant in tenants
            if str(tenant["org_id"]) == str(org_id)
        ),
        None,
    )

    if not selected:
        raise PermissionError("User does not belong to this organization")

    return set_active_tenant(
        clerk_user_id=clerk_user_id,
        org_id=org_id,
        clerk_org_id=selected.get("clerk_org_id"),
    )

