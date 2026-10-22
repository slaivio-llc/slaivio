"""Transaction boundaries for loading and physical shipment milestones."""
import json
from decimal import Decimal
from math import ceil

from fastapi import HTTPException
from sqlalchemy import text
from app.finance.clearance import departure_clearance
from app.organization_admin.settings_policy import check_regulated_goods
from app.documents.agency_brand import identity as document_identity

from app.db.database import engine
from app.expeditions.detail import require_shipment, PACKAGES, SCOPE
from app.expeditions.repository import _insert_event
from app.packages.repository import _insert_package_event, _queue_customer_status_notification

RECEIVED = {'RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','WAREHOUSE_PROCESSING',
            'READY_FOR_BATCH','READY_FOR_DISPATCH','BATCHED'}


def editable(row, expected):
    if row.get('workflow_version') != 2:
        raise HTTPException(409, 'legacy_shipment_requires_review')
    if row['version'] != expected:
        raise HTTPException(409, 'stale_shipment_version')
    if row['stage'] != 'planned' or row['departed_at'] or row['arrived_at']:
        raise HTTPException(409, 'shipment_loading_closed')


def compatible(shipment, package):
    reasons = []
    if package['status'] not in RECEIVED:
        reasons.append('parcel_not_received')
    if package.get('validation_status') in {'BLOCKED','REJECTED'}:
        reasons.append('quality_review_required')
    if not package.get('client_id'):
        reasons.append('client_missing')
    if not shipment.get('route_id') or str(package.get('route_id') or '') != shipment['route_id']:
        reasons.append('route_mismatch')
    # Legacy packages/shipments without a selected service remain compatible;
    # when both are known, prevent mixing services in one shipment.
    shipment_service = shipment.get('shipping_service_id')
    package_service = package.get('shipping_service_id')
    if shipment_service and package_service and str(shipment_service) != str(package_service):
        reasons.append('service_mismatch')
    for field in ('destination_country','destination_city'):
        if str(shipment.get(field) or '').strip().casefold() != str(package.get(field) or '').strip().casefold():
            reasons.append('destination_mismatch')
            break
    if package.get('other_assignment') or package.get('departure_assignment'):
        reasons.append('already_assigned')
    return reasons


def candidates(org_id, shipment_id, q='', page=1):
    with engine.connect() as conn:
        shipment = require_shipment(conn, org_id, shipment_id)
        params = {'org_id':org_id,'id':shipment_id,'route':shipment.get('route_id'), 'offset':(page-1)*50,
                  'q':'%'+q.strip().replace('!','!!').replace('%','!%').replace('_','!_')+'%'}
        where = """p.org_id=:org_id and p.deleted_at is null and p.route_id=cast(:route as uuid)
          and (p.package_reference ilike :q escape '!' or p.tracking_id ilike :q escape '!'
            or p.supplier_tracking ilike :q escape '!' or c.name ilike :q escape '!')
          and not exists(select 1 from expedition_packages ep where ep.org_id=p.org_id
            and ep.package_id=p.id and ep.expedition_id=cast(:id as uuid) and ep.removed_at is null)"""
        joins = 'from cargo_packages p left join clients c on c.id=p.client_id and c.org_id=p.org_id'
        total = conn.execute(text(f'select count(*) {joins} where {where}'),params).scalar_one()
        rows = conn.execute(text(f"""select p.id::text,p.package_reference as reference,p.client_id::text,
          c.name as client_name,p.status,p.validation_status,p.route_id::text,p.shipping_service_id::text,
          p.destination_city,p.destination_country,
          exists(select 1 from expedition_packages ep where ep.org_id=p.org_id and ep.package_id=p.id and ep.removed_at is null) other_assignment,
          exists(select 1 from departure_package_allocations da where da.org_id=p.org_id and da.package_id=p.id and da.status<>'REMOVED') departure_assignment
          {joins} where {where} order by p.created_at,p.id limit 50 offset :offset"""),params).mappings()
        return {'items':[{**dict(row),'blockers':compatible(shipment,dict(row))} for row in rows],
                'page':page,'total':total,'total_pages':ceil(total/50)}


