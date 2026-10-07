from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.dashboard.periods import resolve_period


def cargo_overview(tenant, permissions, **options):
    if 'packages.read' not in permissions:
        raise HTTPException(403, 'packages_read_required')
    scope = options.pop('scope', 'office')
    if scope == 'network' and 'network.overview' not in permissions:
        raise HTTPException(403, 'network_overview_required')
    with engine.connect() as conn:
        office = conn.execute(text("""
            select o.id, coalesce(o.organization_name,o.name,o.id) name, o.country, o.city,
              coalesce(nullif(settings.timezone,''),'UTC') timezone,
              o.organization_type, o.group_id::text
            from organizations o left join organization_settings settings on settings.org_id=o.id
            where o.id=:org_id and o.status='ACTIVE'
        """), {'org_id': tenant['org_id']}).mappings().first()
        if not office or office['organization_type'] not in ('PARCEL_FREIGHT', 'CARGO'):
            raise HTTPException(403, 'cargo_workspace_required')
        try:
            period = resolve_period(timezone_name=office['timezone'], **options)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        office_ids = [tenant['org_id']]
        if scope == 'network':
            if not office['group_id']:
                raise HTTPException(409, 'network_not_configured')
            office_ids = list(conn.execute(text("""
                select o.id from organizations o
                where o.group_id=cast(:group_id as uuid) and o.status='ACTIVE'
                  and o.organization_type in ('PARCEL_FREIGHT','CARGO')
                  and (exists(select 1 from organization_network_memberships m
                    where m.group_id=o.group_id and m.clerk_user_id=:user_id
                      and m.status='ACTIVE' and m.access_scope='ALL_OFFICES')
                  or exists(select 1 from organization_memberships m
                    where m.org_id=o.id and m.clerk_user_id=:user_id and m.status='ACTIVE'))
            """), {'group_id': office['group_id'], 'user_id': tenant['user_id']}).scalars())
            if not office_ids:
                raise HTTPException(403, 'no_authorized_offices')
        params = {'org_ids': office_ids, 'org_id': tenant['org_id']}
        # Owned parcels are counted once; the active office also sees inbound parcels.
        predicate = 'p.org_id=any(cast(:org_ids as text[]))'
        if scope == 'office':
            predicate = f'({predicate} or p.destination_org_id=:org_id)'
        base = f'from cargo_packages p where {predicate} and p.deleted_at is null'

        def row(sql, extra=None):
            return dict(conn.execute(text(sql), {**params, **(extra or {})}).mappings().one())

        def flow(interval):
            return row(f"""select
                count(*) filter(where received_at>=:start and received_at<:end)::int received,
                count(*) filter(where dispatched_at>=:start and dispatched_at<:end)::int shipped,
                count(*) filter(where delivered_at>=:start and delivered_at<:end)::int delivered
                {base}
            """, {'start': interval['start_utc'], 'end': interval['end_utc']})

        current = flow(period['current'])
        previous = flow(period['previous']) if period['previous'] else None
        states = row(f"""select
            count(*) filter(where status in ('IN_TRANSIT','SHIPPED','DEPARTED','ARRIVED_HUB','IN_LOCAL_TRANSIT'))::int in_transit,
            count(*) filter(where status='READY_FOR_PICKUP')::int ready_for_pickup,
            count(*) filter(where status='BLOCKED')::int blocked,
            count(*) filter(where status in ('RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','WAREHOUSE_PROCESSING'))::int warehoused
            {base}""")
        details = """p.id::text, p.org_id, p.package_reference reference, p.status,
            p.destination_country, p.destination_city, p.eta_at, p.updated_at"""
        attention = [dict(item) for item in conn.execute(text(f"""
            select {details}, case when status='BLOCKED' then 'blocked' else 'overdue' end reason
            {base} and (status='BLOCKED' or (eta_at<now() and status not in ('DELIVERED','CANCELLED','RETURNED')))
            order by (status='BLOCKED') desc, eta_at asc nulls last, p.id limit 10
        """), params).mappings()]
        interval_params = {**params, 'start': period['current']['start_utc'], 'end': period['current']['end_utc']}
        recent = [dict(item) for item in conn.execute(text(f"""
            select {details} {base} and received_at>=:start and received_at<:end
            order by received_at desc,p.id limit 8
        """), interval_params).mappings()]
        destinations = [dict(item) for item in conn.execute(text(f"""
            select destination_country country, destination_city city,
              count(*)::int received, count(*) filter(where status='DELIVERED')::int delivered
            {base} and received_at>=:start and received_at<:end
            group by destination_country,destination_city order by count(*) desc,1,2 limit 8
        """), interval_params).mappings()]
        for item in attention + recent:
            item['href'] = f"/app/packages?open={item['id']}" if scope == 'office' or item['org_id'] == tenant['org_id'] else None
        return {'workspace': dict(office), 'scope': scope, 'office_count': len(office_ids),
                'period': period, 'generated_at': datetime.now(timezone.utc),
                'flows': current, 'previous_flows': previous, 'states': states,
                'attention': attention, 'recent': recent, 'destinations': destinations}
