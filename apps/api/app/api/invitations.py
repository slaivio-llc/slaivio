from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel,Field
from typing import Literal
from uuid import UUID

from app.core.auth import get_current_manager
from app.organizations.services.staff_roles import StaffRole
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.organizations.repositories.organization_repository import get_organization
from app.organizations.services.invitation_service import (
    InvitationProviderError,
    get_org_invitations,
    invite_user_to_org,
)


router = APIRouter()

class CompleteInvitationRequest(BaseModel):
    org_id:str|None=Field(default=None,max_length=160)

@router.post('/organization/invitations/complete')
def complete_invitation(body:CompleteInvitationRequest,manager=Depends(get_current_manager)):
    from app.organizations.services.invitation_completion import complete_invitation
    return complete_invitation(manager,body.org_id)


class InviteUserRequest(BaseModel):
    email: str=Field(min_length=3,max_length=254,pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    role_code: StaffRole
    office_access_scope:Literal['ALL_OFFICES','SELECTED_OFFICES']='ALL_OFFICES'
    office_ids:list[UUID]=Field(default_factory=list,max_length=100)


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
        (org or {}).get("clerk_org_id")
        or tenant.get("clerk_org_id")
    )

    if not clerk_org_id:
        raise HTTPException(
            status_code=400,
            detail="missing_clerk_organization_id",
        )

    try:
        invitation = invite_user_to_org(
            org_id=tenant["org_id"],
            clerk_org_id=clerk_org_id,
            email=body.email,
            role_code=body.role_code,
            invited_by_id=manager.get("user_id") or manager.get("id"),
            invited_by_name=manager.get("name") or manager.get("email"),
            office_access_scope=body.office_access_scope,
            office_ids=[str(value) for value in body.office_ids],
        )
    except InvitationProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    return {"status": "ok", **invitation}


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
