from datetime import date,datetime,timezone
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter,Depends,Query,Response,HTTPException,Request
from pydantic import BaseModel,Field,field_validator
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.finance import repository as repo
from app.finance.package_invoices import create_package_invoice, get_package_invoice
from app.core.office_context import get_current_office_context, office_scope_ids
from app.finance.office_scope import require_document, assign_office

def require_finance_scope(request:Request,context=Depends(get_current_office_context),tenant=Depends(get_current_tenant)):
 offices=office_scope_ids(context)
 if offices is None:return
 document_id=request.path_params.get('document_id')
 if document_id:
  try:UUID(document_id)
  except ValueError:raise HTTPException(404,'finance_document_not_found')
  require_document(tenant['org_id'],document_id,offices)
  if request.url.path.endswith(('/convert','/apply-credit','/office')):
   raise HTTPException(403,'finance_organization_context_required')
  return
 # These list endpoints explicitly apply the office predicate in the repository.
 if request.method=='GET' and request.url.path.rstrip('/').endswith(('/finance','/finance/stats','/finance/export')):return
 raise HTTPException(403,'finance_organization_context_required')

router=APIRouter(prefix="/finance",tags=["finance"],dependencies=[Depends(require_finance_scope)])
def actor(t):return str(t.get("user_id") or "system")
def name(t):return str(t.get("actor_name") or "Membre de l'agence")
class Line(BaseModel):
 description:str=Field(min_length=1,max_length=500);quantity:float=Field(gt=0);unit_price:float=Field(ge=0);discount_rate:float=Field(default=0,ge=0,le=100);tax_rate:float=Field(default=0,ge=0,le=100);metadata:dict={}
class DocumentCreate(BaseModel):
 document_type:str;client_id:str;dossier_id:str|None=None;source_document_id:str|None=None;currency:str=Field(min_length=3,max_length=3);due_date:date|None=None;notes:str|None=None;terms:str|None=None;lines:list[Line]=Field(min_length=1,max_length=200)
 @field_validator('document_type')
 @classmethod
 def kind(cls,v):
  if v not in {'QUOTE','INVOICE','CREDIT_NOTE'}:raise ValueError('invalid_document_type')
  return v
 @field_validator('currency')
 @classmethod
 def currency_code(cls,v):return v.upper()
class Version(BaseModel):expected_version:int=Field(ge=1)
class OfficeAssignment(Version):office_id:UUID
class Void(Version):reason:str=Field(min_length=4,max_length=500)
class Payment(BaseModel):
 amount:Decimal=Field(gt=0,max_digits=18,decimal_places=2,allow_inf_nan=False)
 currency:str=Field(pattern=r'^[A-Za-z]{3}$')
 method:str=Field(min_length=2,max_length=50)
 reference:str|None=None
 paid_at:datetime=Field(default_factory=lambda:datetime.now(timezone.utc))
 idempotency_key:str=Field(min_length=8,max_length=160)
 @field_validator('currency')
 @classmethod
 def currency_code(cls,v):return v.upper()
class Decision(Version):accepted:bool;reason:str|None=Field(default=None,max_length=500)
class Convert(Version):due_date:date|None=None
class Credit(Version):invoice_id:str
class Reverse(BaseModel):reason:str=Field(min_length=4,max_length=500)
class Settings(BaseModel):legal_name:str|None=None;tax_identifier:str|None=None;billing_address:str|None=None;default_currency:str=Field(min_length=3,max_length=3);default_tax_rate:float=Field(ge=0,le=100);default_payment_terms_days:int=Field(ge=0,le=365);document_footer:str|None=None
class DuePolicy(BaseModel):
 name:str=Field(min_length=1,max_length=120)
 trigger_event:str=Field(pattern=r'^(RECEPTION|ARRIVAL|DELIVERY|MANUAL)$')
 rule_type:str=Field(pattern=r'^(PERCENTAGE|FIXED_AMOUNT)$')
 percentage:float|None=Field(default=None,ge=0,le=100)
 fixed_amount:Decimal|None=Field(default=None,gt=0,allow_inf_nan=False,max_digits=18,decimal_places=2)
 currency:str=Field(default='USD',min_length=3,max_length=3)
 is_active:bool=True
 @field_validator('currency')
 @classmethod
 def currency_code(cls,v):return v.upper()
 @field_validator('fixed_amount')
 @classmethod
 def fixed_required_for_rule(cls,v,info):
  if info.data.get('rule_type')=='FIXED_AMOUNT' and v is None: raise ValueError('fixed_amount_required')
  return v
 @field_validator('percentage')
 @classmethod
 def percent_required_for_rule(cls,v,info):
  if info.data.get('rule_type')=='PERCENTAGE' and v is None: raise ValueError('percentage_required')
  return v

