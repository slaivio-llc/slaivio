from fastapi import APIRouter, HTTPException, Request
from svix.webhooks import Webhook

from app.organizations.repositories.organization_repository import (
    get_organization_by_clerk_org_id,
    get_organization, link_clerk_organization, get_organization_member,
)
from app.organizations.services.membership_role_service import sync_membership_with_role
from app.organizations.services.provisioning_service import provision_organization
from app.core.config import settings


router = APIRouter()
SECRET = settings.clerk_webhook_secret


@router.post("/webhooks/clerk")
async def clerk_webhook(
    request: Request,
):
    payload = await request.body()

    if not SECRET:
        raise HTTPException(status_code=503, detail="clerk_webhook_not_configured")
    try:
        event = Webhook(SECRET).verify(payload, dict(request.headers))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid signature") from exc

    event_type = event["type"]
    data = event["data"]

    if event_type == "user.created":
        user_id = data["id"]
        email_addresses = data.get("email_addresses") or []
        email = email_addresses[0].get("email_address") if email_addresses else None
        display_name = " ".join(
            part for part in [data.get("first_name"), data.get("last_name")] if part
        ).strip() or email or "Nouvelle agence"
        personal_clerk_org_id = f"personal_{user_id}"
        org = get_organization(personal_clerk_org_id) or provision_organization(
            clerk_org_id=personal_clerk_org_id,
            organization_name=f"Espace de {display_name}",
        )
        membership = sync_membership_with_role(
            clerk_membership_id=f"personal_membership_{user_id}",
            clerk_user_id=user_id,
            clerk_org_id=org.get("clerk_org_id") or personal_clerk_org_id,
            org_id=str(org["id"]),
            user_email=email,
            user_display_name=display_name,
            default_role_code="OWNER",
        )
        return {
            "status": "ok",
            "organization": org,
            "membership": membership,
        }

    if event_type in {"organization.created", "organization.updated"}:
        # Backend-created Clerk organizations reference an existing SLAIVIO
        # agency. Do not create a second agency when its webhook arrives.
        local_id = (data.get("private_metadata") or {}).get("slaivio_org_id")
        if local_id:
            if not get_organization(local_id):
                raise HTTPException(409, "clerk_organization_link_target_missing")
            org = link_clerk_organization(local_id, data["id"])
            return {"status": "ok", "organization": org}
        existing = get_organization_by_clerk_org_id(data["id"])
        if existing:
            return {"status": "ok", "organization": existing}
        org = provision_organization(
            clerk_org_id=data["id"],
            organization_name=data["name"],
        )

        return {
            "status": "ok",
            "organization": org,
        }

    if event_type in {
        "organizationMembership.created",
        "organizationMembership.updated",
    }:
        clerk_org_id = data["organization"]["id"]
        org = get_organization_by_clerk_org_id(clerk_org_id)

        if not org:
            return {
                "status": "ignored",
                "reason": "organization_not_found",
            }

        public_user_data = data.get("public_user_data") or {}
        member_name = " ".join(
            part for part in [public_user_data.get("first_name"), public_user_data.get("last_name")] if part
        ).strip() or public_user_data.get("identifier")
        user_id = public_user_data.get("user_id") or data.get("public_user_id")
        existing_member = get_organization_member(str(org["id"]), user_id)
        if existing_member and existing_member["status"] != "ACTIVE":
            return {"status": "ignored", "reason": "membership_inactive"}
        result = sync_membership_with_role(
            clerk_membership_id=data["id"],
            clerk_user_id=user_id,
            clerk_org_id=clerk_org_id,
            org_id=str(org["id"]),
            user_email=public_user_data.get("identifier"),
            user_display_name=member_name,
            default_role_code=existing_member["role_code"] if existing_member else "SUPPORT",
        )

        return {
            "status": "ok",
            "membership": result,
        }

    return {
        "status": "ignored",
        "event_type": event_type,
    }

