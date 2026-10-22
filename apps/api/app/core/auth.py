from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from app.core.clerk_auth import verify_clerk_token

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/sign-in",
)


def get_current_manager(
    token: str = Depends(oauth2_scheme),
):
    payload = verify_clerk_token(token)
    clerk_org_id = (
        payload.get("org_id")
        or payload.get("orgId")
    )
    email = (
        payload.get("email")
        or payload.get("email_address")
        or payload.get("primary_email_address")
    )

    if not payload.get("sub"):
        raise HTTPException(
            status_code=401,
            detail="Invalid Clerk token",
        )

    verification_age = payload.get("fva")
    mfa_verified = (isinstance(verification_age, list) and len(verification_age) == 2
                    and type(verification_age[1]) is int and verification_age[1] >= 0)
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
        "mfa_verified": mfa_verified,
    }
