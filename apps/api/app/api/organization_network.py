from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_current_manager
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.organization_network import repository as repo
from app.organizations.repositories.organization_repository import get_organization
from app.organizations.services.invitation_service import invite_user_to_org


router = APIRouter(prefix="/organization/network", tags=["organization-network"])


class NetworkSetup(BaseModel):
    network_name: str = Field(min_length=2, max_length=120)
    country_code: str = Field(min_length=2, max_length=3)
    country_name: str = Field(min_length=2, max_length=80)
    currency_code: str = Field(default="USD", min_length=3, max_length=3)
    timezone: str = Field(default="UTC", min_length=3, max_length=80)


class OfficeCreate(BaseModel):
    organization_name: str = Field(min_length=2, max_length=120)
    office_code: str = Field(pattern=r"^[A-Za-z0-9_-]{2,30}$")
    country: str = Field(min_length=2, max_length=80)
    country_code: str = Field(min_length=2, max_length=3)
    city: str = Field(min_length=2, max_length=100)
    currency_code: str = Field(default="USD", min_length=3, max_length=3)
    timezone: str = Field(default="UTC", min_length=3, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=160)


class OfficeGrant(BaseModel):
    user_id: str = Field(min_length=1, max_length=160)
    office_ids: list[str] = Field(min_length=1, max_length=50)
    role_code: str = Field(pattern=r"^(MANAGER|OPERATOR|WAREHOUSE|SUPPORT|FINANCE)$")


class NetworkInvitation(BaseModel):
    email: str = Field(min_length=5, max_length=160, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    office_ids: list[str] = Field(min_length=1, max_length=50)
    role_code: str = Field(pattern=r"^(MANAGER|OPERATOR|WAREHOUSE|SUPPORT|FINANCE)$")


def actor_id(manager: dict) -> str:
    return str(manager.get("user_id") or manager.get("id"))


@router.get("", dependencies=[Depends(require_permission("network.read"))])
def get_network(tenant=Depends(get_current_tenant)):
    return {"status": "ok", **repo.context(tenant["org_id"], tenant["user_id"])}


@router.post("/setup", dependencies=[Depends(require_permission("organization.manage"))])
def setup_network(body: NetworkSetup, tenant=Depends(get_current_tenant), manager=Depends(get_current_manager)):
    return {"status": "ok", **repo.setup(tenant["org_id"], actor_id(manager), **body.model_dump())}


@router.post("/offices", dependencies=[Depends(require_permission("network.offices.manage"))])
def create_office(body: OfficeCreate, tenant=Depends(get_current_tenant), manager=Depends(get_current_manager)):
    return {"status": "ok", **repo.create_office(tenant["org_id"], manager, body.model_dump())}


@router.post("/members/grant", dependencies=[Depends(require_permission("network.members.manage"))])
def grant_member(body: OfficeGrant, tenant=Depends(get_current_tenant), manager=Depends(get_current_manager)):
    return {"status": "ok", "grant": repo.grant_offices(tenant["org_id"], actor_id(manager), body.user_id, body.office_ids, body.role_code)}


@router.get("/invitations", dependencies=[Depends(require_permission("network.members.manage"))])
def network_invitations(tenant=Depends(get_current_tenant)):
    return {"status": "ok", "invitations": repo.list_network_invitations(tenant["org_id"])}


@router.post("/invitations", dependencies=[Depends(require_permission("network.members.manage"))])
def invite_network_member(
    body: NetworkInvitation,
    tenant=Depends(get_current_tenant),
    manager=Depends(get_current_manager),
):
    repo.validate_invitation_offices(tenant["org_id"], body.office_ids)
    organization = get_organization(tenant["org_id"])
    clerk_org_id = tenant.get("clerk_org_id") or (organization or {}).get("clerk_org_id")
    if not clerk_org_id:
        raise HTTPException(400, "missing_clerk_organization_id")
    result = invite_user_to_org(
        org_id=tenant["org_id"], clerk_org_id=clerk_org_id,
        email=body.email.strip().lower(), role_code=body.role_code,
        invited_by_id=actor_id(manager),
        invited_by_name=manager.get("full_name") or manager.get("name") or manager.get("email"),
    )
    invitation = result.get("invitation") or {}
    if not invitation.get("id"):
        raise HTTPException(500, "network_invitation_record_not_created")
    attached = repo.attach_invitation_offices(
        tenant["org_id"], actor_id(manager), str(invitation.get("id")),
        body.office_ids, body.role_code,
    )
    return {"status": "ok", "invitation": attached, "delivery": result.get("clerk")}
