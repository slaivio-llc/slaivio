from math import ceil

from sqlalchemy import text

from app.db.database import engine
from app.platform_admin.repository import _audit


def listing(q=None, status=None, page=1, page_size=25):
    clauses = ['true']
    params = {'limit': page_size, 'offset': (page - 1) * page_size}
    if q:
        clauses.append('(full_name ilike :q or email ilike :q or agency_name ilike :q or phone ilike :q or country ilike :q)')
        params['q'] = f'%{q.strip()}%'
    if status:
        clauses.append('status=:status')
        params['status'] = status
    where = ' and '.join(clauses)
    with engine.connect() as conn:
        total = conn.execute(text(f'select count(*) from landing_demo_requests where {where}'), params).scalar_one()
        rows = conn.execute(text(f'''select id,full_name,email,agency_name,phone,country,
            monthly_shipments,message,status,source,created_at,updated_at
            from landing_demo_requests where {where}
            order by created_at desc,id desc limit :limit offset :offset'''), params).mappings().all()
    return {'items': [dict(row) for row in rows], 'total': total, 'page': page,
            'page_size': page_size, 'total_pages': max(1, ceil(total / page_size))}


def detail(request_id):
    with engine.connect() as conn:
        row = conn.execute(text('select * from landing_demo_requests where id=cast(:id as uuid)'), {'id': str(request_id)}).mappings().first()
        if not row:
            return None
        history = conn.execute(text('''select id,action,old_data,new_data,reason,created_at
            from platform_admin_audit_log where target_type='demo_request' and target_id=:id
            order by created_at desc,id desc limit 100'''), {'id': str(request_id)}).mappings().all()
    return {'request': dict(row), 'history': [dict(event) for event in history]}


def update(request_id, actor, status, expected_updated_at, note=None):
    with engine.begin() as conn:
        old = conn.execute(text('select * from landing_demo_requests where id=cast(:id as uuid) for update'), {'id': str(request_id)}).mappings().first()
        if not old:
            return 'missing'
        row = conn.execute(text('''update landing_demo_requests set status=:status,updated_at=clock_timestamp()
            where id=cast(:id as uuid) and updated_at=:expected returning *'''),
            {'id': str(request_id), 'status': status, 'expected': expected_updated_at}).mappings().first()
        if not row:
            return 'conflict'
        _audit(conn, actor, 'DEMO_REQUEST_UPDATED', 'demo_request', request_id,
               {'status': old['status']}, {'status': status}, (note or '').strip() or None)
        return dict(row)
