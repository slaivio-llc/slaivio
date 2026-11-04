"""Private invoice delivery through the durable, single-claim notification outbox."""
import json
import re
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine
from app.customer_automation.repository import permitted
from app.db.notification_repository import create_notification_outbox
from app.documents.agency_brand import identity
from app.finance.invoice_pdf import render, filename

ISSUED = {'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'}


def phone(value):
    value = str(value or '').strip()
    if not re.fullmatch(r'\+?[0-9 ()\-.]+', value): return None
    digits = re.sub(r'\D', '', value)
    return '+' + digits if re.fullmatch(r'[1-9][0-9]{7,14}', digits) else None


def recipient(c, org_id, client_id):
    row = c.execute(text("""select coalesce(nullif(cl.whatsapp_phone,''),cl.phone) phone,
        coalesce(cl.display_name,cl.name,'Client') name from clients cl
        join organizations o on o.id=cl.org_id and o.status='ACTIVE'
        where cl.org_id=:o and cl.id=:client and cl.deleted_at is null"""),
        {'o': org_id, 'client': client_id}).mappings().first()
    number = phone(row['phone']) if row else None
    if not number or not permitted(c, org_id, number): return None
    return {'phone': number, 'name': row['name']}


def queue(c, org_id, document, request_key='issued', *, automatic=True):
    if document['document_type'] != 'INVOICE' or document['status'] not in ISSUED:
        if automatic: return None
        raise HTTPException(422, 'Seule une facture émise peut être envoyée au client.')
    config = dict(c.execute(text('select * from finance_settings where org_id=:o'), {'o':org_id}).mappings().first() or {})
    if automatic and not config.get('invoice_whatsapp_enabled'): return None
    # Callers hold the document row lock: concurrent clicks cannot create two sends.
    existing = c.execute(text("""select n.id,n.status,n.dispatch_state,d.request_key,d.snapshot
        from finance_invoice_deliveries d join notification_outbox n on n.id=d.notification_id and n.org_id=d.org_id
        where d.org_id=:o and d.document_id=:d order by d.created_at desc,d.id desc limit 1"""),
        {'o':org_id,'d':document['id']}).mappings().first()
    if existing and (existing['request_key'] == request_key or existing['dispatch_state'] in ('CLAIMED','UNKNOWN')
                     or existing['status'] == 'PENDING'):
        return str(existing['id'])
    prior = c.execute(text('select notification_id from finance_invoice_deliveries where org_id=:o and document_id=:d and request_key=:key'),
                      {'o':org_id,'d':document['id'],'key':request_key}).scalar()
    if prior: return str(prior)
    contact = recipient(c, org_id, document['client_id'])
    if not contact:
        if automatic: return None
        raise HTTPException(422, 'Vérifiez le numéro WhatsApp du client et son accord pour recevoir vos messages.')
    doc = dict(document)
    doc.update(client_name=contact['name'], client_phone=contact['phone'])
    doc['lines'] = [dict(row) for row in c.execute(text('select * from finance_document_lines where org_id=:o and document_id=:d order by position'),
                                                {'o':org_id,'d':doc['id']}).mappings()]
    brand = identity(c, org_id, doc.get('office_id'))
    # Keep only document settings, never credentials or payment integration secrets.
    safe_settings = {key:config.get(key) for key in ('legal_name','billing_address','tax_identifier','document_footer')}
    snapshot = json.dumps(existing['snapshot'] if existing else {'document':doc,'brand':brand,'settings':safe_settings}, default=str)
    notification = create_notification_outbox(org_id, str(doc['client_id']), None, contact['phone'],
        'INVOICE_PDF:' + str(doc['id']),
        f"Bonjour, voici votre facture {doc['document_number']} en pièce jointe. Merci de votre confiance.", connection=c)
    c.execute(text('''insert into finance_invoice_deliveries(org_id,document_id,notification_id,request_key,snapshot)
        values(:o,:d,:n,:key,cast(:snapshot as jsonb))'''),
        {'o':org_id,'d':doc['id'],'n':notification['id'],'key':request_key,'snapshot':snapshot})
    return str(notification['id'])


def request_send(org_id, document_id, key):
    with engine.begin() as c:
        document = c.execute(text('select * from finance_documents where org_id=:o and id=:d for update'),
                             {'o':org_id,'d':document_id}).mappings().first()
        if not document: raise HTTPException(404, 'Facture introuvable.')
        return queue(c, org_id, document, key, automatic=False)


def prepare(notification):
    with engine.connect() as c:
        row = c.execute(text('''select x.snapshot,d.client_id,d.status,d.document_type from finance_invoice_deliveries x
            join finance_documents d on d.id=x.document_id and d.org_id=x.org_id
            where x.org_id=:o and x.notification_id=:n'''),
            {'o':notification['org_id'],'n':notification['id']}).mappings().first()
        if not row or row['document_type'] != 'INVOICE' or row['status'] not in ISSUED:
            raise ValueError('invoice_no_longer_eligible')
        contact = recipient(c, notification['org_id'], row['client_id'])
        if not contact or contact['phone'] != notification['recipient_phone']:
            raise ValueError('invoice_recipient_changed_or_opted_out')
        snapshot = row['snapshot']
    return {'content':render(snapshot), 'filename':filename(snapshot['document']['document_number']),
            'dispatch_id':str(notification['id'])}


def status(org_id, document_id):
    with engine.connect() as c:
        enabled = bool(c.execute(text('select invoice_whatsapp_enabled from finance_settings where org_id=:o'), {'o':org_id}).scalar())
        row = c.execute(text('''select n.id,n.status,n.dispatch_state,n.dispatch_started_at,n.sent_at from finance_invoice_deliveries x
            join notification_outbox n on n.id=x.notification_id and n.org_id=x.org_id
            where x.org_id=:o and x.document_id=:d order by x.created_at desc,x.id desc limit 1'''),
            {'o':org_id,'d':document_id}).mappings().first()
        state = 'NOT_SENT'
        if row:
            if row['status'] in ('SENT','DELIVERED','READ'): state='SENT'
            elif row['dispatch_state'] == 'UNKNOWN': state='CHECK_REQUIRED'
            elif row['dispatch_state'] == 'CLAIMED':
                started = row['dispatch_started_at']
                state='SENDING' if started and started > datetime.now(timezone.utc)-timedelta(minutes=5) else 'CHECK_REQUIRED'
            elif row['status'] == 'PENDING': state='QUEUED'
            else: state='FAILED'
        return {'automatic':enabled,'state':state,'sent_at':row['sent_at'] if row else None}


def configure(org_id, enabled):
    with engine.begin() as c:
        c.execute(text('''insert into finance_settings(org_id,invoice_whatsapp_enabled) values(:o,:enabled)
            on conflict(org_id) do update set invoice_whatsapp_enabled=excluded.invoice_whatsapp_enabled'''),
            {'o':org_id,'enabled':enabled})
    return {'automatic':enabled}


def dispatch_pending(org_id, document_id):
    from app.services.notification_sender import send_notification
    with engine.connect() as c:
        ids = c.execute(text('''select n.id from finance_invoice_deliveries x
            join notification_outbox n on n.id=x.notification_id and n.org_id=x.org_id
            where x.org_id=:o and x.document_id=:d and n.status='PENDING' and n.dispatch_state='IDLE' '''),
            {'o':org_id,'d':document_id}).scalars().all()
    for notification_id in ids: send_notification(org_id, str(notification_id))
