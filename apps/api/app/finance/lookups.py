"""Minimum identifiers needed to invoice, not access to the Clients/Colis modules."""
from sqlalchemy import text
from app.db.database import engine

CLIENT_SCOPE="""(:unrestricted or exists(select 1 from cargo_packages p where p.org_id=:org
 and p.client_id=c.id and p.deleted_at is null and
 (p.origin_location_id=any(cast(:offices as uuid[])) or p.destination_location_id=any(cast(:offices as uuid[]))))
 or exists(select 1 from finance_documents d where d.org_id=:org and d.client_id=c.id
 and d.office_id=any(cast(:offices as uuid[]))))"""

def params(org,offices):return {'org':org,'offices':offices or [],'unrestricted':offices is None}

def clients(org,q,offices):
    with engine.connect() as conn:
        rows=conn.execute(text(f'''select c.id,c.display_name,c.name,c.company_name,c.phone
          from clients c where c.org_id=:org and c.deleted_at is null and {CLIENT_SCOPE}
          and (:q='' or coalesce(c.display_name,c.name,c.company_name,'') ilike :pattern)
          order by c.display_name,c.id limit 100'''),{**params(org,offices),'q':q or '','pattern':'%'+(q or '')+'%'}).mappings().all()
    return {'items':[dict(row) for row in rows]}

def client_visible(org,client_id,offices):
    if offices is None:return True
    with engine.connect() as conn:
        return bool(conn.execute(text(f'select 1 from clients c where c.org_id=:org and c.id=:client and c.deleted_at is null and {CLIENT_SCOPE}'),{**params(org,offices),'client':client_id}).first())

def packages(org,client_id,offices):
    with engine.connect() as conn:
        rows=conn.execute(text('''select p.id,p.package_reference,p.client_id,p.shipping_service_id,p.shipment_id,p.description,p.package_type,
            p.fees_total,p.currency,p.pricing_snapshot,p.row_version,p.status
            from cargo_packages p where p.org_id=:org and p.client_id=:client
            and p.deleted_at is null and (:unrestricted or p.origin_location_id=any(cast(:offices as uuid[]))
            or p.destination_location_id=any(cast(:offices as uuid[])))
            order by p.created_at desc,p.id limit 100'''),{**params(org,offices),'client':client_id}).mappings().all()
    return {'items':[dict(row) for row in rows]}
