"""Read models and planning commands for the freight expedition workspace."""
from math import ceil

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.expeditions.register import STAGE
from app.expeditions.repository import _insert_event

SCOPE = 'e.org_id=:org_id and e.id=cast(:id as uuid) and e.archived_at is null and e.deleted_at is null'
PACKAGES = """from expedition_packages ep
 join cargo_expeditions e on e.id=ep.expedition_id and e.org_id=ep.org_id
 join cargo_packages p on p.id=ep.package_id and p.org_id=ep.org_id
 left join clients c on c.id=p.client_id and c.org_id=p.org_id
 """


def require_shipment(conn, org_id, shipment_id, lock=False):
    row = conn.execute(text(f"""select e.id::text,e.expedition_reference as reference,
        e.status,({STAGE}) as stage,e.origin_city,e.origin_country,e.destination_city,e.destination_country,
        e.route_label,e.planned_departure_at,e.departed_at,e.arrived_at,e.is_delayed,e.delay_reason,
        e.shipment_row_version as version from cargo_expeditions e where {SCOPE}
        {'for update' if lock else ''}"""), {'org_id': org_id, 'id': shipment_id}).mappings().first()
    if not row:
        raise HTTPException(404, 'shipment_not_found')
    return dict(row)


def overview(org_id, shipment_id):
    with engine.connect() as conn:
        result = require_shipment(conn, org_id, shipment_id)
        totals = conn.execute(text(f"""select count(*) as packages_count,
            count(p.weight_kg) as weighed_count,sum(p.weight_kg) as known_weight_kg
            {PACKAGES} where {SCOPE} and ep.removed_at is null and p.deleted_at is null"""),
            {'org_id': org_id, 'id': shipment_id}).mappings().one()
        return {**result, **dict(totals)}


def packages(org_id, shipment_id, q='', page=1):
    with engine.connect() as conn:
        shipment = require_shipment(conn, org_id, shipment_id)
        where = f'{SCOPE} and ep.removed_at is null and p.deleted_at is null'
        params = {'org_id': org_id, 'id': shipment_id, 'offset': (page-1)*50}
        if q.strip():
            where += """ and (p.package_reference ilike :q escape '!' or p.tracking_id ilike :q escape '!'
                or p.supplier_tracking ilike :q escape '!' or c.name ilike :q escape '!')"""
            params['q'] = '%' + q.strip().replace('!', '!!').replace('%', '!%').replace('_', '!_') + '%'
        total = conn.execute(text(f'select count(*) {PACKAGES} where {where}'), params).scalar_one()
        items = conn.execute(text(f"""select p.id::text,coalesce(p.package_reference,p.tracking_id) as reference,
            c.name as client_name,p.supplier_tracking,p.weight_kg,p.destination_city,p.destination_country,
            p.status {PACKAGES} where {where} order by ep.added_at,ep.id limit 50 offset :offset"""), params).mappings()
        return {'items': [dict(row) for row in items], 'total': total, 'page': page,
                'total_pages': ceil(total/50), 'historical_snapshot': False,
                'preparation': shipment['stage'] == 'planned'}


def history(org_id, shipment_id, page=1):
    with engine.connect() as conn:
        require_shipment(conn, org_id, shipment_id)
        params = {'org_id': org_id, 'id': shipment_id, 'offset': (page-1)*30}
        # Whitelist operational events: do not leak financial notes, recipients or metadata.
        where = """org_id=:org_id and expedition_id=cast(:id as uuid)
            and event_type in ('EXPEDITION_CREATED','SHIPMENT_PLANNING_CHANGED',
              'STATUS_CHANGED','PACKAGE_ADDED','PACKAGE_REMOVED','SHIPMENT_DEPARTED','SHIPMENT_ARRIVED')"""
        total = conn.execute(text(f'select count(*) from expedition_events where {where}'), params).scalar_one()
        items = conn.execute(text(f"""select id::text,event_type,title,created_at,
            case when event_type='SHIPMENT_PLANNING_CHANGED' then metadata->>'before' else null end as previous_planned_at,
            case when event_type='SHIPMENT_PLANNING_CHANGED' then metadata->>'after' else null end as next_planned_at,
            case when event_type='SHIPMENT_PLANNING_CHANGED' then description else null end as description
            from expedition_events where {where} order by created_at desc,id desc limit 30 offset :offset"""), params).mappings()
        return {'items': [dict(row) for row in items], 'page': page, 'total_pages': ceil(total/30)}


def communications(org_id, shipment_id, page=1):
    with engine.connect() as conn:
        require_shipment(conn, org_id, shipment_id)
        params = {'org_id': org_id, 'id': shipment_id, 'offset': (page-1)*30}
        where = 'org_id=:org_id and expedition_id=cast(:id as uuid)'
        total = conn.execute(text(f'select count(*) from expedition_notifications where {where}'), params).scalar_one()
        items = conn.execute(text(f"""select id::text,notification_type,channel,status,created_at,sent_at,failed_at
            from expedition_notifications where {where} order by created_at desc,id desc limit 30 offset :offset"""), params).mappings()
        return {'items': [dict(row) for row in items], 'page': page, 'total_pages': ceil(total/30)}


def change_plan(org_id, shipment_id, actor, expected_version, planned_departure_at, reason):
    with engine.begin() as conn:
        row = require_shipment(conn, org_id, shipment_id, lock=True)
        if row['version'] != expected_version:
            raise HTTPException(409, 'stale_shipment_version')
        if row['stage'] != 'planned' or row['departed_at'] or row['arrived_at']:
            raise HTTPException(409, 'shipment_planning_closed')
        old = row['planned_departure_at']
        if old == planned_departure_at:
            return {'changed': False}
        conn.execute(text("""update cargo_expeditions set planned_departure_at=:planned,
            shipment_row_version=shipment_row_version+1,updated_by=:actor,updated_at=now()
            where org_id=:org_id and id=cast(:id as uuid)"""),
            {'planned': planned_departure_at, 'actor': actor, 'org_id': org_id, 'id': shipment_id})
        _insert_event(conn, org_id=org_id, expedition_id=shipment_id,
            event_type='SHIPMENT_PLANNING_CHANGED', title='Départ prévu modifié', description=reason,
            actor_id=actor, metadata={'before': old.isoformat() if old else None,
                                    'after': planned_departure_at.isoformat() if planned_departure_at else None})
        return {'changed': True}