@router.get("")
def index(q:str|None=None,status:str|None=None,document_type:str|None=None,page:int=Query(1,ge=1),page_size:int=Query(50,ge=1,le=100),tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read")),context=Depends(get_current_office_context)):return repo.list_documents(tenant['org_id'],q,status,document_type,page,page_size,office_ids=office_scope_ids(context))
@router.get("/due-policies")
def due_policies(tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):return repo.list_due_policies(tenant['org_id'])
@router.post("/due-policies")
def due_policies_save(body:DuePolicy,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.settings"))):return repo.upsert_due_policy(tenant['org_id'],actor(tenant),name(tenant),body.model_dump())
@router.get("/stats")
def stats(tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read")),context=Depends(get_current_office_context)):return repo.stats(tenant['org_id'],office_ids=office_scope_ids(context))
@router.get("/settings")
def settings(tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):return repo.settings_for(tenant['org_id'])
@router.put("/settings")
def settings_save(body:Settings,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.settings"))):return repo.save_settings(tenant['org_id'],actor(tenant),body.model_dump())
@router.post("/overdue/refresh")
def overdue(tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.issue"))):return {"updated":repo.refresh_overdue(tenant['org_id'])}
@router.get("/export")
def export(tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.export")),context=Depends(get_current_office_context)):return Response(repo.export(tenant['org_id'],office_ids=office_scope_ids(context)),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":"attachment; filename=slaivio-facturation.csv"})
@router.post("")
def create(body:DocumentCreate,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.create"))):return repo.create(tenant['org_id'],actor(tenant),name(tenant),body.model_dump())
@router.get("/{document_id}/due-obligations")
def due_obligations(document_id:str,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):return repo.get_due_obligations(tenant['org_id'],document_id)
@router.post("/{document_id}/due-obligations")
def due_obligations_recalculate(document_id:str,body:dict|None=None,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.settings"))):
 trigger_event = ((body or {}).get('trigger_event') if isinstance(body, dict) else None)
 return repo.evaluate_due_obligations(tenant['org_id'],document_id,trigger_event=str(trigger_event).upper() if trigger_event else None, a=actor(tenant), n=name(tenant))
@router.get("/{document_id}")
def detail(document_id:str,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):return repo.detail(tenant['org_id'],document_id)
@router.post("/{document_id}/office")
def office_assignment(document_id:UUID,body:OfficeAssignment,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.settings"))):
 return assign_office(tenant['org_id'],str(document_id),str(body.office_id),body.expected_version,actor(tenant),name(tenant))
@router.get("/packages/{package_id}/invoice",dependencies=[Depends(require_permission("packages.read"))])
def package_invoice(package_id:UUID,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):
 return get_package_invoice(tenant['org_id'],str(package_id))
@router.post("/packages/{package_id}/invoice",dependencies=[Depends(require_permission("packages.read")),Depends(require_permission("finance.read"))])
def package_invoice_create(package_id:UUID,body:Version,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.create"))):
 return create_package_invoice(tenant['org_id'],str(package_id),actor(tenant),name(tenant),body.expected_version)
@router.get("/{document_id}/print")
def printable(document_id:str,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):return Response(repo.printable(tenant['org_id'],document_id),media_type="text/html; charset=utf-8")
@router.post("/{document_id}/issue")
def issue(document_id:str,body:Version,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.issue"))):return repo.issue(tenant['org_id'],document_id,actor(tenant),name(tenant),body.expected_version)
@router.post("/{document_id}/payments")
def payment(document_id:str,body:Payment,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.payments"))):return repo.pay(tenant['org_id'],document_id,actor(tenant),name(tenant),body.model_dump())
@router.get("/{document_id}/payments/{payment_id}/receipt")
def receipt(document_id:str,payment_id:str,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.read"))):
 return Response(repo.receipt(tenant['org_id'],document_id,payment_id),media_type="text/html; charset=utf-8",headers={"Cache-Control":"no-store","Content-Disposition":"attachment; filename=receipt.html","X-Content-Type-Options":"nosniff"})
@router.post("/{document_id}/decision")
def decision(document_id:str,body:Decision,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.issue"))):return repo.quote_decision(tenant['org_id'],document_id,actor(tenant),name(tenant),body.expected_version,body.accepted,body.reason)
@router.post("/{document_id}/convert")
def convert(document_id:str,body:Convert,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.create"))):return repo.convert_quote(tenant['org_id'],document_id,actor(tenant),name(tenant),body.expected_version,body.due_date)
@router.post("/{document_id}/apply-credit")
def credit(document_id:str,body:Credit,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.payments"))):return repo.apply_credit(tenant['org_id'],document_id,body.invoice_id,actor(tenant),name(tenant),body.expected_version)
@router.post("/{document_id}/payments/{payment_id}/reverse")
def reverse(document_id:str,payment_id:str,body:Reverse,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.reverse_payment"))):return repo.reverse_payment(tenant['org_id'],document_id,payment_id,actor(tenant),name(tenant),body.reason)
@router.post("/{document_id}/void")
def void(document_id:str,body:Void,tenant=Depends(get_current_tenant),_=Depends(require_permission("finance.void"))):return repo.void(tenant['org_id'],document_id,actor(tenant),name(tenant),body.expected_version,body.reason)
