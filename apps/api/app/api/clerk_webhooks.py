import os

from fastapi import APIRouter, HTTPException, Request
from svix.webhooks import Webhook

from app.organizations.repositories.organization_repository import (
    get_organization_by_clerk_org_id,
)
from app.organizations.services.membership_role_service import sync_membership_with_role
from app.organizations.services.provisioning_service import provision_organization


router = APIRouter()
SECRET = os.getenv("CLERK_WEBHOOK_SECRET")


@router.post("/webhooks/clerk")
async def clerk_webhook(
    request: Request,
):
    payload = await request.body()

    if SECRET:
        try:
            event = Webhook(SECRET).verify(
                payload,
                dict(request.headers),
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail="invalid signature",
            ) from exc
    else:
        event = await request.json()

    event_type = event["type"]
    data = event["data"]

    if event_type in {"organization.created", "organization.updated"}:
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
        result = sync_membership_with_role(
            clerk_membership_id=data["id"],
            clerk_user_id=public_user_data.get("user_id") or data.get("public_user_id"),
            clerk_org_id=clerk_org_id,
            org_id=str(org["id"]),
            user_email=public_user_data.get("identifier"),
        )

        return {
            "status": "ok",
            "membership": result,
        }

    return {
        "status": "ignored",
        "event_type": event_type,
    }

