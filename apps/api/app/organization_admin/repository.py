import json
import hashlib
import secrets
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.database import engine

def _rows(result): return [dict(x._mapping) for x in result]
def _audit(conn, org_id, actor, action, entity_type, entity_id, old=None, new=None):
    conn.execute(text("""insert into audit_logs(org_id,actor_id,entity_type,entity_id,action,old_data,new_data)
      values(:o,:a,:t,:i,:x,cast(:old as jsonb),cast(:new as jsonb))"""),
      {"o":org_id,"a":actor,"t":entity_type,"i":str(entity_id),"x":action,"old":json.dumps(old or {},default=str),"new":json.dumps(new or {},default=str)})

def overview(org_id):
    with engine.connect() as c:
        org=c.execute(text("select * from organizations where id=:o"),{"o":org_id}).mappings().first()
        settings=c.execute(text("select * from organization_settings where org_id=:o"),{"o":org_id}).mappings().first()
        members=_rows(c.execute(text("""select m.*,coalesce(r.role_name,m.role_code) role_name
          ,coalesce((select array_agg(grant_row.location_id::text order by location.name)
             from organization_membership_offices grant_row
             join organization_locations location on location.id=grant_row.location_id
               and location.org_id=grant_row.org_id
             where grant_row.membership_id=m.id),'{}') office_ids
          from organization_memberships m left join organization_roles r on r.org_id=m.org_id and r.role_code=m.role_code
          where m.org_id=:o order by case m.status when 'ACTIVE' then 0 else 1 end,m.created_at"""),{"o":org_id}))
        invitations=_rows(c.execute(text("select * from organization_invitations where org_id=:o order by created_at desc"),{"o":org_id}))
        roles=_rows(c.execute(text("""select r.*,count(rp.permission_id)::int permission_count,count(m.id)::int member_count
          from organization_roles r left join role_permissions rp on rp.role_id=r.id
          left join organization_memberships m on m.org_id=r.org_id and m.role_code=r.role_code and m.status='ACTIVE'
          where r.org_id=:o group by r.id order by r.system_role desc,r.role_name"""),{"o":org_id}))
        permissions=_rows(c.execute(text("select id,permission_code,description from permissions order by permission_code")))
        workspaces=_rows(c.execute(text("select * from organization_workspaces where org_id=:o order by status,name"),{"o":org_id}))
        locations=_rows(c.execute(text("select * from organization_locations where org_id=:o order by status,name"),{"o":org_id}))
        integrations=_rows(c.execute(text("select * from organization_integrations where org_id=:o order by provider,account_label"),{"o":org_id}))
        numbering=_rows(c.execute(text("select * from document_numbering_settings where org_id=:o order by document_type"),{"o":org_id}))
        billing=c.execute(text("select * from organization_billing_profiles where org_id=:o"),{"o":org_id}).mappings().first()
        data_requests=_rows(c.execute(text("select * from organization_data_requests where org_id=:o order by created_at desc limit 50"),{"o":org_id}))
        api_keys=_rows(c.execute(text("select id::text,name,key_prefix,scopes,status,last_used_at,expires_at,created_at from developer_api_keys where org_id=:o order by created_at desc"),{"o":org_id}))
        return {"organization":dict(org) if org else None,"settings":dict(settings) if settings else None,"members":members,"invitations":invitations,"roles":roles,"permissions":permissions,"workspaces":workspaces,"locations":locations,"integrations":integrations,"numbering":numbering,"billing":dict(billing) if billing else None,"data_requests":data_requests,"api_keys":api_keys}

def update_org(org_id, actor, data, version):
    allowed={'organization_name','legal_name','country','city','address','phone','email','website','registration_number','tax_number','logo_url','organization_type','whatsapp','province','postal_code','registration_country','legal_address','logo_dark_url','primary_color','secondary_color','document_display_name','signature_url','stamp_url'}
    values={k:v for k,v in data.items() if k in allowed}; sets=[f"{k}=:{k}" for k in values]
    if not sets:return overview(org_id)['organization']
    with engine.begin() as c:
        old=c.execute(text("select * from organizations where id=:o"),{"o":org_id}).mappings().first()
        row=c.execute(text(f"update organizations set {','.join(sets)},name=coalesce(:display_name,name),row_version=row_version+1,updated_at=now() where id=:o and row_version=:v returning *"),{"o":org_id,"v":version,"display_name":values.get('organization_name'),**values}).mappings().first()
        if not row: return None
        _audit(c,org_id,actor,'ORGANIZATION_UPDATED','organization',org_id,dict(old),dict(row)); return dict(row)

