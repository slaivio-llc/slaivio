from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_manager
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.organizations.repositories.organization_repository import get_organization
from app.organizations.services.invitation_service import (
    get_org_invitations,
    invite_user_to_org,
)


router = APIRouter()


class InviteUserRequest(BaseModel):
    email: str
    role_code: str


@router.post(
    "/organization/invitations",
    dependencies=[
        Depends(require_permission("team.write")),
    ],
)
def invite_user(
    body: InviteUserRequest,
    manager=Depends(get_current_manager),
    tenant=Depends(get_current_tenant),
):
    org = get_organization(tenant["org_id"])
    clerk_org_id = (
        tenant.get("clerk_org_id")
        or manager.get("clerk_org_id")
        or (org or {}).get("clerk_org_id")
    )

    if not clerk_org_id:
        raise HTTPException(
            status_code=400,
            detail="missing_clerk_organization_id",
        )

    return {
        "status": "ok",
        **invite_user_to_org(
            org_id=tenant["org_id"],
            clerk_org_id=clerk_org_id,
            email=body.email,
            role_code=body.role_code,
            invited_by_id=manager.get("user_id") or manager.get("id"),
            invited_by_name=manager.get("name") or manager.get("email"),
        ),
    }


@router.get(
    "/organization/invitations",
    dependencies=[
        Depends(require_permission("team.read")),
    ],
)
def invitations(
    tenant=Depends(get_current_tenant),
):
    return {
        "status": "ok",
        "invitations": get_org_invitations(
            org_id=tenant["org_id"],
        ),
    }

