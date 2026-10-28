"""Bounded platform registers. No provider credentials or raw customer payloads."""
from math import ceil

from sqlalchemy import text

from app.db.database import engine


REGISTERS = {
    'agencies': ('''select o.id,coalesce(o.organization_name,o.name) name,o.email,o.country,o.city,
        o.status,o.created_at,s.status subscription_status,p.name plan_name,
        (select count(*) from organizations b where b.parent_org_id=o.id) spaces
        from organizations o left join agency_subscriptions s on s.org_id=o.id
        left join pricing_plans p on p.id=s.pricing_plan_id where o.parent_org_id is null''',
        ['name', 'email', 'country', 'city'], 'status', 'created_at'),
    'subscriptions': ('''select s.id,s.org_id,coalesce(o.organization_name,o.name) agency,
        p.name plan_name,s.status,s.billing_cycle,s.starts_at,s.ends_at,s.trial_ends_at,s.created_at
        from agency_subscriptions s join organizations o on o.id=s.org_id
        left join pricing_plans p on p.id=s.pricing_plan_id where o.parent_org_id is null''',
        ['agency', 'org_id', 'plan_name'], 'status', 'created_at'),
    'invoices': ('''select i.id,i.org_id,coalesce(o.organization_name,o.name) agency,
        i.invoice_number,i.status,i.amount_minor,i.amount_paid_minor,i.currency_code,
        coalesce(i.due_at,i.due_date) due_at,i.paid_at,i.created_at
        from billing_invoices i join organizations o on o.id=i.org_id''',
        ['agency', 'invoice_number', 'org_id'], 'status', 'created_at'),
    'checkouts': ('''select c.id,c.org_id,coalesce(o.organization_name,o.name) agency,
        c.status,c.amount_minor,c.currency_code,c.provider_session_id,c.verified_at,c.created_at
        from billing_checkout_sessions c join organizations o on o.id=c.org_id''',
        ['agency', 'org_id', 'provider_session_id'], 'status', 'created_at'),
    'support': ('''select t.id,t.ticket_reference,t.subject,t.priority,t.status,t.created_at,
        t.updated_at,t.first_response_due_at,t.assigned_name,coalesce(o.organization_name,o.name) agency
        from support_tickets t join organizations o on o.id=t.org_id''',
        ['agency', 'ticket_reference', 'subject'], 'status', 'updated_at'),
    'audit': ('''select id,actor_user_id,action,target_type,target_id,reason,created_at
        from platform_admin_audit_log''',
        ['actor_user_id', 'action', 'target_id', 'reason'], 'action', 'created_at'),
    'quarantine': ('''select id,provider,routing_status status,signature_verified,
        retry_count,received_at created_at,resolved_org_id
        from platform_inbound_event_envelopes where routing_status<>'PROCESSED' ''',
        ['provider', 'resolved_org_id'], 'status', 'created_at'),
}


def register(kind, q=None, status=None, page=1, page_size=25):
    base, searchable, status_key, order = REGISTERS[kind]
    clauses, params = ['true'], {'limit': page_size, 'offset': (page - 1) * page_size}
    if q and q.strip():
        clauses.append('(' + ' or '.join(f'{column} ilike :q' for column in searchable) + ')')
        params['q'] = '%' + q.strip() + '%'
    if status:
        clauses.append(f'{status_key}=:status')
        params['status'] = status
    query = f"from ({base}) register where {' and '.join(clauses)}"
    with engine.connect() as conn:
        total = conn.execute(text('select count(*) ' + query), params).scalar_one()
        rows = conn.execute(text(f'select * {query} order by {order} desc,id desc limit :limit offset :offset'), params).mappings().all()
    return {'items': [dict(row) for row in rows], 'total': total, 'page': page,
            'page_size': page_size, 'total_pages': max(1, ceil(total / page_size))}


def ticket(ticket_id):
    with engine.connect() as conn:
        row = conn.execute(text('''select t.*,coalesce(o.organization_name,o.name) agency
            from support_tickets t join organizations o on o.id=t.org_id where t.id=:id'''), {'id': ticket_id}).mappings().first()
        if not row:
            return None
        messages = conn.execute(text('''select id,author_name,author_type,message,internal,created_at
            from support_ticket_messages where ticket_id=:id order by created_at,id limit 500'''), {'id': ticket_id}).mappings().all()
    return {'ticket': dict(row), 'messages': [dict(message) for message in messages]}


def plans():
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(text('''select p.id,p.code,p.name,p.active,
            p.monthly_price_minor,p.currency_code,
            coalesce((select jsonb_object_agg(e.entitlement_key,e.limit_value)
                from plan_entitlements e where e.plan_code=p.code and e.entitlement_type='LIMIT'),'{}') limits
            from pricing_plans p order by p.monthly_price_minor,p.code''')).mappings().all()]


def operations():
    with engine.connect() as conn:
        notifications = [dict(row) for row in conn.execute(text('''select status,count(*)::int count,
            min(created_at) oldest_at from notification_outbox group by status order by status''')).mappings().all()]
        automations = [dict(row) for row in conn.execute(text('''select status,count(*)::int count,
            min(created_at) oldest_at from customer_automation_events group by status order by status''')).mappings().all()]
        overdue = conn.execute(text('''select count(*) from customer_automation_events
            where status='PENDING' and available_at<now()-interval '15 minutes' ''')).scalar_one()
    return {'notifications': notifications, 'automations': automations,
            'overdue_automations': overdue}


def spaces(org_id):
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(text('''select id,
            coalesce(organization_name,name) name,agency_type,status,country,city
            from organizations where parent_org_id=:org order by name,id'''), {'org': org_id}).mappings().all()]


def capacity(org_id):
    with engine.connect() as conn:
        exists = conn.execute(text('select 1 from organizations where id=:org'), {'org': org_id}).scalar()
        if not exists:
            return None
        return conn.execute(text('select billing_capacity(:org)'), {'org': org_id}).scalar_one()