def save_settings(org_id,actor,data,version):
    allowed={'timezone','currency_code','country_code','language_code','date_format','weight_unit','volume_unit','notification_email','settings','security','time_format','week_starts_on','dimension_unit','distance_unit','data_retention_days','privacy'}
    values={k:(json.dumps(v) if k in {'settings','security','privacy'} else v) for k,v in data.items() if k in allowed}
    with engine.begin() as c:
        c.execute(text("insert into organization_settings(org_id) values(:o) on conflict(org_id) do nothing"),{"o":org_id})
        sets=[f"{k}=cast(:{k} as jsonb)" if k in {'settings','security','privacy'} else f"{k}=:{k}" for k in values]
        row=c.execute(text(f"update organization_settings set {','.join(sets)},row_version=row_version+1,updated_at=now() where org_id=:o and row_version=:v returning *"),{"o":org_id,"v":version,**values}).mappings().first()
        if row:_audit(c,org_id,actor,'SETTINGS_UPDATED','organization_settings',org_id,new=data)
        return dict(row) if row else None

def update_member(org_id,member_id,actor,role_code,status,version):
    with engine.begin() as c:
        role=c.execute(text("select 1 from organization_roles where org_id=:o and role_code=:r"),{"o":org_id,"r":role_code}).first()
        if not role:return 'invalid_role'
        member=c.execute(text("select * from organization_memberships where id=:i and org_id=:o for update"),{"i":member_id,"o":org_id}).mappings().first()
        if not member:return 'missing'
        if member['role_code']=='OWNER' and (role_code!='OWNER' or status!='ACTIVE'):
            owners=c.execute(text("select count(*) from organization_memberships where org_id=:o and role_code='OWNER' and status='ACTIVE'"),{"o":org_id}).scalar_one()
            if owners<=1:return 'last_owner'
        row=c.execute(text("""update organization_memberships set role_code=:r,status=:s,suspended_at=case when :s='SUSPENDED' then now() else null end,row_version=row_version+1,updated_at=now()
          where id=:i and org_id=:o and row_version=:v returning *"""),{"r":role_code,"s":status,"i":member_id,"o":org_id,"v":version}).mappings().first()
        if not row:return 'conflict'
        _audit(c,org_id,actor,'MEMBER_UPDATED','membership',member_id,dict(member),dict(row));return dict(row)

def office_context(org_id,user_id,selected_office_id=None):
    with engine.connect() as c:
        membership=c.execute(text("""select id::text,role_code,office_access_scope
          from organization_memberships
          where org_id=:o and clerk_user_id=:u and status='ACTIVE'"""),
          {"o":org_id,"u":user_id}).mappings().first()
        if not membership:
            raise HTTPException(403,'organization_membership_required')
        locations=_rows(c.execute(text("""select location.id::text location_id,location.name,
              location.country,location.city,location.address,location.phone,
              location.opening_hours,location.status
            from organization_locations location
            where location.org_id=:o and location.location_type='OFFICE'
              and location.status='ACTIVE'
              and (:all_offices or exists(
                select 1 from organization_membership_offices grant_row
                where grant_row.org_id=:o and grant_row.membership_id=cast(:membership_id as uuid)
                  and grant_row.location_id=location.id
              ))
            order by location.country,location.city,location.name"""),{
                "o":org_id,"membership_id":membership["id"],
                "all_offices":membership["office_access_scope"]=="ALL_OFFICES" or membership["role_code"]=="OWNER",
            }))
        allowed_ids=[office["location_id"] for office in locations]
        if selected_office_id and selected_office_id not in allowed_ids:
            raise HTTPException(403,'office_access_denied')
        return {
            "org_id":org_id,
            "office_access_scope":"ALL_OFFICES" if membership["role_code"]=="OWNER" else membership["office_access_scope"],
            "offices":locations,
            "selected_office_id":selected_office_id,
            "allowed_office_ids":allowed_ids,
        }

