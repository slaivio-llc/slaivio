"""Transactional producers. Only the existing communication worker sends messages."""
import hashlib
import logging
import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text

from app.core.config import settings
from app.db.database import engine
from app.customer_automation.policy import CustomerAutomation, message

logger=logging.getLogger(__name__)


def money(value):
 return Decimal(str(value or 0)).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)


def context(c, org_id, client_id):
 row=c.execute(text("""select coalesce(o.organization_name,o.name,'Votre agence') agency,
  coalesce(s.settings->'customer_automation','{}') policy,coalesce(s.timezone,'UTC') timezone,
  coalesce(cl.display_name,cl.name,'') client,coalesce(nullif(cl.whatsapp_phone,''),cl.phone) phone
  from organizations o left join organization_settings s on s.org_id=o.id
  join clients cl on cl.org_id=o.id and cl.id=:client and cl.deleted_at is null
  where o.id=:o and o.status='ACTIVE'"""),{'o':org_id,'client':client_id}).mappings().first()
 if not row:return None
 result=dict(row)
 result['policy']=CustomerAutomation.model_validate(result['policy']).model_dump()
 return result


def permitted(c, org_id, phone, *, marketing=False):
 if not phone:return False
 params={'o':org_id,'phone':str(phone)}
 excluded=c.execute(text("""select 1 from broadcast_suppressions where org_id=:o
  and upper(channel)='WHATSAPP' and regexp_replace(contact,'[^0-9]','','g')=regexp_replace(:phone,'[^0-9]','','g')
  union all select 1 from broadcast_consents where org_id=:o and upper(channel)='WHATSAPP'
  and consent_status='OPTED_OUT' and regexp_replace(contact,'[^0-9]','','g')=regexp_replace(:phone,'[^0-9]','','g') limit 1"""),params).first()
 if excluded:return False
 if marketing:
  return bool(c.execute(text("""select 1 from broadcast_consents where org_id=:o
   and upper(channel)='WHATSAPP' and consent_status='OPTED_IN'
   and regexp_replace(contact,'[^0-9]','','g')=regexp_replace(:phone,'[^0-9]','','g') limit 1"""),params).first())
 return True


def queue(c,org_id,client_id,kind,entity_id,key,values,ctx=None):
 ctx=ctx or context(c,org_id,client_id)
 if not ctx or not permitted(c,org_id,ctx['phone'],marketing=kind=='next_departure'):return None
 if kind in ('awaiting_parcel','departure_blocked','pickup_reminder','storage_due'):
  # At most one operational reminder per recipient per rolling 24 hours.
  phone=''.join(char for char in str(ctx['phone']) if char.isdigit())
  c.execute(text('select pg_advisory_xact_lock(hashtextextended(:key,0))'),{'key':f'customer-reminder:{org_id}:{phone}'})
  if c.execute(text("""select 1 from notification_outbox where org_id=:o
   and regexp_replace(recipient_phone,'[^0-9]','','g')=:phone and created_at>now()-interval '24 hours'
   and status in ('PENDING','SENT','DELIVERED','READ')
   and (notification_type like 'CUSTOMER:awaiting_parcel:%' or notification_type like 'CUSTOMER:departure_blocked:%'
    or notification_type like 'CUSTOMER:pickup_reminder:%' or notification_type like 'CUSTOMER:storage_due:%') limit 1"""),{'o':org_id,'phone':phone}).first():return None
 notification_type=f"CUSTOMER:{kind}:{entity_id}:{hashlib.sha256(key.encode()).hexdigest()[:24]}"
 # Serializes retries without relying on a non-unique NOT EXISTS check.
 c.execute(text('select pg_advisory_xact_lock(hashtextextended(:key,0))'),{'key':f'{org_id}:{notification_type}'})
 body=message(ctx['policy'],kind,{**ctx,'conditions':ctx['policy']['pickup_conditions'],**values})
 row=c.execute(text("""insert into notification_outbox(org_id,client_id,channel,recipient_phone,notification_type,message)
  select :o,:client,'whatsapp',:phone,:kind,:message where not exists(
   select 1 from notification_outbox where org_id=:o and notification_type=:kind)
  returning id::text"""),{'o':org_id,'client':client_id,'phone':ctx['phone'],'kind':notification_type,'message':body}).first()
 return str(row[0]) if row else None


