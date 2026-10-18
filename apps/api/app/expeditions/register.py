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


def departure_calendar(org_id, *, start, end):
    """Read-only calendar projection of the canonical expedition records."""
    with engine.connect() as conn:
        items = conn.execute(text("""select e.id::text,e.expedition_reference as reference,
            e.status,e.planned_departure_at,e.departed_at,
            coalesce(e.departed_at,e.planned_departure_at) as calendar_at,
            e.route_label,e.origin_city,e.origin_country,e.destination_city,e.destination_country,
            (select count(*) from expedition_packages ep
              join cargo_packages p on p.id=ep.package_id and p.org_id=ep.org_id
              where ep.org_id=e.org_id and ep.expedition_id=e.id and ep.removed_at is null
                and p.deleted_at is null) as packages_count
            from cargo_expeditions e
            where e.org_id=:org_id and e.archived_at is null and e.deleted_at is null
              and coalesce(e.departed_at,e.planned_departure_at) >= cast(:start as timestamptz)
              and coalesce(e.departed_at,e.planned_departure_at) < cast(:end as timestamptz)
            order by coalesce(e.departed_at,e.planned_departure_at),e.expedition_reference
            limit 501"""), {'org_id':org_id,'start':start,'end':end}).mappings().all()
    return {'items':[dict(row) for row in items[:500]],'truncated':len(items)>500}


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
            origin_city,origin_country,destination_city,destination_country,transport_mode,
            coalesce((select jsonb_agg(jsonb_build_object('id',s.id::text,'name',s.service_name,
                'mode',s.shipping_mode) order by s.priority,s.service_name)
              from service_route_offerings offering join shipping_services s
                on s.id=offering.service_id and s.org_id=offering.org_id
              where offering.org_id=r.org_id and offering.route_id=r.id
                and offering.effective_from<=now() and (offering.effective_until is null or offering.effective_until>now())
                and offering.availability in ('AVAILABLE','LIMITED','QUOTE_ONLY')
                and s.active and s.status in ('ACTIVE','LIMITED') and s.archived_at is null), '[]'::jsonb) as services
            from shipping_routes r where r.org_id=:org_id and r.active=true and r.archived_at is null
            and r.status in ('ACTIVE','LIMITED') and r.availability not in ('FULL','SUSPENDED','UNAVAILABLE')
            order by r.origin_country,r.origin_city,r.destination_country,r.destination_city,r.id"""), {'org_id': org_id}).mappings()]


def create(org_id, actor_id, route_id, planned_departure_at, request_key, shipping_service_id=None, notes=None):
    # The client-generated request key is the UUID identity of this creation only.
    # Persist the original payload hash in the creation event, not mutable fields.
    planned = planned_departure_at.astimezone(timezone.utc) if planned_departure_at else None
    fingerprint = hashlib.sha256(json.dumps({'route': route_id, 'service': shipping_service_id,
        'planned': planned.isoformat() if planned else None, 'notes': (notes or '').strip()}, sort_keys=True).encode()).hexdigest()
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
        service = None
        if shipping_service_id:
            service = conn.execute(text("""select s.service_name,s.shipping_mode from service_route_offerings o
                join shipping_services s on s.org_id=o.org_id and s.id=o.service_id
                where o.org_id=:org_id and o.route_id=cast(:route_id as uuid)
                  and o.service_id=cast(:service_id as uuid)
                  and o.effective_from<=now() and (o.effective_until is null or o.effective_until>now())
                  and o.availability in ('AVAILABLE','LIMITED','QUOTE_ONLY')
                  and s.active and s.status in ('ACTIVE','LIMITED') and s.archived_at is null"""),
                {'org_id': org_id, 'route_id': route_id, 'service_id': shipping_service_id}).first()
            if not service:
                raise HTTPException(409, 'shipment_service_unavailable_for_route')
        transport_mode = service['shipping_mode'] if service else route['transport_mode']
        reference = generate_expedition_reference()
        conn.execute(text("""insert into cargo_expeditions
            (id,org_id,expedition_reference,status,mode,service_type,route_id,shipping_service_id,notes,route_label,workflow_version,
             origin_country,origin_city,destination_country,destination_city,
             planned_departure_at,created_by,updated_by)
            values(cast(:id as uuid),:org_id,:reference,'PREPARING',:transport_mode,:service_name,
             cast(:route_id as uuid),cast(:service_id as uuid),:notes,:route_name,2,:origin_country,:origin_city,
             :destination_country,:destination_city,:planned,:actor,:actor)"""),
            {**dict(route), 'id': request_key, 'org_id': org_id, 'reference': reference,
             'transport_mode': transport_mode, 'service_name': service['service_name'] if service else None,
             'route_id': route_id, 'service_id': shipping_service_id, 'notes': (notes or '').strip() or None,
             'planned': planned, 'actor': actor_id})
        _insert_event(conn, org_id=org_id, expedition_id=request_key,
            event_type='EXPEDITION_CREATED', title='Expédition prévue', new_status='PREPARING',
            actor_id=actor_id, metadata={'creation_hash': fingerprint, 'route_id': route_id,
                                      'planned_departure_at': planned.isoformat() if planned else None,
                                      'shipping_service_id': shipping_service_id,
                                      'notes': (notes or '').strip() or None})
        return {'id': request_key, 'reference': reference, 'replayed': False}