def update_member_office_access(org_id,member_id,actor,scope,office_ids,version):
    if scope not in {'ALL_OFFICES','SELECTED_OFFICES'}:
        return 'invalid_office_access_scope'
    office_ids=list(dict.fromkeys(office_ids or []))
    with engine.begin() as c:
        member=c.execute(text("""select * from organization_memberships
          where id=:i and org_id=:o for update"""),{"i":member_id,"o":org_id}).mappings().first()
        if not member:return 'missing'
        if member['role_code']=='OWNER' and scope!='ALL_OFFICES':
            return 'owner_requires_all_offices'
        if scope=='SELECTED_OFFICES':
            valid_ids=c.execute(text("""select coalesce(array_agg(id::text order by id),'{}')
              from organization_locations where org_id=:o and status='ACTIVE'
                and location_type='OFFICE' and id=any(cast(:ids as uuid[]))"""),
              {"o":org_id,"ids":office_ids}).scalar_one()
            if not office_ids or len(valid_ids)!=len(office_ids):
                return 'invalid_office_assignment'
        updated=c.execute(text("""update organization_memberships
          set office_access_scope=:scope,row_version=row_version+1,updated_at=now()
          where id=:i and org_id=:o and row_version=:v returning *"""),
          {"scope":scope,"i":member_id,"o":org_id,"v":version}).mappings().first()
        if not updated:return 'conflict'
        c.execute(text("""delete from organization_membership_offices
          where org_id=:o and membership_id=:i"""),{"o":org_id,"i":member_id})
        if scope=='SELECTED_OFFICES':
            c.execute(text("""insert into organization_membership_offices(
              org_id,membership_id,location_id,granted_by)
              select :o,:i,location.id,:actor from organization_locations location
              where location.org_id=:o and location.id=any(cast(:ids as uuid[]))
                and location.location_type='OFFICE' and location.status='ACTIVE'"""),
              {"o":org_id,"i":member_id,"actor":actor,"ids":office_ids})
        result=dict(updated)
        result['office_access_scope']=scope
        result['office_ids']=office_ids if scope=='SELECTED_OFFICES' else []
        _audit(c,org_id,actor,'MEMBER_OFFICES_UPDATED','membership',member_id,dict(member),result)
        return result

def save_role(org_id,actor,data):
    with engine.begin() as c:
        role=c.execute(text("""insert into organization_roles(org_id,role_code,role_name,description,system_role)
          values(:o,:code,:name,:description,false) on conflict(org_id,role_code) do update set role_name=excluded.role_name,description=excluded.description returning *"""),{"o":org_id,**data}).mappings().one()
        c.execute(text("delete from role_permissions where role_id=:r"),{"r":role['id']})
        c.execute(text("""insert into role_permissions(role_id,permission_id) select :r,id from permissions where permission_code=any(:p) on conflict do nothing"""),{"r":role['id'],"p":data['permissions']})
        _audit(c,org_id,actor,'ROLE_SAVED','role',role['id'],new=data);return dict(role)

def revoke_invitation(org_id,invitation_id,actor):
    with engine.begin() as c:
        row=c.execute(text("update organization_invitations set status='REVOKED',revoked_at=now() where id=:i and org_id=:o and status='PENDING' returning *"),{"i":invitation_id,"o":org_id}).mappings().first()
        if row:_audit(c,org_id,actor,'INVITATION_REVOKED','invitation',invitation_id,new=dict(row))
        return dict(row) if row else None

def save_workspace(org_id,actor,data):
    with engine.begin() as c:
        row=c.execute(text("""insert into organization_workspaces(org_id,name,code,country_code,currency_code,timezone,language_code,status,created_by)
          values(:o,:name,upper(:code),:country_code,:currency_code,:timezone,:language_code,'ACTIVE',:a)
          on conflict(org_id,code) do update set name=excluded.name,country_code=excluded.country_code,currency_code=excluded.currency_code,timezone=excluded.timezone,language_code=excluded.language_code,row_version=organization_workspaces.row_version+1,updated_at=now() returning *"""),{"o":org_id,"a":actor,**data}).mappings().one()
        _audit(c,org_id,actor,'WORKSPACE_SAVED','workspace',row['id'],new=dict(row));return dict(row)
