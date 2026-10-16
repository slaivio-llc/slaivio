from sqlalchemy import text

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
                    'AGENCY',
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


def link_clerk_organization(
    org_id: str,
    clerk_org_id: str,
):
    with engine.begin() as conn:
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
