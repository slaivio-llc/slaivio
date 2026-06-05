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

