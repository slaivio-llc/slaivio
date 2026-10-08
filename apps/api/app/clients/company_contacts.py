from sqlalchemy import text
from fastapi import HTTPException

from app.db.database import engine
from app.clients.phone import normalize_contact_phone
from app.clients.repository import normalize_email, _audit_client
from app.clients.schema_checks import require_table


def list_contacts(org_id: str, client_id: str):
    with engine.connect() as conn:
        require_table(conn, 'client_company_contacts')
        exists = conn.execute(text('''select 1 from clients where org_id=:org and id=cast(:client as uuid)
            and customer_type='business' and deleted_at is null'''), {'org': org_id, 'client': client_id}).scalar()
        if not exists:
            raise HTTPException(404, 'company_not_found')
        return [dict(row) for row in conn.execute(text('''
            select id::text,name,role_label,phone,email,is_primary,row_version
            from client_company_contacts where org_id=:org and client_id=cast(:client as uuid)
              and archived_at is null order by is_primary desc,name,id
        '''), {'org': org_id, 'client': client_id}).mappings()]


def save_contact(org_id: str, client_id: str, actor: str, payload: dict):
    params = {'org': org_id, 'client': client_id, **payload}
    if not payload.get('archive'):
        params['name'] = payload['name'].strip()
        if not params['name']:
            raise HTTPException(422, 'contact_name_required')
        try:
            params['phone'] = normalize_contact_phone(payload.get('phone'), payload.get('phone_region'))
            params['email'] = normalize_email(payload.get('email'))
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    with engine.begin() as conn:
        require_table(conn, 'client_company_contacts')
        # Serialize all primary changes within a company, including first contact creation.
        company = conn.execute(text('''select id from clients where org_id=:org and id=cast(:client as uuid)
            and customer_type='business' and deleted_at is null for update'''), params).first()
        if not company:
            raise HTTPException(404, 'company_not_found')
        if payload.get('id'):
            version = conn.execute(text('''select row_version from client_company_contacts
                where org_id=:org and client_id=cast(:client as uuid) and id=cast(:id as uuid)
                  and archived_at is null for update'''), params).scalar()
            if version is None:
                raise HTTPException(404, 'contact_not_found')
            if version != payload.get('row_version'):
                raise HTTPException(409, 'stale_contact_version')
        if payload.get('archive'):
            if not payload.get('id'):
                raise HTTPException(422, 'contact_id_required')
            conn.execute(text('''update client_company_contacts set archived_at=now(),is_primary=false,
                row_version=row_version+1,updated_at=now() where org_id=:org
                and client_id=cast(:client as uuid) and id=cast(:id as uuid)'''), params)
        else:
            if payload.get('is_primary'):
                conn.execute(text('''update client_company_contacts set is_primary=false,
                    row_version=row_version+1,updated_at=now()
                    where org_id=:org and client_id=cast(:client as uuid) and archived_at is null and is_primary'''), params)
            if payload.get('id'):
                conn.execute(text('''update client_company_contacts set name=:name,role_label=:role_label,
                    phone=:phone,email=:email,is_primary=:is_primary,row_version=row_version+1,updated_at=now()
                    where org_id=:org and client_id=cast(:client as uuid) and id=cast(:id as uuid)'''), params)
            else:
                conn.execute(text('''insert into client_company_contacts(org_id,client_id,name,role_label,phone,email,is_primary)
                    values(:org,cast(:client as uuid),:name,:role_label,:phone,:email,:is_primary)'''), params)
        _audit_client(conn, org_id=org_id, user_id=actor, client_id=client_id,
                      action='client.updated', changed_fields=['company_contacts'])
    return {'status': 'ok'}
