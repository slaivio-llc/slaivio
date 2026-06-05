from sqlalchemy import text

from app.db.database import engine


def user_belongs_to_org(
    clerk_user_id: str,
    org_id: str,
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                select 1
                from organization_memberships
                where clerk_user_id = :clerk_user_id
                  and org_id = :org_id
                  and status = 'ACTIVE'
                limit 1
            """),
            {
                "clerk_user_id": clerk_user_id,
                "org_id": org_id,
            },
        ).fetchone()

        return row is not None

