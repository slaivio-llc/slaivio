"""Agency roles can never create platform rights or exceed the actor's access."""
from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine
from app.permissions.repositories.permission_repository import get_user_permissions


def validate_role_assignment(org_id, actor_id, role_code):
    with engine.connect() as conn:
        role=conn.execute(text('select id from organization_roles where org_id=:o and role_code=:r'),{'o':org_id,'r':role_code}).scalar()
        actor_role=conn.execute(text("select role_code from organization_memberships where org_id=:o and clerk_user_id=:u and status='ACTIVE'"),{'o':org_id,'u':actor_id}).scalar()
        if not role:raise HTTPException(422,'invalid_role')
        if not actor_role:raise HTTPException(403,'organization_membership_required')
        if role_code=='OWNER' and actor_role!='OWNER':raise HTTPException(403,'owner_role_assignment_required')
        permissions=list(conn.execute(text('select p.permission_code from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=:r'),{'r':role}).scalars().all())
    validate_granted_permissions(org_id,actor_id,permissions,actor_role)
    return actor_role


def validate_granted_permissions(org_id,actor_id,permissions,actor_role=None):
    if any(p.startswith(('platform.','quarantine.')) for p in permissions):raise HTTPException(403,'platform_permissions_not_assignable')
    if actor_role=='OWNER':return
    allowed=set(get_user_permissions(actor_id,org_id))
    if not set(permissions)<=allowed:raise HTTPException(403,'role_exceeds_your_permissions')


def validate_invitation_office_scope(conn,org_id,role_code,scope,office_ids,actor_id=None):
    if scope not in ('ALL_OFFICES','SELECTED_OFFICES'):raise HTTPException(422,'invalid_office_access_scope')
    if role_code=='OWNER' and scope!='ALL_OFFICES':raise HTTPException(422,'owner_requires_all_offices')
    if scope=='SELECTED_OFFICES':
        ids=list(dict.fromkeys(str(value) for value in office_ids))
        count=conn.execute(text("""select count(*) from organization_locations where org_id=:o
            and id=any(cast(:ids as uuid[])) and location_type='OFFICE' and status='ACTIVE'"""),{'o':org_id,'ids':ids}).scalar_one()
        if not ids or count!=len(ids):raise HTTPException(422,'invalid_office_assignment')
    if actor_id:
        actor=conn.execute(text("select id,role_code,office_access_scope from organization_memberships where org_id=:o and clerk_user_id=:u and status='ACTIVE'"),{'o':org_id,'u':actor_id}).mappings().first()
        if not actor:raise HTTPException(403,'organization_membership_required')
        if actor['role_code']!='OWNER' and actor['office_access_scope']=='SELECTED_OFFICES':
            if scope!='SELECTED_OFFICES':raise HTTPException(403,'invitation_office_scope_exceeds_yours')
            allowed=conn.execute(text('select count(*) from organization_membership_offices where org_id=:o and membership_id=:m and location_id=any(cast(:ids as uuid[]))'),{'o':org_id,'m':actor['id'],'ids':ids}).scalar_one()
            if allowed!=len(ids):raise HTTPException(403,'invitation_office_scope_exceeds_yours')
