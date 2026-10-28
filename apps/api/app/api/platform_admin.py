from fastapi import APIRouter,Depends,HTTPException,Query
from pydantic import BaseModel,Field,AwareDatetime
from typing import Literal
from uuid import UUID
from app.core.platform_permissions import require_platform_permission
from app.platform.quarantine_repository import user_has_platform_permission
from app.platform_admin import repository as repo
from app.platform_admin import demo_requests as demos
from app.platform_admin import console
router=APIRouter(prefix='/platform/admin',tags=['platform-admin']);ALLOWED={'platform.admin.read','platform.agencies.manage','platform.billing.manage','platform.support.manage','platform.audit.read','platform.permissions.manage','quarantine.read','quarantine.resolve','quarantine.replay'}
def uid(m):return str(m.get('user_id')or m.get('id'))
class AgencyStatus(BaseModel):status:str;reason:str=Field(min_length=5,max_length=500);expected_version:int
class Subscription(BaseModel):
 plan_code:str=Field(min_length=1,max_length=50)
 status:str
 reason:str=Field(min_length=5,max_length=500)
 expected_version:int=Field(ge=1)
 ends_at:AwareDatetime|None=None
 trial_ends_at:AwareDatetime|None=None
class Note(BaseModel):note:str=Field(min_length=2,max_length=5000)
class Reply(BaseModel):message:str=Field(min_length=2,max_length=10000);status:str='IN_PROGRESS';expected_version:int=Field(ge=1)
class Grant(BaseModel):
 user_id:str=Field(pattern=r'^user_[A-Za-z0-9]+$',max_length=128)
 permissions:list[str]=Field(max_length=20)
 expected_permissions:list[str]=Field(max_length=20)
 reason:str=Field(min_length=5,max_length=500)
DemoStatus = Literal['NEW','CONTACTED','SCHEDULED','COMPLETED','CLOSED']
class DemoUpdate(BaseModel):
 status:DemoStatus
 expected_updated_at:AwareDatetime
 note:str|None=Field(default=None,max_length=2000)
@router.get('/access')
def access(manager=Depends(require_platform_permission('platform.admin.read'))):return {'allowed':True,'user_id':uid(manager),'permissions':repo.operator_permissions(uid(manager))}
@router.get('/demo-requests')
def demo_requests(q:str|None=Query(default=None,max_length=120),status:DemoStatus|None=None,page:int=Query(default=1,ge=1,le=100000),page_size:int=Query(default=25,ge=1,le=100),_=Depends(require_platform_permission('platform.admin.read'))):
 return demos.listing(q,status,page,page_size)
@router.get('/demo-requests/{request_id}')
def demo_request(request_id:UUID,_=Depends(require_platform_permission('platform.admin.read'))):
 row=demos.detail(request_id)
 if row is None:raise HTTPException(404,'demo_request_not_found')
 return row
@router.patch('/demo-requests/{request_id}')
def update_demo_request(request_id:UUID,body:DemoUpdate,manager=Depends(require_platform_permission('platform.agencies.manage'))):
 row=demos.update(request_id,uid(manager),body.status,body.expected_updated_at,body.note)
 if row=='missing':raise HTTPException(404,'demo_request_not_found')
 if row=='conflict':raise HTTPException(409,'demo_request_was_modified')
 return {'request':row}
@router.get('/overview')
def overview(_=Depends(require_platform_permission('platform.admin.read'))):return {'status':'ok','metrics':repo.overview()}
RegisterKind=Literal['agencies','subscriptions','invoices','checkouts','support','audit','quarantine']
REGISTER_PERMISSIONS={'agencies':'platform.admin.read','subscriptions':'platform.billing.manage','invoices':'platform.billing.manage','checkouts':'platform.billing.manage','support':'platform.support.manage','audit':'platform.audit.read','quarantine':'quarantine.read'}
@router.get('/register/{kind}')
def register(kind:RegisterKind,q:str|None=Query(default=None,max_length=120),status:str|None=Query(default=None,max_length=80),page:int=Query(default=1,ge=1,le=100000),page_size:int=Query(default=25,ge=1,le=100),manager=Depends(require_platform_permission('platform.admin.read'))):
 require_platform_permission(REGISTER_PERMISSIONS[kind])(manager)
 return console.register(kind,q,status,page,page_size)
@router.get('/plans')
def plans(_=Depends(require_platform_permission('platform.billing.manage'))):return {'items':console.plans()}
@router.get('/operations')
def operations(_=Depends(require_platform_permission('quarantine.read'))):return console.operations()
@router.get('/tickets/{ticket_id}')
def ticket(ticket_id:UUID,_=Depends(require_platform_permission('platform.support.manage'))):
 row=console.ticket(ticket_id)
 if row is None:raise HTTPException(404,'ticket_not_found')
 return row