def storage_days(ready_at,now,grace_days,tz='UTC'):
 zone=ZoneInfo(tz)
 # Calendar days in the agency timezone, with a full configured grace period.
 return max(0,(now.astimezone(zone).date()-ready_at.astimezone(zone).date()).days-int(grace_days))


def accrue_storage(c,org_id,package_id,now=None):
 now=now or datetime.now(timezone.utc)
 account=c.execute(text("""select a.*,p.client_id,p.package_reference,p.currency package_currency,
  coalesce((select l.id from organization_locations l where l.org_id=p.org_id and l.location_type='OFFICE'
    and l.status='ACTIVE' and l.id in (p.destination_location_id,p.origin_location_id)
    order by (l.id=p.destination_location_id) desc limit 1),
   (select d.office_id from finance_documents d where d.org_id=p.org_id and d.package_id=p.id and d.status<>'VOID' limit 1)) storage_office_id
  from package_storage_accounts a join cargo_packages p on p.id=a.package_id and p.org_id=a.org_id
  where a.org_id=:o and a.package_id=:p and a.stopped_at is null and p.deleted_at is null
   and p.status='READY_FOR_PICKUP' for update of a"""),{'o':org_id,'p':package_id}).mappings().first()
 if not account:return money(0)
 days=storage_days(account['ready_at'],now,account['grace_days'],account['timezone'])
 rate=money(account['daily_rate'])
 if rate==0 or days<=account['billed_days']:return money(0)
 if account['currency']!=account['package_currency']:
  raise ValueError('storage_currency_mismatch')
 if not account['client_id']:raise ValueError('storage_client_required')
 amount=money(rate*(days-account['billed_days']))
 from app.finance import repository as finance
 document=finance.create_in_transaction(c,org_id,'automation','Automatisation',{
  'document_type':'INVOICE','client_id':str(account['client_id']),'dossier_id':None,
  'source_document_id':None,'office_id':str(account['storage_office_id']) if account.get('storage_office_id') else None,'currency':account['currency'],
  'due_date':now.astimezone(ZoneInfo(account['timezone'])).date(),'notes':None,
  'terms':f"Garde après {account['grace_days']} jours gratuits. Tarif : {rate} {account['currency']} par colis et par jour.",
  'lines':[{'description':f"Entreposage du colis {account['package_reference']} — jours {account['billed_days']+1} à {days}",
            'quantity':days-account['billed_days'],'unit_price':rate,'discount_rate':0,'tax_rate':account.get('tax_rate') or 0,
            'metadata':{'package_id':str(package_id),'kind':'STORAGE'}}]})
 # Keep the transport invoice unchanged. Storage is an auditable separate invoice.
 c.execute(text("""update finance_documents set status='ISSUED',issue_date=current_date,issued_at=now(),
  issued_by='automation',row_version=row_version+1,updated_at=now() where org_id=:o and id=:d"""),{'o':org_id,'d':document['id']})
 finance.event(c,org_id,document['id'],'ISSUED','automation','Automatisation')
 c.execute(text("""insert into package_storage_invoices(org_id,package_id,through_day,document_id)
  values(:o,:p,:days,:d)"""),{'o':org_id,'p':package_id,'days':days,'d':document['id']})
 c.execute(text('update package_storage_accounts set billed_days=:days where org_id=:o and package_id=:p'),{'o':org_id,'p':package_id,'days':days})
 return amount


def storage_totals(c,org_id,package_ids):
 return dict(c.execute(text("""select coalesce(sum(d.total),0) total,coalesce(sum(d.amount_paid),0) paid,
  coalesce(sum(d.balance_due),0) balance from package_storage_invoices s
  join finance_documents d on d.org_id=s.org_id and d.id=s.document_id
  where s.org_id=:o and s.package_id=any(cast(:ids as uuid[])) and d.status<>'VOID'"""),{'o':org_id,'ids':package_ids}).mappings().one())


def check_release(c,org_id,package_ids,require_payment=True):
 totals=storage_totals(c,org_id,package_ids)
 if require_payment and money(totals['balance'])>0:
  raise HTTPException(409,{'code':'storage_payment_required','message':'Des frais de garde restent à régler dans Finance avant la remise des colis.'})
 return totals


