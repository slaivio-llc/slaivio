from __future__ import annotations
import csv,io,json,html
from datetime import date,datetime,timezone
from decimal import Decimal,ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy import text
from app.db.database import engine
from app.finance.receipts import capture_identity, render_receipt

D=Decimal
def money(v):return D(str(v or 0)).quantize(D("0.01"),rounding=ROUND_HALF_UP)
def rows(r):return [dict(x) for x in r.mappings().all()]
def event(c,o,d,t,a,n,p=None,payment=None):c.execute(text("insert into finance_events(org_id,document_id,payment_id,event_type,actor_id,actor_name,payload) values(:o,:d,:pay,:t,:a,:n,cast(:p as jsonb))"),{"o":o,"d":d,"pay":payment,"t":t,"a":a,"n":n,"p":json.dumps(p or {},default=str)})
def number(c,o,t):
 y=date.today().year
 v=c.execute(text("insert into finance_document_sequences(org_id,document_type,year,last_value) values(:o,:t,:y,1) on conflict(org_id,document_type,year) do update set last_value=finance_document_sequences.last_value+1 returning last_value"),{"o":o,"t":t,"y":y}).scalar_one()
 return f"{'DEV' if t=='QUOTE' else 'FAC' if t=='INVOICE' else 'AVO'}-{y}-{int(v):06d}"
def receipt_number(c,o):
 y=date.today().year;v=c.execute(text("insert into finance_document_sequences(org_id,document_type,year,last_value) values(:o,'RECEIPT',:y,1) on conflict(org_id,document_type,year) do update set last_value=finance_document_sequences.last_value+1 returning last_value"),{"o":o,"y":y}).scalar_one();return f"REC-{y}-{int(v):06d}"
def calculate(lines):
 out=[];subtotal=discount=tax=total=D('0')
 for i,x in enumerate(lines,1):
  raw=money(D(str(x['quantity']))*D(str(x['unit_price'])));disc=money(raw*D(str(x.get('discount_rate',0)))/100);base=raw-disc;vat=money(base*D(str(x.get('tax_rate',0)))/100);line_total=base+vat
  out.append({**x,"position":i,"line_subtotal":raw,"line_discount":disc,"line_tax":vat,"line_total":line_total});subtotal+=raw;discount+=disc;tax+=vat;total+=line_total
 return out,money(subtotal),money(discount),money(tax),money(total)
