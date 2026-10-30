from sqlalchemy import text
from contextlib import nullcontext

from app.db.database import engine


def upsert_membership(
    clerk_membership_id: str,
    clerk_user_id: str,
    clerk_org_id: str,
    org_id: str,
    role_code: str,
    member_email: str | None = None,
    member_display_name: str | None = None,
    office_access_scope: str | None = None,
    office_ids: list[str] | None = None,
    connection=None,
):
    with (nullcontext(connection) if connection is not None else engine.begin()) as conn:
        row = conn.execute(
            text("""
                insert into organization_memberships (
                    clerk_membership_id,
                    clerk_user_id,
                    clerk_org_id,
                    org_id,
                    role_code,
                    member_email,
                    member_display_name,office_access_scope
                )
                values (
                    :clerk_membership_id,
                    :clerk_user_id,
                    :clerk_org_id,
                    :org_id,
                    :role_code,
                    :member_email,
                    :member_display_name,coalesce(:office_access_scope,'ALL_OFFICES')
                )
                on conflict (clerk_user_id, clerk_org_id)
                do update set
                    role_code = excluded.role_code,
                    member_email = coalesce(excluded.member_email, organization_memberships.member_email),
                    member_display_name = coalesce(excluded.member_display_name, organization_memberships.member_display_name),
                    office_access_scope=coalesce(:office_access_scope,organization_memberships.office_access_scope),
                    status = 'ACTIVE',
                    updated_at = now()
                where organization_memberships.status='ACTIVE'
                returning *
            """),
            {
                "clerk_membership_id": clerk_membership_id,
                "clerk_user_id": clerk_user_id,
                "clerk_org_id": clerk_org_id,
                "org_id": org_id,
                "role_code": role_code,
                "member_email": member_email,
                "member_display_name": member_display_name,
                'office_access_scope':office_access_scope,
            },
        ).fetchone()

        if row and office_access_scope is not None:
            conn.execute(text('delete from organization_membership_offices where membership_id=:id and org_id=:o'),{'id':row._mapping['id'],'o':org_id})
            if office_access_scope=='SELECTED_OFFICES':
                from app.organizations.services.access_policy import validate_invitation_office_scope
                validate_invitation_office_scope(conn,org_id,role_code,office_access_scope,office_ids or [])
                conn.execute(text('''insert into organization_membership_offices(org_id,membership_id,location_id,granted_by)
                    select :o,:m,l.id,'accepted-invitation' from organization_locations l where l.org_id=:o
                     and l.id=any(cast(:ids as uuid[])) and l.status='ACTIVE' and l.location_type='OFFICE'
                    on conflict do nothing'''),{'o':org_id,'m':row._mapping['id'],'ids':office_ids or []})

        return dict(row._mapping) if row else None