@router.get('/agencies')
def agencies(q:str|None=None,status:str|None=None,_=Depends(require_platform_permission('platform.admin.read'))):return {'items':repo.agencies(q,status)}
@router.get('/agencies/{org_id}')
def agency(org_id:str,manager=Depends(require_platform_permission('platform.admin.read'))):
 row=repo.agency(org_id)
 if not row:raise HTTPException(404,'agency_not_found')
 if not user_has_platform_permission(uid(manager),'platform.billing.manage'):row['invoices']=[]
 row['spaces']=console.spaces(org_id)
 return row
@router.get('/agencies/{org_id}/capacity')
def capacity(org_id:str,_=Depends(require_platform_permission('platform.billing.manage'))):
 row=console.capacity(org_id)
 if row is None:raise HTTPException(404,'agency_not_found')
 return row
@router.patch('/agencies/{org_id}/status')
def agency_status(org_id:str,body:AgencyStatus,manager=Depends(require_platform_permission('platform.agencies.manage'))):
 if body.status not in {'ACTIVE','SUSPENDED','CLOSED'}:raise HTTPException(422,'invalid_agency_status')
 row=repo.update_agency(org_id,uid(manager),body.status,body.reason,body.expected_version)
 if row=='missing':raise HTTPException(404,'agency_not_found')
 if row=='conflict':raise HTTPException(409,'agency_was_modified')
 return {'organization':row}
@router.patch('/agencies/{org_id}/subscription')
def subscription(org_id:str,body:Subscription,manager=Depends(require_platform_permission('platform.billing.manage'))):
 if body.status not in {'TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED'}:raise HTTPException(422,'invalid_subscription_status')
 row=repo.subscription(org_id,uid(manager),body.plan_code,body.status,body.reason,body.expected_version,body.ends_at,body.trial_ends_at)
 if isinstance(row,str) and row in {'missing','plan'}:raise HTTPException(404,row)
 if row=='conflict':raise HTTPException(409,'subscription_was_modified')
 if row=='expiry':raise HTTPException(422,'subscription_future_expiry_required')
 return {'subscription':row}
@router.post('/agencies/{org_id}/notes')
def note(org_id:str,body:Note,manager=Depends(require_platform_permission('platform.agencies.manage'))):
 row=repo.add_note(org_id,uid(manager),body.note)
 if row is None:raise HTTPException(404,'agency_not_found')
 return {'note':row}
@router.get('/tickets')
def tickets(status:str|None=None,priority:str|None=None,_=Depends(require_platform_permission('platform.support.manage'))):return {'items':repo.tickets(status,priority)}
@router.post('/tickets/{ticket_id}/reply')
def reply(ticket_id:str,body:Reply,manager=Depends(require_platform_permission('platform.support.manage'))):
 if body.status not in {'IN_PROGRESS','WAITING_CUSTOMER','RESOLVED'}:raise HTTPException(422,'invalid_ticket_status')
 row=repo.support_reply(ticket_id,uid(manager),str(manager.get('name')or manager.get('email')or'Slaivio Support'),body.message,body.status,body.expected_version)
 if row=='missing':raise HTTPException(404,'ticket_not_found')
 if row=='conflict':raise HTTPException(409,'ticket_was_modified')
 return {'message':row}
@router.get('/audit')
def audit(_=Depends(require_platform_permission('platform.audit.read'))):return {'items':repo.audit()}
@router.get('/operators')
def operators(_=Depends(require_platform_permission('platform.permissions.manage'))):return {'items':repo.operators()}
@router.put('/operators')
def grant(body:Grant,manager=Depends(require_platform_permission('platform.permissions.manage'))):
 if any(p not in ALLOWED for p in body.permissions):raise HTTPException(422,'invalid_platform_permissions')
 if body.permissions and 'platform.admin.read' not in body.permissions:raise HTTPException(422,'platform_read_permission_required')
 result=repo.grant(uid(manager),body.user_id,sorted(set(body.permissions)),body.expected_permissions,body.reason)
 if result=='forbidden':raise HTTPException(403,'platform_permission_required')
 if result=='self':raise HTTPException(409,'platform_self_permissions_protected')
 if result=='last_admin':raise HTTPException(409,'platform_last_admin_protected')
 if result=='conflict':raise HTTPException(409,'platform_permissions_were_modified')
 return {'permissions':result}
