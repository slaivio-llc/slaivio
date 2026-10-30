from sqlalchemy import text
from contextlib import nullcontext

from app.db.database import engine


def create_invitation_record(
    org_id: str,
    email: str,
    role_code: str,
    clerk_invitation_id: str | None = None,
    invited_by_id: str | None = None,
    invited_by_name: str | None = None,
    connection=None,
    office_access_scope='ALL_OFFICES',
    office_ids=None,
):
    with (nullcontext(connection) if connection is not None else engine.begin()) as conn:
        row = conn.execute(
            text("""
                insert into organization_invitations (
                    org_id,
                    clerk_invitation_id,
                    email,
                    role_code,
                    invited_by_id,
                    invited_by_name,office_access_scope,office_ids
                )
                values (
                    :org_id,
                    :clerk_invitation_id,
                    :email,
                    :role_code,
                    :invited_by_id,
                    :invited_by_name,:office_access_scope,cast(:office_ids as uuid[])
                )
                returning *
            """),
            {
                "org_id": org_id,
                "clerk_invitation_id": clerk_invitation_id,
                "email": email,
                "role_code": role_code,
                "invited_by_id": invited_by_id,
                "invited_by_name": invited_by_name,
                'office_access_scope':office_access_scope,
                'office_ids':office_ids if office_access_scope=='SELECTED_OFFICES' else [],
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def mark_invitation_accepted(
    clerk_invitation_id: str | None = None,
    email: str | None = None,
    org_id: str | None = None,
    connection=None,
):
    with (nullcontext(connection) if connection is not None else engine.begin()) as conn:
        if clerk_invitation_id:
            row = conn.execute(
                text("""
                    update organization_invitations
                    set
                        status = 'ACCEPTED',
                        accepted_at = now()
                    where clerk_invitation_id = :clerk_invitation_id
                      and status='PENDING'
                      and (:org_id is null or org_id = :org_id)
                    returning *
                """),
                {
                    "clerk_invitation_id": clerk_invitation_id,
                    "org_id": org_id,
                },
            ).fetchone()
        else:
            row = conn.execute(
                text("""
                    update organization_invitations
                    set
                        status = 'ACCEPTED',
                        accepted_at = now()
                    where id = (
                        select id
                        from organization_invitations
                        where lower(email) = lower(:email)
                          and status = 'PENDING'
                          and (:org_id is null or org_id = :org_id)
                        order by created_at desc
                        limit 1
                    )
                    and status='PENDING'
                    returning *
                """),
                {
                    "email": email,
                    "org_id": org_id,
                },
            ).fetchone()

        return dict(row._mapping) if row else None


def list_invitations(
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select *
                from organization_invitations
                where org_id = :org_id
                order by created_at desc
            """),
            {
                "org_id": org_id,
            },
        ).fetchall()

        return [dict(row._mapping) for row in rows]


def list_invitation_office_grants(invitation_id: str, connection=None):
    with (nullcontext(connection) if connection is not None else engine.connect()) as conn:
        rows = conn.execute(
            text("""
                select grant_row.org_id, grant_row.role_code, organization.clerk_org_id
                from organization_network_invitation_offices grant_row
                join organizations organization on organization.id = grant_row.org_id
                where grant_row.invitation_id = cast(:invitation_id as uuid)
                order by organization.country, organization.city, organization.organization_name
            """),
            {"invitation_id": invitation_id},
        ).fetchall()
        return [dict(row._mapping) for row in rows]