def prepare_storage(org_id,package_ids=None,pickup_id=None):
 """Commit due invoices before a rejected release can roll its own state back."""
 with engine.begin() as c:
  rows=c.execute(text("""select p.id,p.org_id from cargo_packages p where p.deleted_at is null
   and p.status='READY_FOR_PICKUP' and (
    ((p.org_id=:o or p.destination_org_id=:o) and p.id=any(cast(:ids as uuid[])))
    or (p.org_id=:o and p.id in(select i.package_id from pickup_order_items i
      join pickup_orders order_row on order_row.id=i.pickup_id and order_row.org_id=i.org_id
      where i.org_id=:o and i.pickup_id=:pickup and order_row.status in ('READY','NOTIFIED','CHECKED_IN','VERIFIED'))))
   order by p.id for update of p"""),{'o':org_id,'ids':package_ids or [],'pickup':pickup_id}).mappings().all()
  for row in rows:accrue_storage(c,row['org_id'],row['id'])


def _payment(c,event):
 row=c.execute(text("""select p.status,d.client_id from finance_payments p
  join finance_documents d on d.id=p.document_id and d.org_id=p.org_id
  where p.org_id=:o and p.id=:id"""),{'o':event['org_id'],'id':event['entity_id']}).mappings().first()
 if not row or row['status']!='CONFIRMED':return
 ctx=context(c,event['org_id'],row['client_id'])
 if not ctx or not ctx['policy']['payment_enabled']:return
 values=dict(event['payload'])
 balance=money(values['balance'])
 values['amount']=str(money(values['amount']))
 values['payment_summary']='La facture est entièrement réglée.' if balance==0 else f"Il reste {balance} {values['currency']} à régler."
 queue(c,event['org_id'],row['client_id'],'payment_confirmed',event['entity_id'],event['event_key'],values,ctx)


def _documents(c,event):
 o=event['org_id'];direct=event['kind']=='package_documents_ready'
 pickup=None if direct else event['entity_id'];package=event['entity_id'] if direct else None
 if direct:
  order=c.execute(text("select client_id from cargo_packages where org_id=:o and id=:p and status='DELIVERED' and deleted_at is null"),{'o':o,'p':package}).mappings().first()
 else:
  order=c.execute(text("select * from pickup_orders where org_id=:o and id=:p and status='RELEASED'"),{'o':o,'p':pickup}).mappings().first()
 if not order:return
 ctx=context(c,o,order['client_id'])
 if not ctx or not ctx['policy']['documents_enabled']:return
 if not ctx.get('phone'):raise ValueError('customer_contact_required')
 documents=c.execute(text("""select distinct d.* from finance_documents d
  where d.org_id=:o and d.client_id=:client and d.document_type='INVOICE'
   and d.status in ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE') and (
    d.package_id=:package or d.package_id in (select package_id from pickup_order_items where org_id=:o and pickup_id=:p)
    or d.id in (select s.document_id from package_storage_invoices s join pickup_order_items i
      on i.org_id=s.org_id and i.package_id=s.package_id where i.org_id=:o and i.pickup_id=:p)
    or d.id in (select document_id from package_storage_invoices where org_id=:o and package_id=:package))"""),{'o':o,'p':pickup,'package':package,'client':order['client_id']}).mappings().all()
 if not documents:
  raise ValueError('customer_invoice_required')
 from app.documents.agency_brand import identity,invoice_html
 financial=c.execute(text('select * from finance_settings where org_id=:o'),{'o':o}).mappings().first() or {}
 snapshots=[];document_ids=[]
 for raw in documents:
  doc=dict(raw);doc.update({'client_name':ctx['client'],'client_phone':ctx['phone']})
  doc['lines']=[dict(x) for x in c.execute(text('select * from finance_document_lines where org_id=:o and document_id=:d order by position'),{'o':o,'d':doc['id']}).mappings()]
  brand=identity(c,o,doc.get('office_id'))
  snapshots.append(invoice_html(doc,dict(financial),brand));document_ids.append(str(doc['id']))
 # A single link/message, even when there are many daily storage invoices.
 token=secrets.token_urlsafe(36)
 share=c.execute(text("""insert into customer_document_shares(org_id,pickup_id,package_id,document_id,document_ids,token_hash,html_snapshot)
  values(:o,:p,:package,:d,cast(:documents as uuid[]),:hash,:html) on conflict do nothing returning id"""),
  {'o':o,'p':pickup,'package':package,'d':document_ids[0],'documents':document_ids,
   'hash':hashlib.sha256(token.encode()).hexdigest(),'html':document_bundle(snapshots)}).first()
 if share:
  url=f"{settings.public_web_base_url.rstrip('/')}/customer-documents/{token}"
  queue(c,o,order['client_id'],'documents_ready',event['entity_id'],event['event_key'],{'document_url':url},ctx)


