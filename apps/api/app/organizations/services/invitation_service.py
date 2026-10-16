import os

import requests

from app.organizations.repositories.invitation_repository import (
    create_invitation_record,
    list_invitations,
)


CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")


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


def invite_user_to_org(
    org_id: str,
    clerk_org_id: str,
    email: str,
    role_code: str,
    invited_by_id: str | None = None,
    invited_by_name: str | None = None,
):
    clerk_data = {
        "mode": "local_record_only",
    }
    clerk_invitation_id = None

    if CLERK_SECRET_KEY and clerk_org_id:
        response = _post_invitation(
            f"https://api.clerk.com/v1/organizations/{clerk_org_id}/invitations",
            headers={
                "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "email_address": email,
                "role": "basic_member",
            },
            timeout=30,
        )
        try:
            clerk_data = response.json()
        except ValueError as exc:
            raise InvitationProviderError("invitation_provider_invalid_response") from exc

        if not response.ok:
            clerk_errors = clerk_data.get("errors", []) if isinstance(clerk_data, dict) else []
            error_codes = {
                error.get("code")
                for error in clerk_errors
                if isinstance(error, dict)
            }
            if "organization_not_enabled_in_instance" in error_codes:
                raise InvitationProviderError("clerk_organizations_not_enabled", 503)
            raise InvitationProviderError("invitation_delivery_failed")

        clerk_invitation_id = clerk_data.get("id")

    invitation = create_invitation_record(
        org_id=org_id,
        email=email,
        role_code=role_code,
        clerk_invitation_id=clerk_invitation_id,
        invited_by_id=invited_by_id,
        invited_by_name=invited_by_name,
    )

    return {
        "clerk": clerk_data,
        "invitation": invitation,
    }


def get_org_invitations(
    org_id: str,
):
    return list_invitations(org_id)
