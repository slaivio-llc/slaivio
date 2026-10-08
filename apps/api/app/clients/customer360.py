"""Read-only Cargo CRM projections. Business modules remain the source of truth."""
from sqlalchemy import text

from app.db.database import engine


SECTION_PERMISSIONS = {
    'overview': 'clients.read',
    'packages': 'packages.read',
    'shipments': 'shipments.read',
    'finance': 'finance.read',
    'communications': 'inbox.read',
    'activity': 'clients.read',
}

# Every source is explicitly scoped by office and client; never interpolate user SQL.
SOURCES = {
    'packages': """
        select id::text, package_reference reference, status, tracking_id,
               destination_city, destination_country, weight_kg, updated_at occurred_at
        from cargo_packages where org_id=:org_id and client_id=cast(:client_id as uuid)
          and deleted_at is null
    """,
    'shipments': """
        select e.id::text, e.expedition_reference reference, e.status,
               e.destination_city, e.destination_country, e.mode, e.updated_at occurred_at
        from cargo_expeditions e where e.org_id=:org_id and e.archived_at is null
        and exists (
            select 1 from expedition_packages ep
            join cargo_packages p on p.id=ep.package_id and p.org_id=ep.org_id
            where ep.org_id=e.org_id and ep.expedition_id=e.id and ep.removed_at is null
              and p.client_id=cast(:client_id as uuid) and p.deleted_at is null
        )
    """,
    'finance': """
        select id::text, id::text document_id, document_number reference, document_type, status, currency,
               total, amount_paid, balance_due, created_at occurred_at
        from finance_documents where org_id=:org_id and client_id=cast(:client_id as uuid)
        union all
        select payment.id::text, document.id::text document_id, payment.receipt_number reference,
               'RECEIPT' document_type, payment.status, payment.currency, payment.amount total,
               payment.amount amount_paid, null balance_due, payment.paid_at occurred_at
        from finance_payments payment join finance_documents document
          on document.id=payment.document_id and document.org_id=payment.org_id
        where payment.org_id=:org_id and document.client_id=cast(:client_id as uuid)
    """,
    'communications': """
        select id::text, direction, text_body, send_status status, created_at occurred_at
        from messages where org_id=:org_id and client_id=cast(:client_id as uuid)
          and not coalesce(is_group,false)
          and coalesce(sender_jid,'') not like '%@newsletter'
          and coalesce(conversation_jid,'') not like '%@newsletter'
    """,
    'activity': """
        select id::text, action, created_at occurred_at
        from audit_logs where org_id=:org_id and entity_type='client' and entity_id=:client_id
          and action in ('client.created','client.updated','client.archived','client.restored',
                         'client.merged','client.merged_into')
    """,
}


def activity_source(permissions: set[str]) -> str:
    sources = ["""select 'client-' || id::text id, action, null::text title,
        null::text reference, null::text resource_id, 'client' resource_type, created_at occurred_at
        from audit_logs where org_id=:org_id and entity_type='client' and entity_id=:client_id
        and action in ('client.created','client.updated','client.archived','client.restored',
                       'client.merged','client.merged_into')"""]
    if 'packages.read' in permissions:
        sources.append("""select 'package-' || e.id::text id, e.event_type action, e.title,
            p.package_reference reference, p.id::text resource_id, 'package' resource_type,
            e.created_at occurred_at from package_events e
            join cargo_packages p on p.id=e.package_id and p.org_id=e.org_id
            where e.org_id=:org_id and p.client_id=cast(:client_id as uuid)""")
    if 'shipments.read' in permissions:
        sources.append("""select 'shipment-' || e.id::text id,e.event_type action,e.title,
            s.expedition_reference reference,s.id::text resource_id,'shipment' resource_type,e.occurred_at
            from expedition_events e join cargo_expeditions s on s.id=e.expedition_id and s.org_id=e.org_id
            where e.org_id=:org_id and exists (
                select 1 from expedition_packages ep join cargo_packages p
                  on p.id=ep.package_id and p.org_id=ep.org_id
                where ep.org_id=s.org_id and ep.expedition_id=s.id
                  and p.client_id=cast(:client_id as uuid)
                  and e.occurred_at>=ep.added_at and (ep.removed_at is null or e.occurred_at<=ep.removed_at)
            )""")
    if 'finance.read' in permissions:
        sources.append("""select 'finance-' || e.id::text id,e.event_type action,
            null::text title,d.document_number reference,d.id::text resource_id,'finance' resource_type,
            e.created_at occurred_at from finance_events e
            join finance_documents d on d.id=e.document_id and d.org_id=e.org_id
            where e.org_id=:org_id and d.client_id=cast(:client_id as uuid)""")
    if 'inbox.read' in permissions:
        sources.append("""select 'message-' || id::text id,
            case when direction='outbound' then 'message.outbound' else 'message.inbound' end action,
            null::text title,null::text reference,null::text resource_id,'message' resource_type,
            created_at occurred_at from messages where org_id=:org_id and client_id=cast(:client_id as uuid)
              and not coalesce(is_group,false) and coalesce(sender_jid,'') not like '%@newsletter'
              and coalesce(conversation_jid,'') not like '%@newsletter'""")
    return ' union all '.join(sources)


def read_section(org_id: str, client_id: str, section: str, page: int = 1, *, permissions: set[str] | None = None):
    params = {'org_id': org_id, 'client_id': client_id, 'offset': (page - 1) * 25}
    with engine.connect() as conn:
        client = conn.execute(text('''
            select id::text, client_reference, display_name, name, company_name, customer_type,
                   phone, email, address, country, city, created_at, last_activity_at, row_version,
                   org_id, lifecycle_status, source, updated_at
            from clients where org_id=:org_id and id=cast(:client_id as uuid) and deleted_at is null
        '''), params).mappings().first()
        if client is None:
            return None
        if section == 'overview':
            return {'client': dict(client)}
        source = activity_source(permissions or set()) if section == 'activity' else SOURCES[section]
        total = conn.execute(text(f'select count(*) from ({source}) scoped'), params).scalar_one()
        rows = conn.execute(text(f'''select * from ({source}) scoped
            order by occurred_at desc nulls last, id desc limit 25 offset :offset'''), params).mappings().all()
        result = {'items': [dict(row) for row in rows], 'total': total, 'page': page, 'page_size': 25}
        if section == 'finance':
            # Never total currencies together; drafts/quotes are not receivables.
            balances = conn.execute(text('''
                select currency, coalesce(sum(amount_paid),0) paid,
                       coalesce(sum(balance_due),0) outstanding
                from finance_documents where org_id=:org_id and client_id=cast(:client_id as uuid)
                  and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID','OVERDUE','PAID')
                group by currency order by currency
            '''), params).mappings().all()
            result['balances'] = [dict(row) for row in balances]
        return result
