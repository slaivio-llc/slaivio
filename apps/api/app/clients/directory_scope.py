"""Network directory visibility never grants local client permissions."""
from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine
from app.permissions.services.permission_service import list_permissions_for_user


def offices_for_user(tenant):
    active = tenant['org_id']
    user = tenant['user_id']
    permissions = set(list_permissions_for_user(user, active))
    if 'network.read' not in permissions:
        return [{'org_id': active, 'name': 'Bureau actif'}]
    with engine.connect() as conn:
        rows = conn.execute(text('''
            select office.id org_id,coalesce(office.organization_name,office.name,office.id) name
            from organizations office join organizations active_office on active_office.id=:active
            where office.status='ACTIVE' and (office.id=active_office.id or
              (active_office.group_id is not null and office.group_id=active_office.group_id))
            and exists(select 1 from organization_memberships membership
              where membership.org_id=office.id and membership.clerk_user_id=:user
                and membership.status='ACTIVE')
            order by office.id=:active desc, name
        '''), {'active': active, 'user': user}).mappings().all()
    allowed = [dict(row) for row in rows if 'clients.read' in list_permissions_for_user(user, row['org_id'])]
    if not any(row['org_id'] == active for row in allowed):
        allowed.insert(0, {'org_id': active, 'name': 'Bureau actif'})
    return allowed


def resolve_scope(tenant, office_id):
    if not office_id or office_id == tenant['org_id']:
        return None
    offices = offices_for_user(tenant)
    allowed = [office['org_id'] for office in offices]
    if office_id == 'all':
        return allowed
    if office_id not in allowed:
        raise HTTPException(403, 'client_office_access_denied')
    return [office_id]
