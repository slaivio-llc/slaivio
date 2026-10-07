from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text

from app.db.database import engine
from app.dashboard.periods import resolve_period
from app.dashboard.finance_summary import finance_summary

FLOW_COLUMNS = {'received': 'received_at', 'shipped': 'dispatched_at', 'delivered': 'delivered_at'}
STATE_FILTERS = {
    'in_transit': "status in ('IN_TRANSIT','SHIPPED','DEPARTED','ARRIVED_HUB','IN_LOCAL_TRANSIT')",
    'ready_for_pickup': "status='READY_FOR_PICKUP'",
    'blocked': "status='BLOCKED'",
    'warehoused': "status in ('RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','WAREHOUSE_PROCESSING')",
}


def metric_predicate(metric):
    if metric in FLOW_COLUMNS:
        column = FLOW_COLUMNS[metric]
        return f'{column}>=:start and {column}<:end'
    if metric in STATE_FILTERS:
        return STATE_FILTERS[metric]
    raise HTTPException(422, 'invalid_metric')


def cargo_overview(tenant, permissions, **options):
    if 'packages.read' not in permissions:
        raise HTTPException(403, 'packages_read_required')
    scope = options.pop('scope', 'office')
    metric = options.pop('metric', None)
    page = options.pop('page', 1)
    metric_filter = metric_predicate(metric) if metric else None
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
        state_columns = ','.join(f'count(*) filter(where {condition})::int {key}'
                                 for key, condition in STATE_FILTERS.items())
        states = row(f'select {state_columns} {base}')
        details = """p.id::text, p.org_id, p.package_reference reference, p.status,
            p.destination_country, p.destination_city, p.eta_at, p.updated_at"""
        drilldown = None
        if metric_filter:
            drill_params = {**params, 'start': period['current']['start_utc'],
                            'end': period['current']['end_utc'], 'offset': (page-1)*25}
            total = row(f'select count(*)::int total {base} and ({metric_filter})', drill_params)['total']
            matches = [dict(item) for item in conn.execute(text(f'''
                select {details} {base} and ({metric_filter})
                order by p.updated_at desc,p.id limit 25 offset :offset
            '''), drill_params).mappings()]
            for item in matches:
                item['href'] = f"/app/packages?open={item['id']}" if scope == 'office' or item['org_id'] == tenant['org_id'] else None
            drilldown = {'metric': metric, 'page': page, 'page_size': 25, 'total': total, 'items': matches}
        attention = [dict(item) for item in conn.execute(text(f"""
            select {details}, case when status='BLOCKED' then 'blocked' else 'overdue' end reason
            {base} and (status='BLOCKED' or (eta_at<now() and status not in ('DELIVERED','CANCELLED','RETURNED')))
            order by (status='BLOCKED') desc, eta_at asc nulls last, p.id limit 10
        """), params).mappings()]
        upcoming = [dict(item) for item in conn.execute(text(f"""
            select {details} {base}
              and eta_at>=now() and eta_at<now()+interval '7 days'
              and status not in ('DELIVERED','CANCELLED','RETURNED')
            order by eta_at,p.id limit 10
        """), params).mappings()]
        departures = None
        if 'departures.read' in permissions:
            departures = [dict(item) for item in conn.execute(text('''
                select id::text,org_id,departure_code,scheduled_at,cutoff_at,status
                from cargo_departures
                where org_id=any(cast(:org_ids as text[]))
                  and status in ('OPEN','CLOSED','LOADING')
                  and scheduled_at>=now() and scheduled_at<now()+interval '7 days'
                order by scheduled_at,id limit 10
            '''), params).mappings()]
        interval_params = {**params, 'start': period['current']['start_utc'], 'end': period['current']['end_utc']}
        trend = [dict(item) for item in conn.execute(text(f'''
            select (received_at at time zone :timezone)::date day,count(*)::int received
            {base} and received_at>=:start and received_at<:end
            group by 1 order by 1
        '''), {**interval_params,'timezone':period['timezone']}).mappings()]
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
        for item in attention + recent + upcoming:
            item['href'] = f"/app/packages?open={item['id']}" if scope == 'office' or item['org_id'] == tenant['org_id'] else None
        finance = finance_summary(conn, tenant['org_id'], permissions, period)
        return {'workspace': dict(office), 'scope': scope, 'office_count': len(office_ids), 'finance': finance,
                'period': period, 'generated_at': datetime.now(timezone.utc),
                'flows': current, 'previous_flows': previous, 'states': states,
                'attention': attention, 'recent': recent, 'destinations': destinations,
                'drilldown': drilldown, 'upcoming': upcoming, 'departures': departures, 'trend': trend}
