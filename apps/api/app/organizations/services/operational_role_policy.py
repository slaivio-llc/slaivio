"""Explicit standard staff roles; custom roles and bureau grants are untouched.

Keep this matrix aligned with migration 164. No wildcard grants: future
permissions must be reviewed before being assigned to an operational role.
"""
from sqlalchemy import text
from app.db.database import engine


OPERATIONAL_ROLES = {
    'OPERATOR': ('Agent opérationnel', 'Gestion des colis et des expéditions du bureau attribué',
        'clients.read clients.create clients.update packages.read packages.create packages.update packages.import packages.scan packages.weigh packages.move packages.quality packages.anomalies packages.assign packages.delivery packages.pricing shipments.read shipments.create shipments.update dossiers.read dossiers.create dossiers.update dossiers.clients.read dossiers.clients.manage tracking.read tracking.update tracking.alerts tracking.notify warehouses.read warehouses.receive warehouses.weigh warehouses.quality warehouses.move warehouses.group warehouses.print departures.read batches.read pricing.read routes.read services.read'),
    'WAREHOUSE': ('Agent entrepôt', 'Réception, pesage, stock et remise physique, sans configuration ni encaissement',
        'clients.read packages.read packages.create packages.update packages.scan packages.weigh packages.move packages.quality packages.anomalies packages.assign packages.delivery shipments.read shipments.update shipments.confirm_arrival dossiers.read dossiers.clients.read tracking.read tracking.update tracking.alerts tracking.notify warehouses.read warehouses.receive warehouses.weigh warehouses.quality warehouses.move warehouses.count warehouses.alerts warehouses.group warehouses.print pickups.read pickups.create pickups.release'),
    'SUPPORT': ('Service client', 'Conversations et suivi des clients, sans modification des colis ni encaissement',
        'clients.read clients.create clients.update packages.read shipments.read dossiers.read dossiers.clients.read tracking.read inbox.read inbox.reply inbox.assign inbox.manage inbox.ai.use pickups.read pickups.notify'),
    'WAREHOUSE_SUPERVISOR': ('Superviseur entrepôt', 'Supervision du stock et des opérations entrepôt du bureau attribué',
        'packages.read shipments.read warehouses.read warehouses.create warehouses.update warehouses.move warehouses.count warehouses.alerts warehouses.export warehouses.receive warehouses.weigh warehouses.quality warehouses.group warehouses.print pickups.read pickups.create pickups.release'),
    'RECEIVER': ('Réceptionnaire', 'Réception, scan et identification des colis',
        'packages.read packages.scan warehouses.read warehouses.receive warehouses.move warehouses.print'),
    'WEIGHER': ('Peseur', 'Pesage et mesure des colis',
        'packages.read warehouses.read warehouses.weigh'),
    'QUALITY_CONTROLLER': ('Contrôleur qualité', 'Contrôle qualité et signalement des anomalies',
        'packages.read warehouses.read warehouses.quality warehouses.alerts'),
    'COUNTER_AGENT': ('Agent guichet', 'Accueil, vérification et remise des colis, sans dérogation ni réglage des frais',
        'clients.read packages.read pickups.read pickups.create pickups.notify pickups.verify pickups.release pickups.export'),
    'CASHIER': ('Caissier', 'Vérification des paiements avant retrait, sans remise physique ni dérogation',
        'pickups.read pickups.verify pickups.export'),
}


def ensure_operational_role_permissions(org_id: str):
    with engine.begin() as conn:
        for code, (name, description, permissions) in OPERATIONAL_ROLES.items():
            params = {'org': org_id, 'code': code, 'name': name,
                      'description': description, 'permissions': permissions.split()}
            conn.execute(text('''insert into organization_roles
                (org_id,role_code,role_name,description,system_role)
                values (:org,:code,:name,:description,true)
                on conflict (org_id,role_code) do update set
                role_name=excluded.role_name,description=excluded.description
                where organization_roles.system_role'''), params)
            conn.execute(text('''delete from role_permissions rp using organization_roles r,permissions p
                where rp.role_id=r.id and rp.permission_id=p.id and r.org_id=:org
                and r.role_code=:code and r.system_role
                and not (p.permission_code=any(:permissions))'''), params)
            conn.execute(text('''insert into role_permissions(role_id,permission_id)
                select r.id,p.id from organization_roles r cross join permissions p
                where r.org_id=:org and r.role_code=:code and r.system_role
                and p.permission_code=any(:permissions) on conflict do nothing'''), params)