def document_bundle(documents):
 """Join already escaped invoice pages; no user-supplied HTML is accepted."""
 if len(documents)==1:return documents[0]
 style=documents[0].split('<style>',1)[1].split('</style>',1)[0]
 pages=[]
 for document in documents:
  body=document.split('<body>',1)[1].split('</body>',1)[0]
  body=body.replace('<button onclick="window.print()">Imprimer / Enregistrer en PDF</button>','')
  pages.append('<article class="invoice-page">'+body+'</article>')
 return ('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">'
  '<title>Documents de facturation</title><style>'+style+
  '.invoice-page{margin-bottom:48px}@media print{.invoice-page{break-after:page}.invoice-page:last-child{break-after:auto}}</style></head>'
  '<body><button onclick="window.print()">Imprimer / Enregistrer toutes les factures en PDF</button>'+''.join(pages)+'</body></html>')


def process_events(limit=100):
 result={'done':0,'failed':0}
 for _ in range(limit):
  with engine.begin() as c:
   raw=c.execute(text("""select * from customer_automation_events where status='PENDING'
    and available_at<=now() order by available_at,id limit 1 for update skip locked""")).mappings().first()
   if not raw:break
   event=dict(raw)
   try:
    with c.begin_nested():
     if event['kind']=='payment_confirmed':_payment(c,event)
     elif event['kind'] in ('documents_ready','package_documents_ready'):_documents(c,event)
     else:raise ValueError('unknown_customer_event')
    c.execute(text("update customer_automation_events set status='DONE',processed_at=now(),last_error=null where id=:id"),{'id':event['id']})
    result['done']+=1
   except Exception as exc:
    # Bounded retries; failed events stay visible to the agency, not silently lost.
    logger.warning('customer_automation_event_failed kind=%s id=%s error=%s',event['kind'],event['id'],type(exc).__name__)
    c.execute(text("""update customer_automation_events set attempts=attempts+1,
     status=case when attempts>=4 then 'FAILED' else 'PENDING' end,
     last_error=:error,available_at=now()+interval '15 minutes' where id=:id"""),{'id':event['id'],'error':str(exc)[:160] if isinstance(exc,ValueError) else 'processing_failed'})
    result['failed']+=1
 return result


def process_expectations(limit=100):
 queued=0
 with engine.begin() as c:
  rows=c.execute(text("""select * from parcel_expectations where status='WAITING' and next_reminder_at<=now()
   order by next_reminder_at,id limit :limit for update skip locked"""),{'limit':limit}).mappings().all()
  for item in rows:
   ctx=context(c,item['org_id'],item['client_id'])
   policy=ctx['policy'] if ctx else CustomerAutomation().model_dump()
   increment=0
   if ctx and policy['awaiting_enabled'] and item['reminder_count']<policy['max_reminders']:
    increment=int(bool(queue(c,item['org_id'],item['client_id'],'awaiting_parcel',item['id'],f"awaiting:{item['id']}:{item['reminder_count']}",{},ctx)));queued+=increment
   c.execute(text("""update parcel_expectations set reminder_count=reminder_count+:increment,
    next_reminder_at=now()+make_interval(days=>:days) where id=:id"""),{'id':item['id'],'days':policy['reminder_interval_days'],'increment':increment})
 return queued


