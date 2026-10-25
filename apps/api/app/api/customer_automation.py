"""Administrative controls and opaque, revocable public invoice links."""
import hashlib
import re
from uuid import UUID
from uuid import uuid4
from fastapi import APIRouter,Depends,HTTPException,Response
from pydantic import BaseModel,Field
from sqlalchemy import text
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.db.database import engine
from app.customer_automation.policy import TEMPLATES,VARIABLE_ALIASES

router=APIRouter(tags=['customer-automation'])
admin=APIRouter(prefix='/organization/admin/customer-automation',dependencies=[Depends(require_permission('settings.write'))])


@admin.get('')
def overview(tenant=Depends(get_current_tenant)):
 with engine.connect() as c:
  failures=[dict(row) for row in c.execute(text("""select id,kind,status,last_error,attempts,created_at from customer_automation_events
   where org_id=:o and (status='FAILED' or (status='PENDING' and last_error is not null)) order by created_at desc limit 50"""),{'o':tenant['org_id']}).mappings()]
  waiting=[dict(row) for row in c.execute(text("""select e.id,e.reference,e.created_at,e.next_reminder_at,e.reminder_count,
   coalesce(cl.display_name,cl.name,'Client') client_name from parcel_expectations e
   join clients cl on cl.org_id=e.org_id and cl.id=e.client_id
   where e.org_id=:o and e.status='WAITING' order by e.created_at desc limit 100"""),{'o':tenant['org_id']}).mappings()]
  problems=[dict(row) for row in c.execute(text("""select id,package_reference,automation_last_error from cargo_packages
   where org_id=:o and deleted_at is null and automation_last_error is not null limit 50"""),{'o':tenant['org_id']}).mappings()]
  qualification=c.execute(text('select auto_create_qualified_whatsapp_clients from ai_settings where org_id=:o'),{'o':tenant['org_id']}).scalar()
  shares=[dict(row) for row in c.execute(text("""select s.id,s.revoked_at,d.document_number,coalesce(p.pickup_reference,cp.package_reference) pickup_reference
   from customer_document_shares s join finance_documents d on d.org_id=s.org_id and d.id=s.document_id
   left join pickup_orders p on p.org_id=s.org_id and p.id=s.pickup_id
   left join cargo_packages cp on cp.org_id=s.org_id and cp.id=s.package_id where s.org_id=:o
   order by s.created_at desc limit 30"""),{'o':tenant['org_id']}).mappings()]
 return {'templates':TEMPLATES,'variables':sorted(VARIABLE_ALIASES),'failures':failures,'expectations':waiting,'package_problems':problems,'auto_create_qualified':qualification is True,'document_shares':shares}


class Expectation(BaseModel):
 client_id:UUID
 reference:str|None=Field(default=None,max_length=160)


@admin.post('/expectations',status_code=201)
def create_expectation(body:Expectation,tenant=Depends(get_current_tenant)):
 with engine.begin() as c:
  if not c.execute(text('select 1 from clients where org_id=:o and id=:id and deleted_at is null'),{'o':tenant['org_id'],'id':body.client_id}).first():
   raise HTTPException(404,'client_not_found')
  return dict(c.execute(text("""insert into package_expectations(org_id,client_id,supplier_tracking,description,created_by)
   values(:o,:client,:tracking,:ref,:actor) returning *"""),{'o':tenant['org_id'],'client':body.client_id,'ref':body.reference,
   'tracking':f'ATT-{uuid4()}','actor':tenant.get('user_id') or 'agency'}).mappings().one())


@admin.post('/expectations/{expectation_id}/cancel')
def cancel_expectation(expectation_id:UUID,tenant=Depends(get_current_tenant)):
 with engine.begin() as c:
  row=c.execute(text("""update package_expectations source set status='CANCELLED',updated_at=now()
   from parcel_expectations e where e.org_id=:o and source.org_id=e.org_id and source.id=e.expectation_id
    and e.id=:id and e.status='WAITING' returning source.id"""),{'o':tenant['org_id'],'id':expectation_id}).first()
  if not row:raise HTTPException(404,'expectation_not_found')
 return {'cancelled':True}


@admin.post('/events/{event_id}/retry')
def retry(event_id:UUID,tenant=Depends(get_current_tenant)):
 with engine.begin() as c:
  row=c.execute(text("""update customer_automation_events set status='PENDING',attempts=0,available_at=now(),last_error=null
   where org_id=:o and id=:id and status='FAILED' returning id"""),{'o':tenant['org_id'],'id':event_id}).first()
  if not row:raise HTTPException(404,'customer_event_not_found')
 return {'queued':True}


@router.get('/public/customer-documents/{token}')
def public_document(token:str):
 if not re.fullmatch(r'[A-Za-z0-9_-]{48}',token):raise HTTPException(404,'document_not_found')
 with engine.connect() as c:
  row=c.execute(text("""select s.html_snapshot from customer_document_shares s
   join organizations o on o.id=s.org_id and o.status='ACTIVE'
   join finance_documents d on d.id=s.document_id and d.org_id=s.org_id and d.status<>'VOID'
   where s.token_hash=:hash and s.revoked_at is null and s.expires_at>now()
    and not exists(select 1 from finance_documents included where included.org_id=s.org_id
     and included.id=any(s.document_ids) and included.status='VOID')"""),{'hash':hashlib.sha256(token.encode()).hexdigest()}).first()
 if not row:raise HTTPException(404,'document_not_found')
 return Response(row[0],media_type='text/html; charset=utf-8',headers={
  'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"})


@admin.post('/documents/{share_id}/revoke',dependencies=[Depends(require_permission('documents.settings'))])
def revoke_document(share_id:UUID,tenant=Depends(get_current_tenant)):
 with engine.begin() as c:
  row=c.execute(text('update customer_document_shares set revoked_at=now() where org_id=:o and id=:id returning id'),{'o':tenant['org_id'],'id':share_id}).first()
  if not row:raise HTTPException(404,'document_not_found')
 return {'revoked':True}


router.include_router(admin)
