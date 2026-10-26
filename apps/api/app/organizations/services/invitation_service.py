import os
import re
import hashlib
import logging

import requests
from app.billing.services.capacity import invitation_capacity
from app.core.config import settings
from app.organizations.repositories.organization_repository import (
    link_clerk_organization, organization_clerk_link_lock,
)

from app.organizations.repositories.invitation_repository import (
    create_invitation_record,
    list_invitations,
)


CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
logger = logging.getLogger(__name__)


class InvitationProviderError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _post_invitation(*args, **kwargs):
    try:
        return requests.post(*args, **kwargs)
    except requests.RequestException as exc:
        raise InvitationProviderError("invitation_provider_unavailable") from exc


def _provider_data(response):
    try:
        data = response.json()
    except ValueError as exc:
        raise InvitationProviderError("invitation_provider_invalid_response") from exc
    if not isinstance(data, dict):
        raise InvitationProviderError("invitation_provider_invalid_response")
    if not response.ok:
        codes = {error.get("code") for error in data.get("errors", []) if isinstance(error, dict)}
        logger.warning("Clerk invitation request rejected: status=%s codes=%s", getattr(response, "status_code", None), sorted(str(code) for code in codes))
        known = {
            "organization_slugs_disabled": ("clerk_organization_slugs_disabled", 503),
            "organization_not_enabled_in_instance": ("clerk_organizations_not_enabled", 503),
            "organization_invitation_not_unique": ("invitation_already_pending", 409),
            "organization_membership_quota_exceeded": ("invitation_member_limit_reached", 409),
            "organization_quota_exceeded": ("invitation_organization_limit_reached", 409),
            "form_identifier_exists": ("invitation_member_already_exists", 409),
        }
        for code, (detail, status) in known.items():
            if code in codes:
                raise InvitationProviderError(detail, status)
        status = getattr(response, "status_code", None)
        if status in (401, 403):
            raise InvitationProviderError("invitation_provider_configuration_invalid", 503)
        if status == 404:
            raise InvitationProviderError("invitation_organization_not_found", 409)
        if status == 429:
            raise InvitationProviderError("invitation_rate_limited", 429)
        raise InvitationProviderError("invitation_delivery_failed")
    return data


def _local_organization_id(value):
    return value.startswith("personal_") or bool(re.fullmatch(r"org_[0-9a-f]{32}", value))


def _ensure_clerk_organization(org_id, clerk_org_id):
    if not _local_organization_id(clerk_org_id):
        return clerk_org_id
    with organization_clerk_link_lock(org_id) as (organization, owner, connection):
        if not organization or not owner:
            raise InvitationProviderError("invitation_organization_owner_required", 409)
        current = organization.get("clerk_org_id") or ""
        if current and not _local_organization_id(current):
            return current
        # A stable slug recovers a previous remote creation after a DB/network
        # failure. Never attach an unrelated manually created organization by name.
        slug = "slaivio-" + hashlib.sha256(org_id.encode()).hexdigest()[:24]
        headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}", "Content-Type": "application/json"}
        try:
            response = requests.get(f"https://api.clerk.com/v1/organizations/{slug}", headers=headers, timeout=15)
        except requests.RequestException as exc:
            raise InvitationProviderError("invitation_provider_unavailable") from exc
        if response.status_code == 404:
            response = _post_invitation("https://api.clerk.com/v1/organizations", headers=headers, json={
                "name": organization.get("organization_name") or organization.get("name") or "Agence SLAIVIO",
                "slug": slug, "created_by": owner, "private_metadata": {"slaivio_org_id": org_id},
            }, timeout=15)
        remote = _provider_data(response)
        if (remote.get("private_metadata") or {}).get("slaivio_org_id") != org_id or not remote.get("id"):
            raise InvitationProviderError("invitation_organization_link_invalid", 409)
        link_clerk_organization(org_id, remote["id"], connection=connection)
        return remote["id"]


def invite_user_to_org(
    org_id: str,
    clerk_org_id: str,
    email: str,
    role_code: str,
    invited_by_id: str | None = None,
    invited_by_name: str | None = None,
):
    if not CLERK_SECRET_KEY:
        raise InvitationProviderError("invitation_provider_not_configured", 503)
    if not clerk_org_id:
        raise InvitationProviderError("invitation_organization_not_found", 409)
    clerk_org_id = _ensure_clerk_organization(org_id, clerk_org_id)
    email = email.strip().lower()
    redirect_url = settings.public_web_base_url.rstrip("/") + "/app"
    with invitation_capacity(org_id,email) as capacity_connection:
        response = _post_invitation(
                f"https://api.clerk.com/v1/organizations/{clerk_org_id}/invitations",
                headers={
                    "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "email_address": email,
                    "role": "org:member",
                    "redirect_url": redirect_url,
                },
                timeout=30,
        )
        clerk_data = _provider_data(response)
        clerk_invitation_id = clerk_data.get("id")
        if not clerk_invitation_id:
            raise InvitationProviderError("invitation_provider_invalid_response")

        invitation = create_invitation_record(
            org_id=org_id,
            email=email,
            role_code=role_code,
            clerk_invitation_id=clerk_invitation_id,
            invited_by_id=invited_by_id,
            invited_by_name=invited_by_name,
            connection=capacity_connection,
        )

    return {
        "clerk": clerk_data,
        "invitation": invitation,
    }


def get_org_invitations(
    org_id: str,
):
    return list_invitations(org_id)