def process_packages(limit=100):
 """Bounded scan rotates by last automation check; never starves later parcels."""
 queued=0;errors=0
 with engine.begin() as c:
  rows=c.execute(text("""select * from cargo_packages where deleted_at is null and client_id is not null
   and status in ('RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','READY_FOR_BATCH','READY_FOR_DISPATCH','BLOCKED','READY_FOR_PICKUP')
   and (automation_checked_at is null or automation_checked_at<now()-interval '1 hour')
   order by automation_checked_at nulls first,id limit :limit for update skip locked"""),{'limit':limit}).mappings().all()
  for raw in rows:
   p=dict(raw)
   error=None
   try:
    with c.begin_nested():queued+=_package(c,p)
   except Exception:
    logger.exception('customer_package_automation_failed org=%s package=%s',p['org_id'],p['id']);errors+=1;error='automation_requires_review'
   c.execute(text('update cargo_packages set automation_checked_at=now(),automation_last_error=:error where id=:id'),{'id':p['id'],'error':error})
 return {'queued':queued,'errors':errors}


def _package(c,p):
 ctx=context(c,p['org_id'],p['client_id'])
 if not ctx:return 0
 policy=ctx['policy'];now=datetime.now(timezone.utc)
 day=now.astimezone(ZoneInfo(ctx['timezone'])).date()
 last=p.get('automation_reminded_at')
 reminder_due=not last or (now-last).total_seconds()>=ctx['policy']['reminder_interval_days']*86400
 if p['status']=='READY_FOR_PICKUP':
  accrue_storage(c,p['org_id'],p['id'],now)
  account=c.execute(text('select * from package_storage_accounts where org_id=:o and package_id=:p'),{'o':p['org_id'],'p':p['id']}).mappings().first()
  if not account or not policy['pickup_enabled']:return 0
  age=(day-account['ready_at'].astimezone(ZoneInfo(ctx['timezone'])).date()).days
  if age<policy['pickup_delay_days'] or not reminder_due:return 0
  totals=storage_totals(c,p['org_id'],[str(p['id'])]);kind='storage_due' if money(totals['balance'])>0 else 'pickup_reminder'
  queued=int(bool(queue(c,p['org_id'],p['client_id'],kind,p['id'],f'{kind}:{p["id"]}:{day}',{'tracking':p.get('tracking_id') or p['package_reference'],'storage_fee':str(money(totals['total'])),'storage_balance':str(money(totals['balance'])),'currency':p['currency']},ctx)))
  if queued:c.execute(text('update cargo_packages set automation_reminded_at=now() where org_id=:o and id=:p'),{'o':p['org_id'],'p':p['id']})
  return queued
 if not policy['blocked_enabled']:return 0
 from app.finance.clearance import departure_clearance
 decision=departure_clearance(c,p['org_id'],p)
 # Internal configuration errors are for the agency, not a demand to the customer.
 reason=decision.get('message') if decision.get('code')=='PAYMENT_CLEARANCE_REQUIRED' else None
 if not reason:return 0
 age=(day-p['created_at'].astimezone(ZoneInfo(ctx['timezone'])).date()).days
 if age<policy['reminder_interval_days'] or not reminder_due:return 0
 queued=int(bool(queue(c,p['org_id'],p['client_id'],'departure_blocked',p['id'],f'blocked:{p["id"]}:{day}',{'tracking':p.get('tracking_id') or p['package_reference'],'reason':reason},ctx)))
 if queued:c.execute(text('update cargo_packages set automation_reminded_at=now() where org_id=:o and id=:p'),{'o':p['org_id'],'p':p['id']})
 return queued