def list_documents(o,q=None,status=None,kind=None,page=1,page_size=50,office_ids=None):
 f=["d.org_id=:o"];p={"o":o,"q":f"%{q or ''}%","limit":page_size,"offset":(page-1)*page_size}
 if office_ids is not None:
  f.append("d.office_id=any(cast(:office_ids as uuid[]))");p['office_ids']=office_ids
 if q:f.append("(d.document_number ilike :q or coalesce(c.name,c.phone,c.email,'') ilike :q)")
 if status:f.append("d.status=:s");p['s']=status
 if kind:f.append("d.document_type=:t");p['t']=kind
 w=' and '.join(f)
 with engine.connect() as c:
  total=c.execute(text(f"select count(*) from finance_documents d left join clients c on c.id=d.client_id and c.org_id=d.org_id where {w}"),p).scalar_one()
  items=rows(c.execute(text(f"select d.*,coalesce(c.name,c.phone,c.email,'Client') client_name,ds.dossier_reference from finance_documents d left join clients c on c.id=d.client_id and c.org_id=d.org_id left join dossiers ds on ds.id=d.dossier_id and ds.org_id=d.org_id where {w} order by d.created_at desc limit :limit offset :offset"),p))
  return {"items":items,"pagination":{"page":page,"page_size":page_size,"total":total,"total_pages":max(1,(total+page_size-1)//page_size)}}
def stats(o,office_ids=None):
 with engine.connect() as c:
  counts=dict(c.execute(text("select count(*) filter(where document_type='INVOICE')::int invoices,count(*) filter(where status='DRAFT')::int drafts,count(*) filter(where document_type='INVOICE' and (status='OVERDUE' or (status in ('ISSUED','PARTIALLY_PAID') and due_date<current_date)))::int overdue from finance_documents where org_id=:o and (:unrestricted or office_id=any(cast(:offices as uuid[])))"),{"o":o,"unrestricted":office_ids is None,"offices":office_ids or []}).mappings().one())
  counts["by_currency"]=rows(c.execute(text("select currency,coalesce(sum(total),0) invoiced,coalesce(sum(amount_paid),0) collected,coalesce(sum(balance_due),0) outstanding from finance_documents where org_id=:o and (:unrestricted or office_id=any(cast(:offices as uuid[]))) and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID','OVERDUE','PAID') group by currency order by currency"),{"o":o,"unrestricted":office_ids is None,"offices":office_ids or []}))
  return counts

def list_payments(o, q=None, currency=None, status=None, start_date=None, end_date=None, page=1, page_size=50, office_ids=None):
 f=["p.org_id=:o"];p={"o":o,"q":f"%{q or ''}%","limit":page_size,"offset":(page-1)*page_size}
 if office_ids is not None:f.append("d.office_id=any(cast(:office_ids as uuid[]))");p['office_ids']=office_ids
 if q:f.append("(p.receipt_number ilike :q or d.document_number ilike :q or coalesce(c.name,c.phone,c.email,'') ilike :q or coalesce(p.reference,'') ilike :q)")
 if currency:f.append("p.currency=:currency");p['currency']=currency.upper()
 if status:f.append("p.status=:status");p['status']=status
 if start_date:f.append("p.paid_at >= cast(:start_date as date)");p['start_date']=start_date
 if end_date:f.append("p.paid_at < cast(:end_date as date) + interval '1 day'");p['end_date']=end_date
 where=' and '.join(f)
 joins=" from finance_payments p join finance_documents d on d.org_id=p.org_id and d.id=p.document_id left join clients c on c.org_id=d.org_id and c.id=d.client_id "
 with engine.connect() as c:
  total=c.execute(text(f"select count(*){joins} where {where}"),p).scalar_one()
  items=rows(c.execute(text(f"select p.id,p.receipt_number,p.document_id,d.document_number,d.client_id,coalesce(c.name,c.phone,c.email,'Client') client_name,p.amount,p.currency,p.method,p.reference,p.paid_at,p.status,p.recorded_by_name,d.office_id{joins} where {where} order by p.paid_at desc,p.id desc limit :limit offset :offset"),p))
  return {"items":items,"pagination":{"page":page,"page_size":page_size,"total":total,"total_pages":max(1,(total+page_size-1)//page_size)}}

def client_balances(o, q=None, currency=None, page=1, page_size=50, office_ids=None):
 f=["d.org_id=:o","d.document_type='INVOICE'","d.status in ('ISSUED','PARTIALLY_PAID','OVERDUE','PAID')"];p={"o":o,"q":f"%{q or ''}%","limit":page_size,"offset":(page-1)*page_size}
 if office_ids is not None:f.append("d.office_id=any(cast(:office_ids as uuid[]))");p['office_ids']=office_ids
 if q:f.append("coalesce(c.name,c.phone,c.email,'') ilike :q")
 if currency:f.append("d.currency=:currency");p['currency']=currency.upper()
 where=' and '.join(f)
 with engine.connect() as c:
  total=c.execute(text(f"select count(*) from (select d.client_id,d.currency{ ' from finance_documents d left join clients c on c.org_id=d.org_id and c.id=d.client_id where '+where} group by d.client_id,d.currency) balances"),p).scalar_one()
  items=rows(c.execute(text(f"select d.client_id,coalesce(c.name,c.phone,c.email,'Client') client_name,d.currency,count(*)::int invoice_count,coalesce(sum(d.total),0) invoiced,coalesce(sum(d.amount_paid),0) paid,coalesce(sum(d.balance_due),0) balance,coalesce(sum(d.balance_due) filter(where d.due_date is null or d.due_date<=current_date),0) due_now,min(d.due_date) filter(where d.balance_due>0 and d.due_date>current_date) next_due from finance_documents d left join clients c on c.org_id=d.org_id and c.id=d.client_id where {where} group by d.client_id,c.name,c.phone,c.email,d.currency order by balance desc,client_name limit :limit offset :offset"),p))
  return {"items":items,"pagination":{"page":page,"page_size":page_size,"total":total,"total_pages":max(1,(total+page_size-1)//page_size)}}
def create(o,a,n,payload):
 with engine.begin() as c:
  return create_in_transaction(c,o,a,n,payload)

def create_in_transaction(c,o,a,n,payload):
 payload=dict(payload)
 lines,sub,disc,tax,total=calculate(payload.pop('lines'))
 if not c.execute(text("select 1 from clients where id=cast(:id as uuid) and org_id=:o and deleted_at is null"),{"id":payload['client_id'],"o":o}).first():raise HTTPException(422,'finance_client_not_found')
 if payload.get('dossier_id') and not c.execute(text("select 1 from dossiers where id=cast(:id as uuid) and org_id=:o and deleted_at is null"),{"id":payload['dossier_id'],"o":o}).first():raise HTTPException(422,'finance_dossier_not_found')
 if payload.get('source_document_id') and not c.execute(text("select 1 from finance_documents where id=cast(:id as uuid) and org_id=:o"),{"id":payload['source_document_id'],"o":o}).first():raise HTTPException(422,'finance_source_document_not_found')
 office_id = payload.get('office_id')
 if office_id is not None:
  office_id = str(office_id)
  office = c.execute(text("select 1 from organization_locations where org_id=:o and id=:office and location_type='OFFICE' and status='ACTIVE'"),{'o':o,'office':office_id}).first()
  if not office: raise HTTPException(422,'finance_office_not_found')
  payload['office_id'] = office_id
 doc_id=c.execute(text("select gen_random_uuid()::text")).scalar_one();num=number(c,o,payload['document_type'])
 doc=dict(c.execute(text("insert into finance_documents(id,org_id,document_type,document_number,client_id,dossier_id,source_document_id,office_id,currency,subtotal,discount_total,tax_total,total,balance_due,due_date,notes,terms,created_by,created_by_name) values(cast(:id as uuid),:o,:document_type,:num,cast(:client_id as uuid),cast(:dossier_id as uuid),cast(:source_document_id as uuid),cast(:office_id as uuid),:currency,:sub,:disc,:tax,:total,:total,:due_date,:notes,:terms,:a,:n) returning *"),{"id":doc_id,"o":o,"num":num,"a":a,"n":n,"sub":sub,"disc":disc,"tax":tax,"total":total,**payload}).mappings().one())
 for x in lines:c.execute(text("insert into finance_document_lines(org_id,document_id,position,description,quantity,unit_price,discount_rate,tax_rate,line_subtotal,line_discount,line_tax,line_total,metadata) values(:o,cast(:d as uuid),:position,:description,:quantity,:unit_price,:discount_rate,:tax_rate,:line_subtotal,:line_discount,:line_tax,:line_total,cast(:metadata as jsonb))"),{"o":o,"d":doc_id,**x,"metadata":json.dumps(x.get('metadata') or {})})
 event(c,o,doc_id,'CREATED',a,n,{"number":num,"total":str(total)});return doc
def detail(o,d):
 with engine.connect() as c:
  doc=c.execute(text("select d.*,coalesce(c.name,c.phone,c.email,'Client') client_name,c.phone client_phone,c.email client_email,ds.dossier_reference from finance_documents d left join clients c on c.id=d.client_id and c.org_id=d.org_id left join dossiers ds on ds.id=d.dossier_id and ds.org_id=d.org_id where d.org_id=:o and d.id=:d"),{"o":o,"d":d}).mappings().first()
  if not doc:raise HTTPException(404,'finance_document_not_found')
  x=dict(doc);x['lines']=rows(c.execute(text("select * from finance_document_lines where org_id=:o and document_id=:d order by position"),{"o":o,"d":d}));x['payments']=rows(c.execute(text("select * from finance_payments where org_id=:o and document_id=:d order by paid_at desc"),{"o":o,"d":d}));x['events']=rows(c.execute(text("select * from finance_events where org_id=:o and document_id=:d order by created_at desc"),{"o":o,"d":d}));return x
def issue(o,d,a,n,version):
 with engine.begin() as c:
  row=c.execute(text("update finance_documents set status='ISSUED',issue_date=current_date,issued_at=now(),issued_by=:a,row_version=row_version+1,updated_at=now() where org_id=:o and id=:d and status='DRAFT' and row_version=:v returning *"),{"o":o,"d":d,"a":a,"v":version}).mappings().first()
  if not row:raise HTTPException(409,'finance_document_state_conflict')
  event(c,o,d,'ISSUED',a,n);return dict(row)
def payment_amount(value):
 try:
  amount = D(str(value))
  if not amount.is_finite() or amount <= 0 or amount != amount.quantize(D('0.01')):
   raise ValueError()
  return amount.quantize(D('0.01'))
 except (ValueError, ArithmeticError):
  raise HTTPException(422, 'invalid_payment_amount')

def pay(o,d,a,n,p):
 amount=payment_amount(p['amount'])
 currency=str(p['currency']).strip().upper()
 with engine.begin() as c:
  # Serialize the logical payment, even when a retry targets another document.
  c.execute(text("select pg_advisory_xact_lock(hashtextextended(:scope,0))"),
            {"scope":f"finance-payment:{o}:{p['idempotency_key']}"})
  old=c.execute(text("select * from finance_payments where org_id=:o and idempotency_key=:k"),{"o":o,"k":p['idempotency_key']}).mappings().first()
  if old:
   if (str(old['document_id']) != str(d) or money(old['amount']) != amount
       or old['currency'] != currency or old['method'] != p['method']
       or (old.get('reference') or '') != (p.get('reference') or '')):
    raise HTTPException(409,'payment_idempotency_conflict')
   return dict(old)
  doc=c.execute(text("select * from finance_documents where org_id=:o and id=:d and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID','OVERDUE') for update"),{"o":o,"d":d}).mappings().first()
  if not doc:raise HTTPException(409,'invoice_not_payable')
  if currency!=doc['currency']:raise HTTPException(422,'payment_currency_mismatch')
  balance=money(doc['balance_due'])
  if amount>balance:raise HTTPException(422,'payment_exceeds_balance')
  reserved=money(c.execute(text("""select coalesce(sum(requested_amount),0)
    from finance_saspay_attempts
    where org_id=:o and document_id=:d
      and status in ('CREATING','PENDING','AMBIGUOUS')"""),
    {"o":o,"d":d}).scalar_one())
  if p.get('provider')!='SASPAY' and reserved and amount>max(balance-reserved,D('0')):
   raise HTTPException(409,'payment_conflicts_with_saspay_attempt')
  pid=c.execute(text("select gen_random_uuid()::text")).scalar_one();receipt=receipt_number(c,o)
  payment=dict(c.execute(text("""insert into finance_payments(
      id,org_id,document_id,receipt_number,amount,currency,method,reference,paid_at,
      idempotency_key,recorded_by,recorded_by_name,provider,provider_transaction_id,
      provider_amount,provider_fee,provider_charged,provider_net_amount,fee_charge_mode
    ) values(
      cast(:id as uuid),:o,:d,:receipt,:amount,:currency,:method,:reference,:paid_at,
      :idempotency_key,:a,:n,:provider,:provider_transaction_id,:provider_amount,
      :provider_fee,:provider_charged,:provider_net_amount,:fee_charge_mode
    ) returning *"""),{
       **p,"id":pid,"o":o,"d":d,"receipt":receipt,"a":a,"n":n,
       "amount":amount,"currency":currency,
       "provider":p.get('provider'),
       "provider_transaction_id":p.get('provider_transaction_id'),
       "provider_amount":p.get('provider_amount'),
       "provider_fee":p.get('provider_fee'),
       "provider_charged":p.get('provider_charged'),
       "provider_net_amount":p.get('provider_net_amount'),
       "fee_charge_mode":p.get('fee_charge_mode'),
   }).mappings().one())
  snapshot=capture_identity(c,o,d)
  c.execute(text("update finance_payments set receipt_snapshot=cast(:snapshot as jsonb) where org_id=:o and id=:id"),{"o":o,"id":pid,"snapshot":json.dumps(snapshot)})
  payment['receipt_snapshot']=snapshot
  paid=money(doc['amount_paid'])+amount
  # Preserve previously applied credits: do not recompute from invoice total.
  balance=money(doc['balance_due'])-amount
  status='PAID' if balance==0 else 'PARTIALLY_PAID'
  c.execute(text("update finance_documents set amount_paid=:paid,balance_due=:balance,status=:status,row_version=row_version+1,updated_at=now() where id=:d and org_id=:o"),{"paid":paid,"balance":balance,"status":status,"d":d,"o":o})
  event(c,o,d,'PAYMENT_RECORDED',a,n,{"amount":str(amount),"currency":currency,"receipt":receipt,"source":p.get('provider') or 'AGENCY'},pid)
  return payment
def receipt(o,d,payment_id):
 with engine.connect() as c:
  payment=c.execute(text("select * from finance_payments where org_id=:o and document_id=:d and id=:p"),{"o":o,"d":d,"p":payment_id}).mappings().first()
  if not payment:raise HTTPException(404,'finance_payment_not_found')
  return render_receipt(dict(payment))

def void(o,d,a,n,version,reason):
 with engine.begin() as c:
  doc=c.execute(text("select id from finance_documents where org_id=:o and id=:d for update"),{"o":o,"d":d}).first()
  if not doc:raise HTTPException(409,'finance_document_not_voidable')
  active=c.execute(text("""select 1 from finance_saspay_attempts
    where org_id=:o and document_id=:d and status in ('CREATING','PENDING','AMBIGUOUS')
    limit 1"""),{"o":o,"d":d}).first()
  if active:raise HTTPException(409,'saspay_attempt_open')
  row=c.execute(text("update finance_documents set status='VOID',voided_by=:a,voided_at=now(),row_version=row_version+1,updated_at=now(),notes=concat_ws(E'\n',notes,:reason) where org_id=:o and id=:d and status in ('DRAFT','ISSUED') and amount_paid=0 and row_version=:v returning *"),{"o":o,"d":d,"a":a,"v":version,"reason":'ANNULATION: '+reason}).mappings().first()
  if not row:raise HTTPException(409,'finance_document_not_voidable')
  event(c,o,d,'VOIDED',a,n,{"reason":reason});return dict(row)
def export(o,office_ids=None):
 data=list_documents(o,page_size=10000,office_ids=office_ids)['items'];s=io.StringIO();w=csv.writer(s);w.writerow(['numero','type','client','statut','devise','total','paye','solde','echeance']);[w.writerow([x['document_number'],x['document_type'],x['client_name'],x['status'],x['currency'],x['total'],x['amount_paid'],x['balance_due'],x['due_date']]) for x in data];return s.getvalue()

def settings_for(o):
 with engine.begin() as c:
  c.execute(text("insert into finance_settings(org_id) values(:o) on conflict do nothing"),{"o":o});return dict(c.execute(text("select * from finance_settings where org_id=:o"),{"o":o}).mappings().one())
def save_settings(o,a,p):
 with engine.begin() as c:return dict(c.execute(text("""insert into finance_settings(org_id,legal_name,tax_identifier,billing_address,default_currency,default_tax_rate,default_payment_terms_days,document_footer,updated_by) values(:o,:legal_name,:tax_identifier,:billing_address,:default_currency,:default_tax_rate,:default_payment_terms_days,:document_footer,:a) on conflict(org_id) do update set legal_name=excluded.legal_name,tax_identifier=excluded.tax_identifier,billing_address=excluded.billing_address,default_currency=excluded.default_currency,default_tax_rate=excluded.default_tax_rate,default_payment_terms_days=excluded.default_payment_terms_days,document_footer=excluded.document_footer,updated_by=excluded.updated_by,updated_at=now() returning *"""),{"o":o,"a":a,**p}).mappings().one())

def calculate_due_amount(total, policy):
 total = money(total)
 rule_type = str(policy.get('rule_type') or 'PERCENTAGE').upper()
 if rule_type == 'PERCENTAGE':
  percent = D(str(policy.get('percentage') if policy.get('percentage') is not None else 0))
  if not percent.is_finite() or percent < 0 or percent > 100:
   raise HTTPException(422, 'invalid_due_policy_percentage')
  return money(total * percent / D('100'))
 if rule_type == 'FIXED_AMOUNT':
  fixed = money(policy.get('fixed_amount') if policy.get('fixed_amount') is not None else 0)
  return fixed
 raise HTTPException(422, 'invalid_due_policy_rule')

def list_due_policies(o):
 with engine.connect() as c:
  return [dict(x) for x in c.execute(text("select * from finance_due_policies where org_id=:o order by is_active desc,row_version desc,created_at desc"),{'o':o}).mappings().all()]

def upsert_due_policy(o,a,n,payload):
 payload = dict(payload)
 name = str(payload.get('name') or '').strip()
 if not name:
  raise HTTPException(422, 'due_policy_name_required')
 trigger = str(payload.get('trigger_event') or 'MANUAL').upper()
 if trigger not in {'DEPARTURE','RECEPTION','ARRIVAL','DELIVERY','MANUAL'}:
  raise HTTPException(422, 'invalid_due_policy_trigger')
 currency = str(payload.get('currency') or 'USD').upper()
 if len(currency) != 3 or not currency.isalpha():
  raise HTTPException(422, 'invalid_due_policy_currency')
 rule_type = str(payload.get('rule_type') or 'PERCENTAGE').upper()
 if rule_type == 'PERCENTAGE':
  percentage = D(str(payload.get('percentage') if payload.get('percentage') is not None else 0))
  if not percentage.is_finite() or percentage < 0 or percentage > 100:
   raise HTTPException(422, 'invalid_due_policy_percentage')
  fixed_amount = None
 else:
  fixed_amount = money(payload.get('fixed_amount') if payload.get('fixed_amount') is not None else 0)
  if fixed_amount < 0:
   raise HTTPException(422, 'invalid_due_policy_amount')
  percentage = None
 with engine.begin() as c:
  row = c.execute(text("""insert into finance_due_policies(org_id,name,shipping_service_id,trigger_event,rule_type,percentage,fixed_amount,currency,is_active,created_by,created_by_name)
      values(:o,:name,cast(:shipping_service_id as uuid),:trigger_event,:rule_type,:percentage,:fixed_amount,:currency,:is_active,:a,:n)
      on conflict(org_id,name) do update set
        trigger_event=excluded.trigger_event,
        rule_type=excluded.rule_type,
        percentage=excluded.percentage,
        fixed_amount=excluded.fixed_amount,
        currency=excluded.currency,
        is_active=excluded.is_active,
        row_version=finance_due_policies.row_version + 1,
        updated_at=now(),
        created_by=excluded.created_by,
        created_by_name=excluded.created_by_name
      returning *"""),{
       'o':o,'name':name,'shipping_service_id':payload.get('shipping_service_id'),'trigger_event':trigger,'rule_type':rule_type,'percentage':percentage,
       'fixed_amount':fixed_amount,'currency':currency,'is_active':payload.get('is_active',True),
       'a':a,'n':n}).mappings().one()
  event(c,o,None,'DUE_POLICY_SAVED',a,n,{"policy_id":str(row['id']),"name":name,"trigger_event":trigger,"row_version":row['row_version']})
  return dict(row)

def get_due_obligations(o,d):
 with engine.connect() as c:
  rows = c.execute(text("select * from finance_due_obligations where org_id=:o and document_id=:d order by created_at asc"),{'o':o,'d':d}).mappings().all()
  return [dict(x) for x in rows]

def evaluate_due_obligations(o,d,trigger_event=None,a='system',n='System'):
 with engine.begin() as c:
  doc = c.execute(text("select * from finance_documents where org_id=:o and id=:d"),{'o':o,'d':d}).mappings().first()
  if not doc:
   raise HTTPException(404,'finance_document_not_found')
  policies = c.execute(text("select * from finance_due_policies where org_id=:o and is_active=true and (:event is null or trigger_event=:event) order by row_version desc,created_at desc"),{'o':o,'event':trigger_event}).mappings().all()
  obligations=[]
  for policy in policies:
   amount = calculate_due_amount(doc['total'], policy)
   row = c.execute(text("""insert into finance_due_obligations(org_id,document_id,policy_id,policy_row_version,trigger_event,amount,currency,status)
       values(:o,:d,:policy,:row_version,:trigger_event,:amount,:currency,'OPEN')
       on conflict(org_id,document_id,policy_id,trigger_event) do update set
         amount=excluded.amount,
         currency=excluded.currency,
         policy_row_version=excluded.policy_row_version,
         updated_at=now()
       returning *"""),{
       'o':o,'d':d,'policy':policy['id'],'row_version':policy['row_version'],'trigger_event':policy['trigger_event'],'amount':amount,'currency':doc['currency']}).mappings().first()
   if not row:
    row = c.execute(text("select * from finance_due_obligations where org_id=:o and document_id=:d and policy_id=:policy and trigger_event=:trigger_event"),{'o':o,'d':d,'policy':policy['id'],'trigger_event':policy['trigger_event']}).mappings().first()
   obligations.append(dict(row))
   event(c,o,d,'DUE_OBLIGATION_POSTED',a,n,{"policy_id":str(policy['id']),"trigger_event":policy['trigger_event'],"amount":str(amount),"row_version":policy['row_version']})
  return obligations

def quote_decision(o,d,a,n,version,accepted,reason=None):
 status='ACCEPTED' if accepted else 'REJECTED'
 with engine.begin() as c:
  row=c.execute(text(f"update finance_documents set status=:s,{'accepted_at' if accepted else 'rejected_at'}=now(),rejection_reason=:r,row_version=row_version+1,updated_at=now() where org_id=:o and id=:d and document_type='QUOTE' and status='ISSUED' and row_version=:v returning *"),{"s":status,"r":reason,"o":o,"d":d,"v":version}).mappings().first()
  if not row:raise HTTPException(409,'quote_state_conflict')
  event(c,o,d,status,a,n,{"reason":reason});return dict(row)
def convert_quote(o,d,a,n,version,due_date=None):
 with engine.begin() as c:
  quote=c.execute(text("select * from finance_documents where org_id=:o and id=:d and document_type='QUOTE' and status='ACCEPTED' and converted_document_id is null and row_version=:v for update"),{"o":o,"d":d,"v":version}).mappings().first()
  if not quote:raise HTTPException(409,'quote_not_convertible')
  new_id=c.execute(text("select gen_random_uuid()::text")).scalar_one();num=number(c,o,'INVOICE')
  invoice=dict(c.execute(text("""insert into finance_documents(id,org_id,document_type,document_number,client_id,dossier_id,source_document_id,status,currency,subtotal,discount_total,tax_total,total,balance_due,due_date,notes,terms,created_by,created_by_name) values(cast(:id as uuid),:o,'INVOICE',:num,:client,:dossier,:source,'DRAFT',:currency,:subtotal,:discount,:tax,:total,:total,:due,:notes,:terms,:a,:n) returning *"""),{"id":new_id,"o":o,"num":num,"client":quote['client_id'],"dossier":quote['dossier_id'],"source":d,"currency":quote['currency'],"subtotal":quote['subtotal'],"discount":quote['discount_total'],"tax":quote['tax_total'],"total":quote['total'],"due":due_date,"notes":quote['notes'],"terms":quote['terms'],"a":a,"n":n}).mappings().one())
  c.execute(text("insert into finance_document_lines(id,org_id,document_id,position,description,quantity,unit_price,discount_rate,tax_rate,line_subtotal,line_discount,line_tax,line_total,metadata) select gen_random_uuid(),org_id,cast(:new as uuid),position,description,quantity,unit_price,discount_rate,tax_rate,line_subtotal,line_discount,line_tax,line_total,metadata from finance_document_lines where org_id=:o and document_id=:old"),{"new":new_id,"o":o,"old":d})
  c.execute(text("update finance_documents set converted_document_id=cast(:new as uuid),row_version=row_version+1,updated_at=now() where id=:old and org_id=:o"),{"new":new_id,"old":d,"o":o});event(c,o,d,'CONVERTED_TO_INVOICE',a,n,{"invoice_id":new_id,"invoice_number":num});event(c,o,new_id,'CREATED_FROM_QUOTE',a,n,{"quote_id":d});return invoice
def apply_credit(o,credit_id,invoice_id,a,n,version):
 with engine.begin() as c:
  credit=c.execute(text("select * from finance_documents where org_id=:o and id=:id and document_type='CREDIT_NOTE' and status='ISSUED' and credit_applied=0 and row_version=:v for update"),{"o":o,"id":credit_id,"v":version}).mappings().first()
  invoice=c.execute(text("select * from finance_documents where org_id=:o and id=:id and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID','OVERDUE') for update"),{"o":o,"id":invoice_id}).mappings().first()
  if not credit or not invoice or credit['client_id']!=invoice['client_id'] or credit['currency']!=invoice['currency']:raise HTTPException(409,'credit_not_applicable')
  if credit.get('office_id') != invoice.get('office_id'):
   raise HTTPException(409,'credit_office_mismatch')
  active=c.execute(text("""select 1 from finance_saspay_attempts
    where org_id=:o and document_id=:invoice
      and status in ('CREATING','PENDING','AMBIGUOUS')
    limit 1"""),{"o":o,"invoice":invoice_id}).first()
  if active:raise HTTPException(409,'saspay_attempt_open')
  amount=min(money(credit['total']),money(invoice['balance_due']));balance=money(invoice['balance_due'])-amount;status='PAID' if balance==0 else 'PARTIALLY_PAID'
  c.execute(text("update finance_documents set credit_applied=:amount,status='ACCEPTED',source_document_id=:invoice,row_version=row_version+1,updated_at=now() where id=:credit and org_id=:o"),{"amount":amount,"invoice":invoice_id,"credit":credit_id,"o":o});c.execute(text("update finance_documents set balance_due=:balance,status=:status,row_version=row_version+1,updated_at=now() where id=:invoice and org_id=:o"),{"balance":balance,"status":status,"invoice":invoice_id,"o":o});event(c,o,credit_id,'CREDIT_APPLIED',a,n,{"invoice_id":invoice_id,"amount":str(amount)});event(c,o,invoice_id,'CREDIT_RECEIVED',a,n,{"credit_id":credit_id,"amount":str(amount)});return {"amount":amount,"invoice_balance":balance}
def reverse_payment(o,d,payment_id,a,n,reason):
 with engine.begin() as c:
  p=c.execute(text("select * from finance_payments where org_id=:o and document_id=:d and id=:p and status='CONFIRMED' for update"),{"o":o,"d":d,"p":payment_id}).mappings().first();doc=c.execute(text("select * from finance_documents where org_id=:o and id=:d for update"),{"o":o,"d":d}).mappings().first()
  if not p or not doc:raise HTTPException(409,'payment_not_reversible')
  paid=money(doc['amount_paid'])-money(p['amount'])
  if paid<0:raise HTTPException(409,'payment_balance_inconsistent')
  balance=money(doc['balance_due'])+money(p['amount']);status='ISSUED' if paid==0 else 'PARTIALLY_PAID'
  c.execute(text("update finance_payments set status='REVERSED',reversed_at=now(),reversed_by=:a,reversal_reason=:r where id=:p and org_id=:o"),{"a":a,"r":reason,"p":payment_id,"o":o});c.execute(text("update finance_documents set amount_paid=:paid,balance_due=:balance,status=:status,row_version=row_version+1,updated_at=now() where id=:d and org_id=:o"),{"paid":paid,"balance":balance,"status":status,"d":d,"o":o});event(c,o,d,'PAYMENT_REVERSED',a,n,{"payment_id":payment_id,"reason":reason},payment_id);return {"amount_paid":paid,"balance_due":balance,"status":status}
def refresh_overdue(o):
 with engine.begin() as c:return c.execute(text("update finance_documents set status='OVERDUE',row_version=row_version+1,updated_at=now() where org_id=:o and document_type='INVOICE' and status in ('ISSUED','PARTIALLY_PAID') and balance_due>0 and due_date<current_date"),{"o":o}).rowcount
def printable(o,d):
 x=detail(o,d);cfg=settings_for(o);esc=lambda v:html.escape(str(v or '—'));line_html=''.join(f"<tr><td>{esc(v['description'])}</td><td>{v['quantity']}</td><td>{v['unit_price']}</td><td>{v['line_total']}</td></tr>" for v in x['lines']);kind={'QUOTE':'DEVIS','INVOICE':'FACTURE','CREDIT_NOTE':'AVOIR'}[x['document_type']]
 return f"""<!doctype html><html><head><meta charset=utf-8><title>{esc(x['document_number'])}</title><style>body{{font:14px Arial;color:#17202a;max-width:900px;margin:40px auto}}header{{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:20px}}h1{{font-size:28px}}table{{width:100%;border-collapse:collapse;margin-top:30px}}th,td{{padding:12px;border-bottom:1px solid #ddd;text-align:left}}.totals{{margin:25px 0 0 auto;width:320px}}.totals p{{display:flex;justify-content:space-between}}@media print{{button{{display:none}}}}</style></head><body><button onclick=window.print()>Imprimer / Enregistrer en PDF</button><header><div><h2>{esc(cfg.get('legal_name') or 'SLAIVIO')}</h2><p>{esc(cfg.get('billing_address'))}</p><p>{esc(cfg.get('tax_identifier'))}</p></div><div><h1>{kind}</h1><b>{esc(x['document_number'])}</b><p>Date: {esc(x.get('issue_date') or x['created_at'].date())}</p><p>Échéance: {esc(x.get('due_date'))}</p></div></header><h3>Client</h3><p>{esc(x['client_name'])}<br>{esc(x.get('client_phone'))}<br>{esc(x.get('client_email'))}</p><table><thead><tr><th>Description</th><th>Quantité</th><th>Prix</th><th>Total</th></tr></thead><tbody>{line_html}</tbody></table><div class=totals><p><span>Sous-total</span><b>{x['subtotal']} {x['currency']}</b></p><p><span>Remise</span><b>-{x['discount_total']} {x['currency']}</b></p><p><span>Taxes</span><b>{x['tax_total']} {x['currency']}</b></p><p><span>Total</span><b>{x['total']} {x['currency']}</b></p><p><span>Solde</span><b>{x['balance_due']} {x['currency']}</b></p></div><p>{esc(x.get('terms'))}</p><footer>{esc(cfg.get('document_footer'))}</footer></body></html>"""
