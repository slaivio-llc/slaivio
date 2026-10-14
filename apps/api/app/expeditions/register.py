"""Compact freight projections and creation on the existing expedition aggregate."""
import hashlib
import json
from datetime import timezone
from math import ceil

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.expeditions.repository import _insert_event, generate_expedition_reference


STAGE = """case
 when e.status in ('CANCELLED','ARCHIVED') then 'other'
 when e.arrived_at is not null or e.status in ('ARRIVED_DESTINATION','AVAILABLE_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED') then 'arrived'
 when e.departed_at is not null or e.status in ('DISPATCHED','IN_TRANSIT') then 'departed'
 when e.status in ('DRAFT','PREPARING','LOADING','READY_FOR_DEPARTURE') then 'planned'
 else 'other' end"""


def listing(org_id, *, q='', stage=None, start=None, end=None, page=1, origin=None, destination=None):
    filters = ['e.org_id=:org_id', 'e.archived_at is null', 'e.deleted_at is null']
    params = {'org_id': org_id, 'offset': (page-1)*50}
    for key,value in [('origin',origin),('destination',destination)]:
        if value:
            filters.append(f"concat_ws(', ',e.{key}_city,e.{key}_country)=:{key}")
            params[key]=value
    if q.strip():
        filters.append("e.expedition_reference ilike :q escape '!'")
        params['q'] = '%' + q.strip().replace('!', '!!').replace('%', '!%').replace('_', '!_') + '%'
    if stage:
        filters.append(f'({STAGE})=:stage')
        params['stage'] = stage
    if start:
        filters.append("e.created_at >= (cast(:start as date)::timestamp at time zone 'UTC')")
        params['start'] = start
    if end:
        filters.append("e.created_at < ((cast(:end as date)+1)::timestamp at time zone 'UTC')")
        params['end'] = end
    where = ' and '.join(filters)
    with engine.connect() as conn:
        total = conn.execute(text(f'select count(*) from cargo_expeditions e where {where}'), params).scalar_one()
        items = conn.execute(text(f"""select e.id::text,e.expedition_reference as reference,
            e.origin_city,e.origin_country,e.destination_city,e.destination_country,
            e.status,({STAGE}) as stage,e.planned_departure_at,e.departed_at,e.arrived_at,
            (select count(*) from expedition_packages ep
              join cargo_packages p on p.id=ep.package_id and p.org_id=ep.org_id
              where ep.org_id=e.org_id and ep.expedition_id=e.id and ep.removed_at is null
                and p.deleted_at is null) as packages_count
            from cargo_expeditions e where {where}
            order by e.created_at desc,e.id desc limit 50 offset :offset"""), params).mappings()
        return {'items': [dict(row) for row in items], 'total': total, 'page': page, 'total_pages': ceil(total/50)}


def locations(org_id):
    with engine.connect() as conn:
        rows=conn.execute(text("""select distinct concat_ws(', ',origin_city,origin_country) as origin,
            concat_ws(', ',destination_city,destination_country) as destination
            from cargo_expeditions where org_id=:org_id and archived_at is null and deleted_at is null"""),
            {'org_id':org_id}).mappings().all()
        return {'origins':sorted({row['origin'] for row in rows if row['origin']}),
                'destinations':sorted({row['destination'] for row in rows if row['destination']})}


def routes(org_id):
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(text("""select id::text,route_name,
            origin_city,origin_country,destination_city,destination_country,transport_mode
            from shipping_routes where org_id=:org_id and active=true and archived_at is null
            and status in ('ACTIVE','LIMITED') and availability not in ('FULL','SUSPENDED','UNAVAILABLE')
            order by origin_country,origin_city,destination_country,destination_city,id"""), {'org_id': org_id}).mappings()]


def create(org_id, actor_id, route_id, planned_departure_at, request_key):
    # The client-generated request key is the UUID identity of this creation only.
    # Persist the original payload hash in the creation event, not mutable fields.
    planned = planned_departure_at.astimezone(timezone.utc) if planned_departure_at else None
    fingerprint = hashlib.sha256(json.dumps({'route': route_id, 'planned': planned.isoformat() if planned else None}, sort_keys=True).encode()).hexdigest()
    with engine.begin() as conn:
        conn.execute(text('select pg_advisory_xact_lock(hashtext(:key))'), {'key': f'expedition-create:{request_key}'})
        existing = conn.execute(text("""select e.org_id,e.created_by,e.expedition_reference,
            (select metadata->>'creation_hash' from expedition_events
             where org_id=e.org_id and expedition_id=e.id and event_type='EXPEDITION_CREATED'
             order by created_at,id limit 1) as creation_hash
            from cargo_expeditions e where e.id=cast(:id as uuid)"""), {'id': request_key}).mappings().first()
        if existing:
            if existing['org_id'] != org_id or existing['created_by'] != actor_id or existing['creation_hash'] != fingerprint:
                raise HTTPException(409, 'shipment_creation_key_conflict')
            return {'id': request_key, 'reference': existing['expedition_reference'], 'replayed': True}
        route = conn.execute(text("""select route_name,origin_country,origin_city,
            destination_country,destination_city,transport_mode from shipping_routes
            where org_id=:org_id and id=cast(:route_id as uuid) and active=true
            and archived_at is null and status in ('ACTIVE','LIMITED')
            and availability not in ('FULL','SUSPENDED','UNAVAILABLE')
            for share"""), {'org_id': org_id, 'route_id': route_id}).mappings().first()
        if not route:
            raise HTTPException(409, 'shipment_route_unavailable')
        if route['transport_mode'] not in {'AIR','SEA','ROAD','EXPRESS','GROUPAGE','OTHER'}:
            raise HTTPException(409, 'shipment_route_mode_invalid')
        reference = generate_expedition_reference()
        conn.execute(text("""insert into cargo_expeditions
            (id,org_id,expedition_reference,status,mode,route_id,route_label,workflow_version,
             origin_country,origin_city,destination_country,destination_city,
             planned_departure_at,created_by,updated_by)
            values(cast(:id as uuid),:org_id,:reference,'PREPARING',:transport_mode,
             cast(:route_id as uuid),:route_name,2,:origin_country,:origin_city,
             :destination_country,:destination_city,:planned,:actor,:actor)"""),
            {**dict(route), 'id': request_key, 'org_id': org_id, 'reference': reference,
             'route_id': route_id, 'planned': planned, 'actor': actor_id})
        _insert_event(conn, org_id=org_id, expedition_id=request_key,
            event_type='EXPEDITION_CREATED', title='Expédition prévue', new_status='PREPARING',
            actor_id=actor_id, metadata={'creation_hash': fingerprint, 'route_id': route_id,
                                      'planned_departure_at': planned.isoformat() if planned else None})
        return {'id': request_key, 'reference': reference, 'replayed': False}