def can_dispatch(notification):
 parts=str(notification['notification_type']).split(':')
 if len(parts)!=4:return False
 _,kind,entity,_=parts
 with engine.connect() as c:
  ctx=context(c,notification['org_id'],notification.get('client_id'))
  if not ctx or not permitted(c,notification['org_id'],notification['recipient_phone'],marketing=kind=='next_departure'):return False
  normalized=lambda phone:''.join(char for char in str(phone or '') if char.isdigit())
  if normalized(ctx['phone'])!=normalized(notification['recipient_phone']):return False
  policy=ctx['policy']
  flag={'awaiting_parcel':'awaiting_enabled','payment_confirmed':'payment_enabled','documents_ready':'documents_enabled',
        'departure_blocked':'blocked_enabled','pickup_reminder':'pickup_enabled','storage_due':'pickup_enabled','next_departure':'announcements_enabled'}.get(kind)
  if flag and not policy[flag]:return False
  if kind=='awaiting_parcel':
   return bool(c.execute(text("select 1 from parcel_expectations where org_id=:o and id=:id and status='WAITING'"),{'o':notification['org_id'],'id':entity}).first())
  if kind in ('pickup_reminder','storage_due','departure_blocked'):
   p=c.execute(text('select * from cargo_packages where org_id=:o and id=:id and deleted_at is null'),{'o':notification['org_id'],'id':entity}).mappings().first()
   if not p:return False
   if kind in ('pickup_reminder','storage_due'):
    if p['status']!='READY_FOR_PICKUP':return False
    if kind=='pickup_reminder':return True
    totals=storage_totals(c,notification['org_id'],[entity])
    if money(totals['balance'])<=0:return False
    current=message(policy,kind,{**ctx,'conditions':policy['pickup_conditions'],
     'tracking':p.get('tracking_id') or p['package_reference'],'storage_fee':str(money(totals['total'])),
     'storage_balance':str(money(totals['balance'])),'currency':p['currency']})
    return notification.get('message')==current
   if p['status'] not in ('RECEIVED','RECEIVED_AT_ORIGIN','WAREHOUSED','READY_FOR_BATCH','READY_FOR_DISPATCH','BLOCKED'):return False
   from app.finance.clearance import departure_clearance
   decision=departure_clearance(c,notification['org_id'],p)
   if decision.get('code')!='PAYMENT_CLEARANCE_REQUIRED':return False
   current=message(policy,kind,{**ctx,'conditions':policy['pickup_conditions'],
    'tracking':p.get('tracking_id') or p['package_reference'],'reason':decision.get('message')})
   return notification.get('message')==current
  if kind=='payment_confirmed':
   return bool(c.execute(text("select 1 from finance_payments where org_id=:o and id=:id and status='CONFIRMED'"),{'o':notification['org_id'],'id':entity}).first())
  if kind=='documents_ready':
   return bool(c.execute(text("""select 1 from customer_document_shares s
    join finance_documents d on d.id=s.document_id and d.org_id=s.org_id and d.status<>'VOID'
    where s.org_id=:o and (s.pickup_id=:id or s.package_id=:id) and s.revoked_at is null and s.expires_at>now()
     and not exists(select 1 from finance_documents included where included.org_id=s.org_id
       and included.id=any(s.document_ids) and included.status='VOID')
     and (exists(select 1 from pickup_orders where org_id=:o and id=:id and status='RELEASED')
       or exists(select 1 from cargo_packages where org_id=:o and id=:id and status='DELIVERED' and deleted_at is null))"""),{'o':notification['org_id'],'id':entity}).first())
  return False


def can_announce(notification):
 parts=str(notification.get('notification_type') or '').split(':')
 if len(parts)!=3:return False
 with engine.connect() as c:
  row=c.execute(text("""select d.published,d.status,coalesce(s.settings->'customer_automation'->>'announcements_enabled','true') enabled
   from cargo_departures d left join organization_settings s on s.org_id=d.org_id
   join organizations o on o.id=d.org_id and o.status='ACTIVE'
   where d.org_id=:o and d.id=:id"""),{'o':notification['org_id'],'id':parts[1]}).mappings().first()
  return bool(row and row['published'] and row['status'] in ('PLANNED','OPEN','CONFIRMED','PENDING_CONFIRMATION')
    and row['enabled']=='true' and permitted(c,notification['org_id'],notification['recipient_phone'],marketing=True))


def can_send_pickup_code(notification):
 parts=str(notification.get('notification_type') or '').split(':')
 if len(parts)!=3:return False
 with engine.connect() as c:
  if not permitted(c,notification['org_id'],notification.get('recipient_phone')):return False
  return bool(c.execute(text("""select 1 from pickup_orders p join pickup_otps code on code.pickup_id=p.id and code.org_id=p.org_id
   join organizations o on o.id=p.org_id and o.status='ACTIVE'
   where p.org_id=:o and p.id=:p and code.id=:code and p.status in ('READY','NOTIFIED','CHECKED_IN')
    and code.status='PENDING' and code.expires_at>now()"""),{'o':notification['org_id'],'p':parts[1],'code':parts[2]}).first())
