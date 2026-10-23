from fastapi import Depends, HTTPException, Request

from app.core.auth import get_current_manager
from app.tenant.services.tenant_service import ensure_personal_tenant, get_tenant_context


def get_current_tenant(
    manager=Depends(get_current_manager),
    request:Request=None,
):
    user_id = (
        manager.get("user_id")
        or manager.get("id")
    )
    context = get_tenant_context(user_id)
    active = context.get("active_tenant")

    if not active:
        context = ensure_personal_tenant(manager)
        active = context.get("active_tenant")

    if not active:
        raise HTTPException(
            status_code=403,
            detail="No verified active organization membership",
        )

    if active.get("organization_status", "ACTIVE") != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="organization_access_suspended",
        )

    if active.get("require_mfa") and not manager.get("mfa_verified"):
        raise HTTPException(status_code=403, detail="organization_mfa_required")

    if request is not None and 'subscription_status' in active:
        # Keep billing, onboarding, account settings and authorization readable
        # after expiry, so an owner can renew without a redirect deadlock.
        recovery_prefixes=('/billing','/organization/admin','/api/onboarding','/onboarding','/entitlements','/features','/permissions','/me','/tenant')
        path=request.url.path
        recovery=any(path==prefix or path.startswith(prefix+'/') for prefix in recovery_prefixes)
        if not recovery:
            from app.billing.services.saspay_service import subscription_access
            subscription={'status':active.get('subscription_status'),'ends_at':active.get('subscription_ends_at'),
                          'trial_ends_at':active.get('subscription_trial_ends_at'),'grace_until':active.get('subscription_grace_until')}
            if not subscription_access(subscription):
                raise HTTPException(402,'subscription_expired')

    return {
        "org_id": active["org_id"],
        "organization_name": active.get("organization_name"),
        "organization_type": active.get("organization_type"),
        "clerk_org_id": active.get("clerk_org_id"),
        "user_id": user_id,
        "actor_name": manager.get("full_name") or manager.get("name") or manager.get("email"),
        "actor_role": active.get("role_code") or manager.get("role"),
        "group_id": active.get("group_id"),
        "network_name": active.get("network_name"),
        "workspace_kind": active.get("workspace_kind") or "OFFICE",
        "country": active.get("country"),
        "city": active.get("city"),
    }
