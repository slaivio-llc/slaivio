from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.core.clerk_auth import verify_clerk_token
from app.db.manager_auth_repository import get_manager_by_id


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
)


def get_current_manager(
    token: str = Depends(oauth2_scheme),
):
    if token != "demo_token":
        payload = verify_clerk_token(token)
        clerk_org_id = (
            payload.get("org_id")
            or payload.get("orgId")
            or payload.get("azp")
        )
        email = (
            payload.get("email")
            or payload.get("email_address")
            or payload.get("primary_email_address")
        )

        return {
            "id": payload.get("sub"),
            "user_id": payload.get("sub"),
            "org_id": clerk_org_id,
            "tenant_org_id": clerk_org_id,
            "clerk_org_id": clerk_org_id,
            "email": email,
            "name": payload.get("name") or email,
            "full_name": payload.get("name") or email,
            "role": payload.get("role"),
        }

    manager = get_manager_by_id("demo_manager")

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="Manager not found",
        )

    return manager