def loading(org_id, shipment_id, actor, expected, ids, remove=False):
    ids = sorted(set(ids))
    with engine.begin() as conn:
        shipment = require_shipment(conn,org_id,shipment_id,lock=True)
        editable(shipment,expected)
        params={'org_id':org_id,'id':shipment_id,'ids':ids,'actor':actor}
        rows = conn.execute(text("""select p.* from cargo_packages p where p.org_id=:org_id
            and p.id=any(cast(:ids as uuid[])) and p.deleted_at is null order by p.id for update"""),params).mappings().all()
        if len(rows)!=len(ids):
            raise HTTPException(404,'package_not_found')
        changed=0
        for value in rows:
            package=dict(value);pid=str(package['id']);p={**params,'package':pid}
            assignments=conn.execute(text("""select expedition_id::text from expedition_packages
                where org_id=:org_id and package_id=cast(:package as uuid) and removed_at is null"""),p).scalars().all()
            if remove:
                if shipment_id not in assignments: continue
                conn.execute(text("""update expedition_packages set removed_at=now(),removal_reason='Retrait pendant la préparation'
                    where org_id=:org_id and expedition_id=cast(:id as uuid) and package_id=cast(:package as uuid) and removed_at is null"""),p)
            else:
                if assignments==[shipment_id]: continue
                package['other_assignment']=bool(assignments)
                package['departure_assignment']=bool(conn.execute(text("""select 1 from departure_package_allocations
                    where org_id=:org_id and package_id=cast(:package as uuid) and status<>'REMOVED' limit 1"""),p).first())
                reasons=compatible(shipment,package)
                if reasons: raise HTTPException(409,{'code':'package_not_eligible','package_id':pid,'reference':package.get('package_reference'),'reasons':reasons})
                check_regulated_goods(conn,org_id,package)
                # Reuse a removed row to support older unique constraints on the triple.
                prior=conn.execute(text("""update expedition_packages set removed_at=null,removal_reason=null,added_at=now(),added_by=:actor
                    where id=(select id from expedition_packages where org_id=:org_id
                      and expedition_id=cast(:id as uuid) and package_id=cast(:package as uuid)
                      order by added_at desc,id limit 1)
                    returning id"""),p).first()
                if not prior:
                    conn.execute(text("""insert into expedition_packages(org_id,expedition_id,package_id,added_by)
                      values(:org_id,cast(:id as uuid),cast(:package as uuid),:actor)"""),p)
            conn.execute(text("""update cargo_packages set shipment_reference=:reference,row_version=row_version+1,
                updated_by=:actor,updated_at=now() where org_id=:org_id and id=cast(:package as uuid)"""),
                {**p,'reference':None if remove else shipment['reference']})
            _insert_package_event(conn,org_id=org_id,package_id=pid,event_type='EXPEDITION_REMOVED' if remove else 'EXPEDITION_ASSIGNED',
                title='Colis retiré du chargement' if remove else 'Colis affecté au chargement',actor_id=actor,
                metadata={'expedition_id':shipment_id})
            changed+=1
        if changed:
            conn.execute(text("""update cargo_expeditions set shipment_row_version=shipment_row_version+1,
                updated_by=:actor,updated_at=now() where org_id=:org_id and id=cast(:id as uuid)"""),params)
            _insert_event(conn,org_id=org_id,expedition_id=shipment_id,event_type='PACKAGE_REMOVED' if remove else 'PACKAGE_ADDED',
                title=f'{changed} colis retiré(s)' if remove else f'{changed} colis affecté(s)',actor_id=actor,metadata={'package_ids':ids})
        return {'changed':changed}


