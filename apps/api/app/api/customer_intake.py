from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from app.core.permissions import require_permission
from app.core.tenant_context import get_current_tenant
from app.db.database import engine
from app.services import customer_intake as service

router = APIRouter(tags=['customer-intake'])
PRIVATE_HEADERS = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
                   'X-Robots-Tag': 'noindex, nofollow'}


def capability(response: Response, authorization: str = Header(default='')):
    response.headers.update(PRIVATE_HEADERS)
    if not authorization.startswith('Bearer '):
        raise HTTPException(404, 'intake_link_unavailable', headers=PRIVATE_HEADERS)
    return authorization[7:]


class IntakeForm(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)
    full_name: str = Field(min_length=2, max_length=160)
    country: str = Field(pattern=r'^[A-Z]{2}$')
    city: str = Field(min_length=1, max_length=120)
    contact_phone: str | None = Field(default=None, max_length=40)
    offering_id: UUID
    package_count: int = Field(strict=True, ge=1, le=10000)
    estimated_weight_kg: float | None = Field(default=None, strict=True, gt=0, le=1000000)
    delivery_method: Literal['SELF', 'SUPPLIER'] = 'SELF'
    language: Literal['FR', 'EN'] = 'FR'
    consent: Literal[True]

    @field_validator('country')
    @classmethod
    def known_country(cls, value):
        import phonenumbers
        if value not in phonenumbers.SUPPORTED_REGIONS:
            raise ValueError('invalid_country')
        return value


@router.get('/public/customer-intake')
def public_get(token=Depends(capability)):
    return service.public_form(token)


@router.post('/public/customer-intake')
def public_submit(body: IntakeForm, token=Depends(capability)):
    try:
        return service.submit_form(token, body.model_dump())
    except ValueError as exc:
        if str(exc) != 'duplicate_client':
            raise
        raise HTTPException(409, 'intake_identity_review', headers=PRIVATE_HEADERS) from exc


class Enable(BaseModel):
    enabled: bool


@router.get('/organization/customer-intake/settings', dependencies=[Depends(require_permission('inbox.ai.manage'))])
def get_settings(tenant=Depends(get_current_tenant)):
    with engine.connect() as conn:
        enabled = conn.execute(text('select customer_intake_enabled from ai_settings where org_id=:o'), {'o': tenant['org_id']}).scalar()
        return {'enabled': bool(enabled), 'published_offerings': len(service.catalog(conn, tenant['org_id']))}


@router.patch('/organization/customer-intake/settings', dependencies=[Depends(require_permission('inbox.ai.manage'))])
def set_settings(body: Enable, tenant=Depends(get_current_tenant)):
    with engine.begin() as conn:
        if body.enabled and not service.catalog(conn, tenant['org_id']):
            raise HTTPException(409, 'Publiez au moins un service et une route compatibles avant d’activer le formulaire.')
        conn.execute(text("""insert into ai_settings(org_id,customer_intake_enabled) values(:o,:enabled)
          on conflict(org_id) do update set customer_intake_enabled=:enabled,pilot_updated_by=:actor,updated_at=now()"""),
          {'o': tenant['org_id'], 'enabled': body.enabled, 'actor': tenant.get('user_id')})
    return {'enabled': body.enabled}


class Issue(BaseModel):
    source_message_id: UUID


@router.post('/organization/customer-intake/links', dependencies=[Depends(require_permission('inbox.ai.manage'))])
def issue(body: Issue, tenant=Depends(get_current_tenant)):
    with engine.connect() as conn:
        phone = conn.execute(text("""select from_phone from messages where org_id=:o and id=:id
          and direction='inbound'"""), {'o': tenant['org_id'], 'id': body.source_message_id}).scalar()
    link = service.issue_link(tenant['org_id'], phone, body.source_message_id) if phone else None
    if not link:
        raise HTTPException(409, 'Le lien ne peut pas être créé. Vérifiez les services publiés et l’activation du formulaire, ou réessayez plus tard.')
    with engine.connect() as conn:
        link_id = conn.execute(text('select id from customer_intake_links where org_id=:o and token_hash=:h'),
                               {'o': tenant['org_id'], 'h': service.token_hash(link.rsplit('#', 1)[1])}).scalar_one()
    return {'url': link, 'link_id': link_id, 'expires_in_hours': 72}


