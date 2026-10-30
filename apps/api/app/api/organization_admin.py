import re
from typing import Any,Literal
from fastapi import APIRouter,Depends,HTTPException,File,Form,UploadFile
from pydantic import BaseModel,Field,field_validator
from uuid import UUID
from app.core.auth import get_current_manager
from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.organization_admin import repository as repo
from app.organization_admin import pilot_repository as pilot_repo
from app.services.wazzap_activation_service import activate_wazzap_number
from app.organization_admin.settings_policy import validate_policies, validate_timezone
from app.services.agency_brand_images import MAX_BYTES, FORMATS, store_brand_image
from starlette.concurrency import run_in_threadpool

router=APIRouter(prefix='/organization/admin',tags=['organization-admin'])
def actor(m):return m.get('user_id') or m.get('id')
class OrgUpdate(BaseModel):
    expected_version:int=Field(ge=1); organization_name:str|None=None;legal_name:str|None=None;brand_slogan:str|None=Field(default=None,max_length=180);brand_description:str|None=Field(default=None,max_length=2000);country:str|None=None;city:str|None=None;address:str|None=None;phone:str|None=None;email:str|None=None;website:str|None=None;registration_number:str|None=None;tax_number:str|None=None;logo_url:str|None=None;organization_type:str|None=None;whatsapp:str|None=None;province:str|None=None;postal_code:str|None=None;registration_country:str|None=None;legal_address:str|None=None;logo_dark_url:str|None=None;primary_color:str|None=None;secondary_color:str|None=None;document_display_name:str|None=None;signature_url:str|None=None;stamp_url:str|None=None

    @field_validator('primary_color','secondary_color')
    @classmethod
    def color(cls,value):
        if value and not re.fullmatch(r'#[0-9a-fA-F]{6}',value):raise ValueError('invalid_brand_color')
        return value

    @field_validator('logo_url','logo_dark_url','signature_url','stamp_url')
    @classmethod
    def image_url(cls,value):
        from urllib.parse import urlsplit
        if value:
            parsed=urlsplit(value)
            if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError('https_image_url_required')
        return value
class SettingsUpdate(BaseModel):
    expected_version:int=Field(ge=1);timezone:str='UTC';currency_code:str='USD';country_code:str|None=None;language_code:str='fr';date_format:str='DD/MM/YYYY';weight_unit:str='kg';volume_unit:str='cbm';notification_email:str|None=None;settings:dict[str,Any]={};security:dict[str,Any]={};time_format:str='24H';week_starts_on:int=Field(default=1,ge=0,le=6);dimension_unit:str='cm';distance_unit:str='km';data_retention_days:int=Field(default=1095,ge=30,le=3650);privacy:dict[str,Any]={}

    _timezone = field_validator('timezone')(validate_timezone)
    _policies = field_validator('settings')(validate_policies)

    @field_validator('language_code')
    @classmethod
    def language(cls, value):
        if value not in {'fr', 'en'}: raise ValueError('unsupported_language')
        return value

    @field_validator('currency_code')
    @classmethod
    def currency(cls, value):
        if value not in {'USD','CDF','EUR','CNY','AED','XAF','XOF','AOA','GBP','GHS','KES'}: raise ValueError('unsupported_currency')
        return value

    @field_validator('security')
    @classmethod
    def security_policy(cls, value):
        if 'require_mfa' in value and type(value['require_mfa']) is not bool:
            raise ValueError('invalid_mfa_policy')
        return value
class MemberUpdate(BaseModel):
    expected_version:int=Field(ge=1)
    role_code:str
    status:str

class BrandUpdate(BaseModel):
    organization:OrgUpdate
    settings_version:int=Field(ge=1)
    favicon_url:str|None=Field(default=None,max_length=2000)

    @field_validator('favicon_url')
    @classmethod
    def favicon(cls,value):
        return OrgUpdate.image_url(value)
class MemberOfficeAccessUpdate(BaseModel):
    expected_version:int=Field(ge=1)
    office_access_scope:Literal['ALL_OFFICES','SELECTED_OFFICES']
    office_ids:list[UUID]=Field(default_factory=list,max_length=100)