def cancel(org_id, shipment_id, actor, expected, reason):
    """Cancel a preparation atomically while leaving its parcels in the agency."""
    with engine.begin() as conn:
        shipment = require_shipment(conn, org_id, shipment_id, lock=True)
        if shipment['status'] == 'CANCELLED':
            return {'changed': False}
        editable(shipment, expected)
        params = {'org_id': org_id, 'id': shipment_id, 'actor': actor, 'reason': reason}
        parcels = conn.execute(text(f"""select p.id::text,p.package_reference
            {PACKAGES} where {SCOPE} and ep.removed_at is null and p.deleted_at is null
            order by p.id for update of p"""), params).mappings().all()
        for parcel in parcels:
            parcel_id = parcel['id']
            values = {**params, 'package': parcel_id}
            conn.execute(text("""update expedition_packages set removed_at=now(),
                removal_reason='Expédition annulée' where org_id=:org_id
                and expedition_id=cast(:id as uuid) and package_id=cast(:package as uuid)
                and removed_at is null"""), values)
            conn.execute(text("""update cargo_packages set shipment_reference=null,
                row_version=row_version+1,updated_by=:actor,updated_at=now()
                where org_id=:org_id and id=cast(:package as uuid)"""), values)
            _insert_package_event(conn, org_id=org_id, package_id=parcel_id,
                event_type='EXPEDITION_CANCELLED', title='Expédition annulée — colis libéré',
                actor_id=actor, metadata={'expedition_id': shipment_id})
        conn.execute(text("""update cargo_expeditions set status='CANCELLED',is_delayed=false,
            delay_reason=null,shipment_row_version=shipment_row_version+1,
            updated_by=:actor,updated_at=now() where org_id=:org_id and id=cast(:id as uuid)"""), params)
        _insert_event(conn, org_id=org_id, expedition_id=shipment_id,
            event_type='EXPEDITION_CANCELLED', title='Expédition annulée',
            description=reason, previous_status=shipment['status'], new_status='CANCELLED',
            actor_id=actor, metadata={'released_package_ids': [row['id'] for row in parcels]})
        return {'changed': True, 'released_packages': len(parcels)}


