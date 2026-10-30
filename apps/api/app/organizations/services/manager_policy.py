"""Full business management within the active bureau, never network ownership.

Keep this allowlist in sync with migration 162. Unknown capability families are
not granted automatically. Organization membership remains the tenant boundary.
"""
from sqlalchemy import text
from app.db.database import engine

MANAGER_PERMISSION_FAMILIES = (
    'clients','packages','shipments','warehouses','pickups','departures','batches',
    'tracking','dossiers','documents','finance','pricing','routes','services',
    'inbox','followups','broadcasts','knowledge','analytics','reports',
    'notifications','support','commercial',
)
MANAGER_SPECIFIC_PERMISSIONS = (
    'organization.read','dashboard.view','team.read','team.write','team.manage',
    'roles.manage','locations.manage','locations.access.manage','workspaces.manage',
    'settings.read','settings.write','audit.read','operations.write',
    'references.read','references.audit',
    'pilot.settings.read','pilot.knowledge.read','pilot.knowledge.manage',
    'pilot.knowledge.publish','pilot.followups.read','pilot.followups.manage',
    'pilot.followups.send','pilot.readiness.read','pilot.readiness.review',
)


def manager_permission_allowed(code: str) -> bool:
    return code.split('.',1)[0] in MANAGER_PERMISSION_FAMILIES or code in MANAGER_SPECIFIC_PERMISSIONS


def ensure_manager_role_permissions(org_id: str):
    with engine.begin() as conn:
        params={'org':org_id,'families':list(MANAGER_PERMISSION_FAMILIES),
                'specific':list(MANAGER_SPECIFIC_PERMISSIONS)}
        conn.execute(text('''delete from role_permissions rp using organization_roles r,permissions p
            where rp.role_id=r.id and rp.permission_id=p.id and r.org_id=:org
            and r.role_code='MANAGER' and r.system_role
            and not (split_part(p.permission_code,'.',1)=any(:families) or p.permission_code=any(:specific))'''),params)
        conn.execute(text('''insert into role_permissions(role_id,permission_id)
            select r.id,p.id from organization_roles r cross join permissions p
            where r.org_id=:org and r.role_code='MANAGER' and r.system_role
            and (split_part(p.permission_code,'.',1)=any(:families) or p.permission_code=any(:specific))
            on conflict do nothing'''),params)
