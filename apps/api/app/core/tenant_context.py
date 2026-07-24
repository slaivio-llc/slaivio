from fastapi import Depends, HTTPException

from app.core.auth import get_current_manager
from app.organizations.services.membership_role_service import sync_membership_with_role
from app.organizations.services.provisioning_service import provision_organization
from app.tenant.repositories.tenant_repository import set_active_tenant
from app.tenant.services.tenant_service import get_tenant_context


def _provision_personal_tenant(manager: dict):
    user_id = manager.get("user_id") or manager.get("id")
    if not user_id:
        return None

    email = manager.get("email")
    display_name = (
        manager.get("full_name")
        or manager.get("name")
        or email
        or "Nouvelle agence"
    )
    clerk_org_id = f"personal_{user_id}"
    org = provision_organization(
        clerk_org_id=clerk_org_id,
        organization_name=f"Espace de {display_name}",
    )
    if not org:
        return None

    sync_membership_with_role(
        clerk_membership_id=f"personal_membership_{user_id}",
        clerk_user_id=user_id,
        clerk_org_id=clerk_org_id,
        org_id=str(org["id"]),
        user_email=email,
        default_role_code="OWNER",
    )
    set_active_tenant(
        clerk_user_id=user_id,
        org_id=str(org["id"]),
        clerk_org_id=clerk_org_id,
    )
    return get_tenant_context(user_id).get("active_tenant")


def get_current_tenant(
    manager=Depends(get_current_manager),
):
    user_id = (
        manager.get("user_id")
        or manager.get("id")
    )
    context = get_tenant_context(user_id)
    active = context.get("active_tenant")

    if not active:
        fallback_org_id = (
            manager.get("tenant_org_id")
            or manager.get("org_id")
        )

        if fallback_org_id:
            return {
                "org_id": fallback_org_id,
                "organization_name": manager.get("org_code") or fallback_org_id,
                "clerk_org_id": manager.get("clerk_org_id"),
                "user_id": user_id,
            }

        active = _provision_personal_tenant(manager)
        if active:
            return {
                "org_id": active["org_id"],
                "organization_name": active.get("organization_name"),
                "clerk_org_id": active.get("clerk_org_id"),
                "user_id": user_id,
            }

        raise HTTPException(
            status_code=403,
            detail="No active tenant",
        )

    return {
        "org_id": active["org_id"],
        "organization_name": active.get("organization_name"),
        "clerk_org_id": active.get("clerk_org_id"),
        "user_id": user_id,
    }
