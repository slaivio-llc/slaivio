from sqlalchemy import text

from app.db.database import engine


def get_user_permissions(
    user_id: str,
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select distinct
                    p.permission_code
                from user_role_assignments ura
                join organization_roles r
                    on r.id = ura.role_id
                join role_permissions rp
                    on rp.role_id = r.id
                join permissions p
                    on p.id = rp.permission_id
                where ura.user_id = :user_id
                  and ura.org_id = :org_id
                  and ura.assignment_status = 'ACTIVE'
                order by p.permission_code
            """),
            {
                "user_id": user_id,
                "org_id": org_id,
            },
        ).fetchall()

        return [
            row._mapping["permission_code"]
            for row in rows
        ]


def user_has_permission(
    user_id: str,
    org_id: str,
    permission_code: str,
):
    permissions = get_user_permissions(
        user_id=user_id,
        org_id=org_id,
    )

    return permission_code in permissions

