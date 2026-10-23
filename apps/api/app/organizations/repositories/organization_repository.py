from sqlalchemy import text
from contextlib import contextmanager, nullcontext

from app.db.database import engine


def upsert_organization(
    clerk_org_id: str,
    organization_name: str,
):
    organization_code = clerk_org_id

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                insert into organizations (
                    id,
                    name,
                    organization_code,
                    organization_name,
                    organization_type,
                    clerk_org_id,
                    external_source,
                    provisioning_status,
                    onboarded_at
                )
                values (
                    :organization_code,
                    :organization_name,
                    :organization_code,
                    :organization_name,
                    'PARCEL_FREIGHT',
                    :clerk_org_id,
                    'CLERK',
                    'ACTIVE',
                    now()
                )
                on conflict (id)
                do update set
                    name = excluded.name,
                    organization_name = excluded.organization_name,
                    clerk_org_id = excluded.clerk_org_id,
                    external_source = 'CLERK',
                    provisioning_status = 'ACTIVE',
                    updated_at = now()
                returning *
            """),
            {
                "organization_code": organization_code,
                "organization_name": organization_name,
                "clerk_org_id": clerk_org_id,
            },
        ).fetchone()

        conn.commit()

        return dict(row._mapping) if row else None


def get_organization_by_clerk_org_id(
    clerk_org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from organizations
                where clerk_org_id = :clerk_org_id
                limit 1
            """),
            {
                "clerk_org_id": clerk_org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None


def get_organization_member(org_id: str, user_id: str):
    with engine.connect() as conn:
        row = conn.execute(text("""select role_code, status from organization_memberships
            where org_id=:org_id and clerk_user_id=:user_id limit 1"""),
            {"org_id": org_id, "user_id": user_id}).mappings().first()
        return dict(row) if row else None


def link_clerk_organization(
    org_id: str,
    clerk_org_id: str,
    connection=None,
):
    with (nullcontext(connection) if connection is not None else engine.begin()) as conn:
        linked = conn.execute(
            text("""
                select id
                from organizations
                where clerk_org_id = :clerk_org_id
                limit 1
            """),
            {"clerk_org_id": clerk_org_id},
        ).scalar_one_or_none()
        if linked and str(linked) != org_id:
            raise ValueError("clerk_organization_already_linked")

        organization = conn.execute(
            text("""
                update organizations
                set clerk_org_id = :clerk_org_id,
                    external_source = 'CLERK',
                    updated_at = now()
                where id = :org_id
                returning *
            """),
            {"org_id": org_id, "clerk_org_id": clerk_org_id},
        ).fetchone()
        if not organization:
            return None

        conn.execute(
            text("""
                update organization_memberships
                set clerk_org_id = :clerk_org_id,
                    updated_at = now()
                where org_id = :org_id
            """),
            {"org_id": org_id, "clerk_org_id": clerk_org_id},
        )
        conn.execute(
            text("""
                update tenant_sessions
                set clerk_org_id = :clerk_org_id
                where org_id = :org_id
            """),
            {"org_id": org_id, "clerk_org_id": clerk_org_id},
        )

        return dict(organization._mapping)


@contextmanager
def organization_clerk_link_lock(org_id: str):
    """Serialize lazy provisioning, including across API worker processes."""
    with engine.begin() as conn:
        conn.execute(text("select pg_advisory_xact_lock(hashtext(:key))"), {"key": f"clerk-link:{org_id}"})
        organization = conn.execute(text("select * from organizations where id=:org_id"), {"org_id": org_id}).mappings().first()
        owner = conn.execute(text("""select clerk_user_id from organization_memberships
            where org_id=:org_id and role_code='OWNER' and status='ACTIVE'
            order by created_at, id limit 1"""), {"org_id": org_id}).scalar_one_or_none()
        yield (dict(organization) if organization else None, owner, conn)


def get_organization(
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select *
                from organizations
                where id = :org_id
                limit 1
            """),
            {
                "org_id": org_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