def milestone(org_id,shipment_id,actor,expected,action):
    target='DISPATCHED' if action=='depart' else 'ARRIVED_DESTINATION'
    with engine.begin() as conn:
        shipment=require_shipment(conn,org_id,shipment_id,lock=True)
        if shipment.get('workflow_version')!=2:raise HTTPException(409,'legacy_shipment_requires_review')
        if shipment['status']==target:return {'notification_ids':[],'changed':False}
        if shipment['version']!=expected:raise HTTPException(409,'stale_shipment_version')
        if action=='depart':editable(shipment,expected)
        elif shipment['status']!='DISPATCHED' or not shipment.get('departed_at'):
            raise HTTPException(409,'shipment_departure_not_confirmed')
        params={'org_id':org_id,'id':shipment_id,'actor':actor}
        rows=conn.execute(text("""select p.* from cargo_packages p join expedition_packages ep
          on ep.package_id=p.id and ep.org_id=p.org_id where ep.org_id=:org_id
          and ep.expedition_id=cast(:id as uuid) and ep.removed_at is null order by p.id for update of p"""),params).mappings().all()
        if not rows:raise HTTPException(409,'shipment_empty')
        for row in rows:
            p=dict(row)
            valid=p['status'] in RECEIVED if action=='depart' else p['status'] in {'SHIPPED','IN_TRANSIT'}
            if p.get('deleted_at') or not valid:raise HTTPException(409,{'code':'package_state_conflict','package_id':str(p['id']),'reference':p.get('package_reference')})
            if action=='depart':
                reasons=compatible(shipment,p)
                if reasons:raise HTTPException(409,{'code':'package_not_eligible','package_id':str(p['id']),'reference':p.get('package_reference'),'reasons':reasons})
                check_regulated_goods(conn,org_id,p)
                clearance=departure_clearance(conn,org_id,p)
                if not clearance['allowed']:
                    raise HTTPException(409,{'code':clearance['code'],'package_id':str(p['id']),
                        'reference':p.get('package_reference'),'finance':clearance})
        if action=='depart':
            manifest_rows=conn.execute(text(f"""select p.id::text,p.package_reference as reference,c.name as client_name,
              p.supplier_tracking,p.weight_kg,p.destination_city,p.destination_country
              {PACKAGES} where {SCOPE} and ep.removed_at is null order by ep.added_at,ep.id"""),params).mappings().all()
            payload={'shipment':shipment,'items':[dict(row) for row in manifest_rows],
                     'agency_brand':document_identity(conn,org_id,shipment.get('origin_location_id'))}
            conn.execute(text("""insert into expedition_departure_manifests(org_id,expedition_id,payload,created_by)
                values(:org_id,cast(:id as uuid),cast(:payload as jsonb),:actor)"""),{**params,'payload':json.dumps(payload,default=str)})
        date_column='departed_at' if action=='depart' else 'arrived_at'
        conn.execute(text(f"""update cargo_expeditions set status=:status,{date_column}=now(),is_delayed=false,
            shipment_row_version=shipment_row_version+1,updated_by=:actor,updated_at=now()
            where org_id=:org_id and id=cast(:id as uuid)"""),{**params,'status':target})
        new_status='SHIPPED' if action=='depart' else 'ARRIVED_DESTINATION';notifications=[]
        for row in rows:
            p=dict(row)
            conn.execute(text("""update cargo_packages set status=:status,
              dispatched_at=case when :status='SHIPPED' then now() else dispatched_at end,
              row_version=row_version+1,updated_by=:actor,updated_at=now() where org_id=:org_id and id=:package"""),
              {**params,'package':p['id'],'status':new_status})
            _insert_package_event(conn,org_id=org_id,package_id=str(p['id']),event_type='SHIPMENT_DEPARTED' if action=='depart' else 'SHIPMENT_ARRIVED',
                title='Départ confirmé' if action=='depart' else 'Arrivée confirmée',previous_status=p['status'],new_status=new_status,actor_id=actor)
            notification=_queue_customer_status_notification(conn,p,new_status,actor)
            if notification:
                notifications.append(notification)
                conn.execute(text("""insert into expedition_milestone_notifications(org_id,expedition_id,notification_id)
                    values(:org_id,cast(:id as uuid),cast(:notification as uuid)) on conflict do nothing"""),
                    {**params,'notification':notification})
        _insert_event(conn,org_id=org_id,expedition_id=shipment_id,event_type='SHIPMENT_DEPARTED' if action=='depart' else 'SHIPMENT_ARRIVED',
            title='Départ confirmé' if action=='depart' else 'Arrivée confirmée',previous_status=shipment['status'],new_status=target,actor_id=actor)
        return {'changed':True,'notification_ids':notifications}


def manifest(org_id,shipment_id):
    with engine.connect() as conn:
        shipment=require_shipment(conn,org_id,shipment_id)
        snapshot=conn.execute(text("""select payload,created_at from expedition_departure_manifests
            where org_id=:org_id and expedition_id=cast(:id as uuid)"""),{'org_id':org_id,'id':shipment_id}).mappings().first()
        if snapshot:return {**snapshot['payload'],'historical_snapshot':True,'departed_at':snapshot['created_at']}
        if shipment['stage']!='planned':raise HTTPException(409,'historical_manifest_unavailable')
        rows=conn.execute(text(f"""select p.id::text,p.package_reference as reference,c.name as client_name,
            p.supplier_tracking,p.weight_kg,p.destination_city,p.destination_country
            {PACKAGES} where {SCOPE} and ep.removed_at is null and p.deleted_at is null order by ep.added_at,ep.id"""),
            {'org_id':org_id,'id':shipment_id}).mappings()
        return {'shipment':shipment,'items':[dict(row) for row in rows],'historical_snapshot':False,'departed_at':None,
                'agency_brand':document_identity(conn,org_id,shipment.get('origin_location_id'))}