class OfficeContextUpdate(BaseModel):
    selected_office_id:UUID|None=None
class RoleSave(BaseModel): code:str=Field(pattern=r'^[A-Z][A-Z0-9_]{2,39}$');name:str=Field(min_length=2,max_length=80);description:str|None=None;permissions:list[str]
class WorkspaceSave(BaseModel):name:str=Field(min_length=2,max_length=100);code:str=Field(pattern=r'^[A-Za-z0-9_-]{2,20}$');country_code:str|None=None;currency_code:str='USD';timezone:str='UTC';language_code:str='fr'
class WorkspaceArchive(BaseModel):expected_version:int=Field(ge=1)
class LocationSave(BaseModel):
    workspace_id:str|None=None
    name:str=Field(min_length=2,max_length=120)
    code:str|None=Field(default=None,pattern=r'^[A-Za-z0-9_-]{2,30}$')
    location_type:Literal['OFFICE','WAREHOUSE','HUB','PICKUP_POINT']='OFFICE'
    country:str=Field(min_length=2,max_length=80)
    city:str=Field(min_length=2,max_length=100)
    address:str|None=Field(default=None,max_length=300)
    phone:str|None=Field(default=None,max_length=30)
    whatsapp:str|None=None
    email:str|None=None
    manager_name:str|None=None
    opening_hours:dict[str,Any]=Field(default_factory=dict)
    timezone:str='UTC'
    services:list[str]=Field(default_factory=list)


class LocationStatusUpdate(BaseModel):
    status:Literal['ACTIVE','INACTIVE']
    expected_version:int=Field(ge=1)
class IntegrationSave(BaseModel):provider:str=Field(pattern=r'^(WHATSAPP|GMAIL)$');account_label:str=Field(min_length=2,max_length=120);status:str=Field(pattern=r'^(DISCONNECTED|CONNECTING|CONNECTED|ERROR)$');granted_permissions:list[str]=[];configuration:dict[str,Any]={}
class NumberingSave(BaseModel):
    prefix_format:str=Field(min_length=3,max_length=100)
    expected_version:int=Field(ge=1)
    counter_scope:Literal['GLOBAL','OFFICE']='GLOBAL'
    reset_period:Literal['NEVER','YEAR','MONTH']='NEVER'

    @field_validator('prefix_format')
    @classmethod
    def validate_prefix_format(cls,value:str)->str:
        value=value.strip()
        tokens=re.findall(r'\{[^{}]+\}',value)
        unknown=[token for token in tokens if token not in {'{YYYY}','{YEAR}','{MM}','{OFFICE}','{0001}','{000001}','{00000001}','{SEQUENCE}'}]
        sequence_count=sum(token == '{SEQUENCE}' or bool(re.fullmatch(r'\{0{3,7}1\}',token)) for token in tokens)
        if unknown:raise ValueError('unknown_identifier_placeholder')
        if sequence_count!=1:raise ValueError('identifier_requires_one_sequence')
        if any(ord(character)<32 for character in value):raise ValueError('identifier_contains_control_character')
        return value
class DataRequest(BaseModel):request_type:str=Field(pattern=r'^(EXPORT|ARCHIVE_WORKSPACE|DELETE_WORKSPACE|DELETE_ORGANIZATION)$');scope:dict[str,Any]={};confirmation:str|None=None
class ApiKeyCreate(BaseModel):name:str=Field(min_length=2,max_length=80);scopes:list[str]=Field(min_length=1,max_length=30);expires_at:str|None=None
class PilotWhatsappNumber(BaseModel):number_id:str=Field(min_length=1,max_length=80)
class PilotWhatsappPreferences(BaseModel):
    auto_mark_read:bool=False
    group_replies_enabled:bool=False
    group_on_dossier_create:bool=False
class PilotWazzapActivation(BaseModel):
    phone_number:str=Field(min_length=7,max_length=30)
    verified_name:str|None=Field(default=None,max_length=120)
    default_language:str=Field(default='fr',pattern=r'^[a-z]{2}(?:-[A-Z]{2})?$')
    default_timezone:str=Field(default='Africa/Kinshasa',min_length=3,max_length=80)