def archive_workspace(org_id,actor,item_id,version):
    with engine.begin() as c:
        row=c.execute(text("update organization_workspaces set status='ARCHIVED',row_version=row_version+1,updated_at=now() where org_id=:o and id=:id and row_version=:v returning *"),{"o":org_id,"id":item_id,"v":version}).mappings().first()
        if row:_audit(c,org_id,actor,'WORKSPACE_ARCHIVED','workspace',item_id,new=dict(row))
        return dict(row) if row else None
def save_location(org_id,actor,data):
    data=dict(data)
    data['code']=data.get('code') or f"OFF-{uuid4().hex[:12].upper()}"
    data['opening_hours']=json.dumps(data.get('opening_hours') or {})
    for field in ('name','country','city'):
        if data.get(field):
            data[field]=data[field].strip()
    try:
        with engine.begin() as c:
            conflict_action="""do update set workspace_id=excluded.workspace_id,name=excluded.name,
              location_type=excluded.location_type,country=excluded.country,city=excluded.city,
              address=excluded.address,phone=excluded.phone,whatsapp=excluded.whatsapp,
              email=excluded.email,manager_name=excluded.manager_name,
              opening_hours=excluded.opening_hours,timezone=excluded.timezone,
              services=excluded.services,row_version=organization_locations.row_version+1,
              updated_at=now()"""
            if data.get('location_type')=='OFFICE':
                existing_code=c.execute(text("""select 1 from organization_locations
                  where org_id=:o and code=upper(:code) limit 1"""),
                  {"o":org_id,"code":data['code']}).first()
                if existing_code:
                    raise HTTPException(409,'office_code_already_exists')
                duplicate=c.execute(text("""select id from organization_locations
                  where org_id=:o and location_type='OFFICE' and status='ACTIVE'
                    and lower(btrim(name))=lower(:name) and lower(btrim(country))=lower(:country)
                    and lower(btrim(city))=lower(:city)
                    and code<>upper(:code)
                  limit 1"""),{"o":org_id,"name":data['name'].strip(),"country":data['country'].strip(),
                    "city":data['city'].strip(),"code":data['code']}).first()
                if duplicate:
                    raise HTTPException(409,'office_already_exists')
                conflict_action="do nothing"
            statement=f"""insert into organization_locations(org_id,workspace_id,name,code,location_type,country,city,address,phone,whatsapp,email,manager_name,opening_hours,timezone,services,status)
              values(:o,cast(:workspace_id as uuid),:name,upper(:code),:location_type,:country,:city,:address,:phone,:whatsapp,:email,:manager_name,cast(:opening_hours as jsonb),:timezone,:services,'ACTIVE')
              on conflict(org_id,code) {conflict_action} returning *"""
            row=c.execute(text(statement),{"o":org_id,"opening_hours":data.pop('opening_hours', '{}'),**data}).mappings().first()
            if not row:
                raise HTTPException(409,'office_code_already_exists')
            if data.get('location_type')=='OFFICE':
                row=c.execute(text("""select * from organization_locations
                  where org_id=:o and id=:id"""),{"o":org_id,"id":row['id']}).mappings().one()
            _audit(c,org_id,actor,'LOCATION_SAVED','location',row['id'],new=dict(row));return dict(row)
    except IntegrityError as error:
        constraint=getattr(getattr(error.orig,'diag',None),'constraint_name',None)
        if constraint=='uq_active_office_name_city_country':
            raise HTTPException(409,'office_already_exists') from error
        raise
