from sqlalchemy import text
from contextlib import nullcontext
from fastapi import HTTPException

from app.db.database import engine
from app.organizations.repositories.invitation_repository import (
    list_invitation_office_grants,
    mark_invitation_accepted,
)
from app.organizations.repositories.membership_repository import upsert_membership
from app.permissions.repositories.permission_repository import assign_role_to_user


def get_role_by_code(
    org_id: str,
    role_code: str,
    connection=None,
):
    with (nullcontext(connection) if connection is not None else engine.connect()) as conn:
        row = conn.execute(
            text("""
                select *
                from organization_roles
                where org_id = :org_id
                  and role_code = :role_code
                limit 1
            """),
            {
                "org_id": org_id,
                "role_code": role_code,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def sync_membership_with_role(
    clerk_membership_id: str,
    clerk_user_id: str,
    clerk_org_id: str,
    org_id: str,
    user_email: str | None = None,
    user_display_name: str | None = None,
    default_role_code: str = "SUPPORT",
):
    # Acceptance, role and physical/network office grants commit together. A
    # failed validation must not consume the invitation and lose its restrictions.
    with engine.begin() as conn:
        conn.execute(text('select pg_advisory_xact_lock(hashtextextended(:key,0))'),
                     {'key':f'agency-access:{org_id}'})
        return _sync_membership_with_role(conn,clerk_membership_id,clerk_user_id,
            clerk_org_id,org_id,user_email,user_display_name,default_role_code)


def _sync_membership_with_role(conn,clerk_membership_id,clerk_user_id,clerk_org_id,
                             org_id,user_email,user_display_name,default_role_code):
    current=conn.execute(text("""select role_code,status from organization_memberships
        where org_id=:o and clerk_user_id=:u for update"""),
        {'o':org_id,'u':clerk_user_id}).mappings().first()
    if current and current['status']!='ACTIVE':raise HTTPException(403,'organization_membership_inactive')
    if current:default_role_code=current['role_code']
    invitation = None

    if user_email:
        invitation = mark_invitation_accepted(
            email=user_email,
            org_id=org_id,
            connection=conn,
        )

    # Provider membership alone is not an agency role grant. In particular a
    # locally revoked invitation must never fall back to a broad Support role.
    # OWNER provisioning is an explicit trusted-server operation, not client input.
    if not invitation and not current and default_role_code!='OWNER':
        raise HTTPException(403,'invitation_membership_not_confirmed')
    role_code = invitation["role_code"] if invitation else default_role_code

    membership = upsert_membership(
        clerk_membership_id=clerk_membership_id,
        clerk_user_id=clerk_user_id,
        clerk_org_id=clerk_org_id,
        org_id=org_id,
        role_code=role_code,
        member_email=user_email,
        member_display_name=user_display_name,
        connection=conn,
        **({'office_access_scope':invitation.get('office_access_scope','ALL_OFFICES'),
            'office_ids':invitation.get('office_ids',[])} if invitation else {}),
    )
    if membership is None:raise HTTPException(403,'organization_membership_inactive')

    role = get_role_by_code(
        org_id=org_id,
        role_code=role_code,
        connection=conn,
    )

    assignment = None

    if role:
        assignment = assign_role_to_user(
            user_id=clerk_user_id,
            org_id=org_id,
            role_id=str(role["id"]),
            connection=conn,
        )

    network_memberships = []
    if invitation:
        for grant in list_invitation_office_grants(str(invitation["id"]),connection=conn):
            if grant["org_id"] == org_id:
                continue
            granted_membership = upsert_membership(
                clerk_membership_id=f"network_invitation_{invitation['id']}_{grant['org_id']}",
                clerk_user_id=clerk_user_id,
                clerk_org_id=grant["clerk_org_id"],
                org_id=grant["org_id"],
                role_code=grant["role_code"],
                member_email=user_email,
                member_display_name=user_display_name,
                connection=conn,
            )
            granted_role = get_role_by_code(grant["org_id"], grant["role_code"],connection=conn)
            if granted_role:
                assign_role_to_user(
                    user_id=clerk_user_id,
                    org_id=grant["org_id"],
                    role_id=str(granted_role["id"]),
                    connection=conn,
                )
            network_memberships.append(granted_membership)

    return {
        "membership": membership,
        "role_code": role_code,
        "role": role,
        "assignment": assignment,
        "network_memberships": network_memberships,
    }

