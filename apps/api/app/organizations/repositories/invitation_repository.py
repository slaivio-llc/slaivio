from sqlalchemy import text

from app.db.database import engine


def create_invitation_record(
    org_id: str,
    email: str,
    role_code: str,
    clerk_invitation_id: str | None = None,
    invited_by_id: str | None = None,
    invited_by_name: str | None = None,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into organization_invitations (
                    org_id,
                    clerk_invitation_id,
                    email,
                    role_code,
                    invited_by_id,
                    invited_by_name
                )
                values (
                    :org_id,
                    :clerk_invitation_id,
                    :email,
                    :role_code,
                    :invited_by_id,
                    :invited_by_name
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
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def mark_invitation_accepted(
    clerk_invitation_id: str | None = None,
    email: str | None = None,
):
    with engine.connect() as conn:
        if clerk_invitation_id:
            row = conn.execute(
                text("""
                    update organization_invitations
                    set
                        status = 'ACCEPTED',
                        accepted_at = now()
                    where clerk_invitation_id = :clerk_invitation_id
                    returning *
                """),
                {
                    "clerk_invitation_id": clerk_invitation_id,
                },
            ).fetchone()
        else:
            row = conn.execute(
                text("""
                    update organization_invitations
                    set
                        status = 'ACCEPTED',
                        accepted_at = now()
                    where email = :email
                      and status = 'PENDING'
                    returning *
                """),
                {
                    "email": email,
                },
            ).fetchone()

        conn.commit()

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