@router.get('/organization/customer-intake/requests', dependencies=[Depends(require_permission('settings.write'))])
def requests(tenant=Depends(get_current_tenant)):
    # Agency administrators only. No new cross-office client directory for operational roles.
    with engine.connect() as conn:
        return {'items': [dict(r) for r in conn.execute(text("""select q.id,q.reference,q.client_id,q.declared_profile,
          q.receipt,q.created_at,e.status from customer_intake_requests q
          join package_expectations e on e.org_id=q.org_id and e.id=q.expectation_id
          where q.org_id=:o order by q.created_at desc limit 50"""), {'o': tenant['org_id']}).mappings()]}


@router.post('/organization/customer-intake/links/{link_id}/revoke', dependencies=[Depends(require_permission('inbox.ai.manage'))])
def revoke(link_id: UUID, tenant=Depends(get_current_tenant)):
    with engine.begin() as conn:
        conn.execute(text('update customer_intake_links set revoked_at=now() where org_id=:o and id=:id'),
                     {'o': tenant['org_id'], 'id': link_id})
    return {'revoked': True}


class Dropoff(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    enabled: bool
    recipient: str = Field(default='', max_length=160)
    phone: str = Field(default='', max_length=80)
    instructions: str = Field(default='', max_length=2000)
    expected_version: int = Field(ge=1)


@router.get('/warehouses/{warehouse_id}/customer-dropoff', dependencies=[Depends(require_permission('warehouses.read'))])
def dropoff_get(warehouse_id: UUID, tenant=Depends(get_current_tenant)):
    with engine.connect() as conn:
        row = conn.execute(text("""select warehouse_name,address,country_code,city,row_version,
          customer_dropoff_enabled enabled,coalesce(customer_dropoff_recipient,'') recipient,
          coalesce(customer_dropoff_phone,'') phone,coalesce(customer_dropoff_instructions,'') instructions
          from warehouses where org_id=:o and id=:id and archived_at is null"""), {'o': tenant['org_id'], 'id': warehouse_id}).mappings().first()
        if not row:
            raise HTTPException(404, 'Entrepôt introuvable.')
        return dict(row)


@router.patch('/warehouses/{warehouse_id}/customer-dropoff', dependencies=[Depends(require_permission('warehouses.update'))])
def dropoff_save(warehouse_id: UUID, body: Dropoff, tenant=Depends(get_current_tenant)):
    with engine.begin() as conn:
        row = conn.execute(text("""select address,active,row_version from warehouses where org_id=:o
          and id=:id and archived_at is null for update"""), {'o': tenant['org_id'], 'id': warehouse_id}).mappings().first()
        if not row:
            raise HTTPException(404, 'Entrepôt introuvable.')
        if row['row_version'] != body.expected_version:
            raise HTTPException(409, 'Cet entrepôt a été modifié. Rechargez sa fiche avant de réessayer.')
        if body.enabled and (not row['active'] or not (row['address'] or '').strip() or not body.recipient):
            raise HTTPException(422, 'Renseignez l’adresse de l’entrepôt et le destinataire avant de publier le dépôt.')
        conn.execute(text("""update warehouses set customer_dropoff_enabled=:enabled,
          customer_dropoff_recipient=:recipient,customer_dropoff_phone=:phone,
          customer_dropoff_instructions=:instructions,row_version=row_version+1,updated_at=now()
          where org_id=:o and id=:id"""), {'o': tenant['org_id'], 'id': warehouse_id, **body.model_dump(exclude={'expected_version'})})
        from app.warehouses.repository import _audit
        _audit(conn, tenant['org_id'], warehouse_id, 'warehouse', warehouse_id,
               'UPDATED', tenant.get('user_id') or 'agency', {'customer_dropoff': body.model_dump(exclude={'expected_version'})})
    return {'saved': True}
