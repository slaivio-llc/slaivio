from sqlalchemy import text

from app.db.database import engine


def get_user_permissions(
    user_id: str,
    org_id: str,
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                select distinct granted.permission_code
                from (
                    select p.permission_code
                    from user_role_assignments ura
                    join organization_roles r on r.id = ura.role_id
                    join role_permissions rp on rp.role_id = r.id
                    join permissions p on p.id = rp.permission_id
                    join organization_memberships authority
                      on authority.org_id=ura.org_id and authority.clerk_user_id=ura.user_id
                     and authority.status='ACTIVE' and authority.role_code=r.role_code
                    where ura.user_id = :user_id
                      and ura.org_id = :org_id
                      and r.org_id=ura.org_id
                      and ura.assignment_status = 'ACTIVE'

                    union

                    select p.permission_code
                    from organization_memberships m
                    join organization_roles r
                      on r.org_id = m.org_id and r.role_code = m.role_code
                    join role_permissions rp on rp.role_id = r.id
                    join permissions p on p.id = rp.permission_id
                    where m.clerk_user_id = :user_id
                      and m.org_id = :org_id
                      and m.status = 'ACTIVE'
                ) granted
                order by granted.permission_code
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


def assign_role_to_user(
    user_id: str,
    org_id: str,
    role_id: str,
    connection=None,
):
    from contextlib import nullcontext
    with (nullcontext(connection) if connection is not None else engine.begin()) as conn:
        # A member has one effective role per agency. Old assignments must not
        # accumulate capabilities after a role change or a webhook replay.
        valid=conn.execute(text('''select 1 from organization_memberships m
            join organization_roles r on r.org_id=m.org_id and r.role_code=m.role_code
            where m.org_id=:org_id and m.clerk_user_id=:user_id and m.status='ACTIVE'
              and r.id=:role_id for update of m'''),
            {'org_id':org_id,'user_id':user_id,'role_id':role_id}).first()
        if not valid:return None
        conn.execute(text('''update user_role_assignments set assignment_status='REVOKED'
            where user_id=:user_id and org_id=:org_id and role_id<>:role_id'''),
            {'org_id':org_id,'user_id':user_id,'role_id':role_id})
        row = conn.execute(
            text("""
                insert into user_role_assignments (
                    user_id,
                    org_id,
                    role_id
                )
                values (
                    :user_id,
                    :org_id,
                    :role_id
                )
                on conflict (user_id, org_id, role_id)
                do update set assignment_status = 'ACTIVE'
                returning *
            """),
            {
                "user_id": user_id,
                "org_id": org_id,
                "role_id": role_id,
            },
        ).fetchone()

        return dict(row._mapping) if row else None