class PilotKnowledgeDefaults(BaseModel):
    default_language:Literal['FR','EN']='FR'
    default_review_days:int=Field(ge=7,le=730)
    expected_version:int=Field(ge=1)
class ParcelOperationSettings(BaseModel):
    package_number_pattern:str=Field(min_length=8,max_length=100)
    prospect_followup_delay_hours:int=Field(ge=1,le=720)
    incomplete_profile_followup_hours:int=Field(ge=1,le=720)
    notify_next_departure:bool=True
    notify_package_milestones:bool=True
    require_payment_clearance:bool=True
    expected_version:int=Field(ge=1)

    @field_validator('package_number_pattern')
    @classmethod
    def validate_package_number_pattern(cls,value:str)->str:
        value=value.strip()
        if value.count('{000001}')!=1:raise ValueError('package_identifier_requires_sequence')
        return value

@router.get('/pilot',dependencies=[Depends(require_permission('pilot.settings.read'))])
def get_pilot_settings(tenant=Depends(get_current_tenant)):
    return {'status':'ok',**pilot_repo.overview(tenant['org_id'])}

@router.patch('/pilot/whatsapp-number',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def patch_pilot_whatsapp_number(body:PilotWhatsappNumber,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    return {'status':'ok','number':pilot_repo.select_whatsapp_number(tenant['org_id'],actor(manager),body.number_id)}

@router.patch('/pilot/whatsapp-number/{number_id}/preferences',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def patch_pilot_whatsapp_preferences(number_id:str,body:PilotWhatsappPreferences,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    return {'status':'ok','number':pilot_repo.save_whatsapp_preferences(tenant['org_id'],actor(manager),number_id,body.auto_mark_read,body.group_replies_enabled,body.group_on_dossier_create)}

@router.post('/pilot/wazzap/activate',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def post_pilot_wazzap_activation(body:PilotWazzapActivation,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    number=activate_wazzap_number(
        tenant['org_id'],actor(manager),body.phone_number,body.verified_name,
        body.default_language,body.default_timezone,
    )
    return {'status':'ok','number':number}

@router.patch('/pilot/knowledge',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def patch_pilot_knowledge(body:PilotKnowledgeDefaults,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    return {'status':'ok','knowledge':pilot_repo.save_knowledge_defaults(tenant['org_id'],actor(manager),body.default_language,body.default_review_days,body.expected_version)}

@router.patch('/pilot/parcel-operations',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def patch_parcel_operation_settings(body:ParcelOperationSettings,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=pilot_repo.save_parcel_operation_settings(tenant['org_id'],actor(manager),body.model_dump(exclude={'expected_version'}),body.expected_version)
    if not row:raise HTTPException(409,'parcel_operation_settings_modified')
    return {'status':'ok','parcel_operations':row}

@router.patch('/pilot/numbering/{document_type}',dependencies=[Depends(require_permission('pilot.settings.manage'))])
def patch_pilot_numbering(document_type:str,body:NumberingSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    document_type=document_type.upper()
    if document_type not in {'CLIENT','DOSSIER','PACKAGE'}:raise HTTPException(404,'pilot_identifier_type_not_found')
    row=repo.save_numbering(tenant['org_id'],actor(manager),document_type,body.prefix_format,body.expected_version)
    if not row:raise HTTPException(409,'numbering_was_modified')
    return {'status':'ok','numbering':row}

@router.get('/pilot/readiness',dependencies=[Depends(require_permission('pilot.readiness.read'))])
def get_pilot_readiness(tenant=Depends(get_current_tenant)):
    return {'status':'ok','readiness':pilot_repo.readiness(tenant['org_id'])}

@router.post('/pilot/readiness/reviews',dependencies=[Depends(require_permission('pilot.readiness.review'))])
def post_pilot_readiness_review(tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    return {'status':'ok','review':pilot_repo.record_readiness_review(tenant['org_id'],actor(manager))}

@router.get('',dependencies=[Depends(require_permission('organization.read'))])
def get_admin(tenant=Depends(get_current_tenant)):return {'status':'ok',**repo.overview(tenant['org_id'])}
@router.get('/office-context')
def get_office_context(
    selected_office_id:str|None=None,
    tenant=Depends(get_current_tenant),
):
    return {'status':'ok',**repo.office_context(tenant['org_id'],tenant['user_id'],selected_office_id)}
@router.post('/office-context')
def post_office_context(
    body:OfficeContextUpdate,
    tenant=Depends(get_current_tenant),
):
    return {'status':'ok',**repo.office_context(
        tenant['org_id'],tenant['user_id'],
        str(body.selected_office_id) if body.selected_office_id else None,
    )}
@router.patch('',dependencies=[Depends(require_permission('organization.manage'))])
def patch_org(body:OrgUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.update_org(tenant['org_id'],actor(manager),body.model_dump(exclude={'expected_version'},exclude_unset=True),body.expected_version)
    if not row:raise HTTPException(409,'organization_was_modified')
    return {'status':'ok','organization':row}

@router.post('/brand/images',dependencies=[Depends(require_permission('organization.manage'))])
async def upload_brand_image(
    file:UploadFile=File(...),kind:Literal['logo','dark_logo','favicon']=Form('logo'),
    tenant=Depends(get_current_tenant),
):
    if file.content_type not in FORMATS:
        raise HTTPException(415,'brand_image_type_unsupported')
    content=await file.read(MAX_BYTES+1)
    url=await run_in_threadpool(store_brand_image,tenant['org_id'],kind,content,file.content_type)
    return {'url':url}

@router.patch('/brand',dependencies=[Depends(require_permission('organization.manage')),Depends(require_permission('settings.write'))])
def patch_brand(body:BrandUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    from app.db.database import engine
    with engine.begin() as connection:
        organization=repo.update_org(tenant['org_id'],actor(manager),
            body.organization.model_dump(exclude={'expected_version'},exclude_unset=True),
            body.organization.expected_version,connection=connection)
        if not organization:raise HTTPException(409,'organization_was_modified')
        settings=repo.save_settings(tenant['org_id'],actor(manager),{'settings':{'brand_favicon_url':body.favicon_url}},
            body.settings_version,connection=connection)
        if not settings:raise HTTPException(409,'settings_were_modified')
    return {'organization':organization,'settings':settings}
@router.get('/operational-settings')
def operational_settings(tenant=Depends(get_current_tenant)):
    return repo.operational_settings(tenant['org_id'])

@router.patch('/settings')
def patch_settings(body:SettingsUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    changes=body.model_dump(exclude={'expected_version'},exclude_unset=True)
    repo.authorize_settings_update(tenant['org_id'],actor(manager),changes,manager)
    row=repo.save_settings(tenant['org_id'],actor(manager),changes,body.expected_version)
    if not row:raise HTTPException(409,'settings_were_modified')
    return {'status':'ok','settings':row}
@router.patch('/members/{member_id}',dependencies=[Depends(require_permission('team.manage'))])
def patch_member(member_id:str,body:MemberUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    if body.status not in {'ACTIVE','SUSPENDED'}:raise HTTPException(422,'invalid_member_status')
    row=repo.update_member(
        tenant['org_id'],member_id,actor(manager),body.role_code,body.status,
        body.expected_version,
    )
    if row=='last_owner':raise HTTPException(409,'organization_requires_an_active_owner')
    if isinstance(row,str) and row in {'missing','invalid_role'}:raise HTTPException(404,row)
    if row=='conflict':raise HTTPException(409,'membership_was_modified')
    return {'status':'ok','member':row}
@router.patch('/members/{member_id}/offices',dependencies=[Depends(require_permission('locations.access.manage'))])
def patch_member_offices(member_id:str,body:MemberOfficeAccessUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.update_member_office_access(
        tenant['org_id'],member_id,actor(manager),body.office_access_scope,
        [str(value) for value in body.office_ids],body.expected_version,
    )
    if row=='owner_requires_all_offices':raise HTTPException(422,row)
    if isinstance(row,str) and row in {'invalid_office_assignment','invalid_office_access_scope'}:raise HTTPException(422,row)
    if row=='missing':raise HTTPException(404,'membership_not_found')
    if row=='conflict':raise HTTPException(409,'membership_was_modified')
    return {'status':'ok','member':row}
@router.post('/roles',dependencies=[Depends(require_permission('roles.manage'))])
def post_role(body:RoleSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    return {'status':'ok','role':repo.save_role(tenant['org_id'],actor(manager),{'code':body.code,'name':body.name,'description':body.description,'permissions':body.permissions})}
@router.delete('/invitations/{invitation_id}',dependencies=[Depends(require_permission('team.manage'))])
def delete_invitation(invitation_id:str,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.revoke_invitation(tenant['org_id'],invitation_id,actor(manager))
    if not row:raise HTTPException(404,'pending_invitation_not_found')
    return {'status':'ok','invitation':row}
@router.post('/workspaces',dependencies=[Depends(require_permission('workspaces.manage'))])
def post_workspace(body:WorkspaceSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):return {'status':'ok','workspace':repo.save_workspace(tenant['org_id'],actor(manager),body.model_dump())}
@router.post('/workspaces/{item_id}/archive',dependencies=[Depends(require_permission('workspaces.manage'))])
def post_workspace_archive(item_id:str,body:WorkspaceArchive,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.archive_workspace(tenant['org_id'],actor(manager),item_id,body.expected_version)
    if not row:raise HTTPException(409,'workspace_was_modified')
    return {'status':'ok','workspace':row}
@router.post('/locations',dependencies=[Depends(require_permission('locations.manage'))])
def post_location(body:LocationSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):return {'status':'ok','location':repo.save_location(tenant['org_id'],actor(manager),body.model_dump())}
@router.patch('/locations/{item_id}/status',dependencies=[Depends(require_permission('locations.manage'))])
def patch_location_status(item_id:str,body:LocationStatusUpdate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.set_location_status(tenant['org_id'],actor(manager),item_id,body.status,body.expected_version)
    if not row:raise HTTPException(409,'location_was_modified')
    return {'status':'ok','location':row}
@router.post('/integrations',dependencies=[Depends(require_permission('integrations.manage'))])
def post_integration(body:IntegrationSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):return {'status':'ok','integration':repo.save_integration(tenant['org_id'],actor(manager),body.model_dump())}
@router.patch('/numbering/{document_type}',dependencies=[Depends(require_permission('documents.settings'))])
def patch_numbering(document_type:str,body:NumberingSave,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    if body.counter_scope=='OFFICE' and '{OFFICE}' not in body.prefix_format:
        raise HTTPException(422,'reference_office_token_required')
    if body.reset_period!='NEVER' and not any(token in body.prefix_format for token in ('{YYYY}','{YEAR}')):
        raise HTTPException(422,'reference_year_token_required')
    if body.reset_period=='MONTH' and '{MM}' not in body.prefix_format:
        raise HTTPException(422,'reference_month_token_required')
    row=repo.save_numbering(tenant['org_id'],actor(manager),document_type.upper(),body.prefix_format,body.expected_version,body.counter_scope,body.reset_period)
    if not row:raise HTTPException(409,'numbering_was_modified')
    return {'status':'ok','numbering':row}
@router.post('/data-requests',dependencies=[Depends(require_permission('data.manage'))])
def post_data_request(body:DataRequest,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    if body.request_type=='DELETE_ORGANIZATION':
        org=repo.overview(tenant['org_id'])['organization'] or {}
        expected=org.get('organization_name') or org.get('name')
        if not expected or body.confirmation!=expected:raise HTTPException(422,'organization_name_confirmation_required')
    return {'status':'ok','request':repo.request_data_operation(tenant['org_id'],actor(manager),body.request_type,body.scope)}
@router.post('/api-keys',dependencies=[Depends(require_permission('developers.manage'))])
def post_api_key(body:ApiKeyCreate,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):return {'status':'ok','api_key':repo.create_api_key(tenant['org_id'],actor(manager),body.name,body.scopes,body.expires_at)}
@router.delete('/api-keys/{item_id}',dependencies=[Depends(require_permission('developers.manage'))])
def delete_api_key(item_id:str,tenant=Depends(get_current_tenant),manager=Depends(get_current_manager)):
    row=repo.revoke_api_key(tenant['org_id'],actor(manager),item_id)
    if not row:raise HTTPException(404,'active_api_key_not_found')
    return {'status':'ok','api_key':row}
