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


def read_section(org_id: str, client_id: str, section: str, page: int = 1):
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
        source = SOURCES[section]
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
