import os

import requests

from app.organizations.repositories.invitation_repository import (
    create_invitation_record,
    list_invitations,
)


CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")


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
        response = requests.post(
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
        clerk_data = response.json()

        if not response.ok:
            raise ValueError(clerk_data)

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