def set_location_status(org_id,actor,item_id,status,version):
    with engine.begin() as c:
        if status=='ACTIVE':
            conflict=c.execute(text("""select 1 from organization_locations current
              join organization_locations candidate on candidate.org_id=current.org_id
                and candidate.location_type='OFFICE' and candidate.status='ACTIVE'
                and lower(btrim(candidate.name))=lower(btrim(current.name))
                and lower(btrim(candidate.country))=lower(btrim(current.country))
                and lower(btrim(candidate.city))=lower(btrim(current.city))
              where current.org_id=:o and current.id=cast(:id as uuid)
                and current.location_type='OFFICE' and candidate.id<>current.id
              limit 1"""),{"o":org_id,"id":item_id}).first()
            if conflict:
                raise HTTPException(409,'office_already_exists')
        row=c.execute(text("""update organization_locations
          set status=:status,row_version=row_version+1,updated_at=now()
          where org_id=:o and id=cast(:id as uuid) and row_version=:version
          returning *"""),{"o":org_id,"id":item_id,"version":version,"status":status}).mappings().first()
        if row:
            _audit(c,org_id,actor,'LOCATION_STATUS_UPDATED','location',item_id,new=dict(row))
        return dict(row) if row else None
def save_integration(org_id,actor,data):
    with engine.begin() as c:
        row=c.execute(text("""insert into organization_integrations(org_id,provider,account_label,status,granted_permissions,configuration,connected_at,updated_by)
          values(:o,upper(:provider),:account_label,:status,:granted_permissions,cast(:configuration as jsonb),case when :status='CONNECTED' then now() end,:a)
          on conflict(org_id,provider,account_label) do update set status=excluded.status,granted_permissions=excluded.granted_permissions,configuration=excluded.configuration,connected_at=case when excluded.status='CONNECTED' then coalesce(organization_integrations.connected_at,now()) end,updated_by=:a,updated_at=now() returning *"""),{"o":org_id,"a":actor,"configuration":json.dumps(data.pop('configuration',{})),**data}).mappings().one()
        _audit(c,org_id,actor,'INTEGRATION_SAVED','integration',row['id'],new={"provider":row['provider'],"status":row['status']});return dict(row)
def save_numbering(org_id,actor,document_type,prefix_format,version):
    with engine.begin() as c:
        row=c.execute(text("update document_numbering_settings set prefix_format=:f,row_version=row_version+1,updated_at=now() where org_id=:o and document_type=:t and row_version=:v returning *"),{"o":org_id,"t":document_type,"f":prefix_format,"v":version}).mappings().first()
        if row:_audit(c,org_id,actor,'NUMBERING_UPDATED','document_numbering',row['id'],new=dict(row))
        return dict(row) if row else None
def request_data_operation(org_id,actor,request_type,scope):
    with engine.begin() as c:
        row=c.execute(text("insert into organization_data_requests(org_id,request_type,scope,requested_by) values(:o,:t,cast(:s as jsonb),:a) returning *"),{"o":org_id,"t":request_type,"s":json.dumps(scope),"a":actor}).mappings().one();_audit(c,org_id,actor,'DATA_REQUESTED','data_request',row['id'],new=dict(row));return dict(row)
def create_api_key(org_id,actor,name,scopes,expires_at=None):
    raw='slv_live_'+secrets.token_urlsafe(32);prefix=raw[:16];digest=hashlib.sha256(raw.encode()).hexdigest()
    with engine.begin() as c:
        row=c.execute(text("insert into developer_api_keys(org_id,name,key_prefix,key_hash,scopes,expires_at,created_by) values(:o,:n,:p,:h,:s,:e,:a) returning id::text,name,key_prefix,scopes,status,expires_at,created_at"),{"o":org_id,"n":name,"p":prefix,"h":digest,"s":scopes,"e":expires_at,"a":actor}).mappings().one();_audit(c,org_id,actor,'API_KEY_CREATED','api_key',row['id'],new={"name":name,"scopes":scopes});out=dict(row);out['secret']=raw;return out
def revoke_api_key(org_id,actor,item_id):
    with engine.begin() as c:
        row=c.execute(text("update developer_api_keys set status='REVOKED',revoked_at=now() where org_id=:o and id=:id and status='ACTIVE' returning id::text,name,key_prefix,status"),{"o":org_id,"id":item_id}).mappings().first()
        if row:_audit(c,org_id,actor,'API_KEY_REVOKED','api_key',item_id,new=dict(row))
        return dict(row) if row else None
