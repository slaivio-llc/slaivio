"""WhatsApp capability links. Never accept a tenant or trusted sender from the form."""
import hashlib
import json
import re
import secrets
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text

from app.clients.phone import normalize_contact_phone
from app.clients.repository import create_client
from app.core.config import settings
from app.db.database import engine


CATALOG_SQL = """
 select f.id, s.service_name, r.route_name, r.origin_country, r.origin_city,
 r.destination_country, r.destination_city, s.shipping_mode,
 case when w.customer_dropoff_enabled and w.active and w.archived_at is null
   and nullif(trim(w.address),'') is not null
   and nullif(trim(w.customer_dropoff_recipient),'') is not null
 then jsonb_build_object('warehouse_id',w.id,'recipient',w.customer_dropoff_recipient,
   'address',w.address,'country',w.country_code,'city',w.city,
   'phone',w.customer_dropoff_phone,'instructions',w.customer_dropoff_instructions) end dropoff
 from service_route_offerings f
 join shipping_services s on s.id=f.service_id and s.org_id=f.org_id
 join shipping_routes r on r.id=f.route_id and r.org_id=f.org_id
 left join warehouses w on w.id=f.origin_warehouse_id and w.org_id=f.org_id
 where f.org_id=:o and f.public_visible
 and f.availability in ('AVAILABLE','LIMITED','QUOTE_ONLY')
 and f.effective_from<=now() and (f.effective_until is null or f.effective_until>now())
 and s.active and s.public_visible and s.archived_at is null and s.status in ('ACTIVE','LIMITED')
 and s.availability in ('AVAILABLE','LIMITED','QUOTE_ONLY')
 and (s.seasonal_from is null or s.seasonal_from<=current_date)
 and (s.seasonal_until is null or s.seasonal_until>=current_date)
 and r.active and r.public_visible and r.archived_at is null and r.status in ('ACTIVE','LIMITED')
 order by s.service_name,r.route_name,f.id
"""


def catalog(conn, org_id, *, lock=False):
    return [dict(r) for r in conn.execute(text(CATALOG_SQL + (' for share of f,s,r' if lock else '')), {'o': org_id}).mappings()]


def token_hash(token):
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token or ''):
        raise HTTPException(404, 'intake_link_unavailable')
    return hashlib.sha256(token.encode()).hexdigest()


def _link(conn, token, *, lock=False):
    row = conn.execute(text("""select l.*,o.name agency_name from customer_intake_links l
      join organizations o on o.id=l.org_id and o.status='ACTIVE'
      join ai_settings a on a.org_id=l.org_id and a.customer_intake_enabled
      where l.token_hash=:h and l.revoked_at is null and l.expires_at>now()
    """ + (' for update of l' if lock else '')), {'h': token_hash(token)}).mappings().first()
    if not row:
        raise HTTPException(404, 'intake_link_unavailable')
    return dict(row)


def issue_link(org_id, phone, source_message_id):
    try:
        phone = normalize_contact_phone(phone)
    except ValueError:
        return None
    if not phone or not source_message_id:
        return None
    with engine.begin() as conn:
        conn.execute(text('select pg_advisory_xact_lock(hashtextextended(:key,0))'),
                     {'key': f'intake:{org_id}:{phone}'})
        if not conn.execute(text("""select 1 from ai_settings a join organizations o on o.id=a.org_id
          where a.org_id=:o and a.customer_intake_enabled and o.status='ACTIVE'"""), {'o': org_id}).first():
            return None
        # Only issue for a real incoming message; the browser cannot impersonate a customer.
        if not conn.execute(text("""select 1 from messages where org_id=:o and id=:id
          and direction='inbound' and from_phone=:phone and not coalesce(is_group,false)
          and upper(coalesce(source_channel,''))='WHATSAPP'"""),
                            {'o': org_id, 'id': source_message_id, 'phone': phone}).first():
            return None
        if not catalog(conn, org_id):
            return None
        count = conn.execute(text("""select count(*) from customer_intake_links where org_id=:o
          and source_phone=:phone and created_at>now()-interval '1 hour'"""), {'o': org_id, 'phone': phone}).scalar()
        if count >= 6:
            return None
        token = secrets.token_urlsafe(32)
        conn.execute(text("""insert into customer_intake_links(org_id,source_phone,source_message_id,token_hash)
          values(:o,:phone,:id,:h)"""), {'o': org_id, 'phone': phone, 'id': source_message_id, 'h': token_hash(token)})
    # Fragments never reach access logs or Referrer headers.
    return settings.public_web_base_url.rstrip('/') + '/prepare-shipment#' + token


def _receipt(conn, org_id, request_id):
    row = conn.execute(text('select receipt,offering_id from customer_intake_requests where org_id=:o and id=:id'),
                       {'o': org_id, 'id': request_id}).mappings().one()
    receipt = dict(row['receipt'])
    if receipt.get('dropoff'):
        current = next((o for o in catalog(conn, org_id) if str(o['id']) == str(row['offering_id'])), None)
        # Do not keep instructing a supplier to use a withdrawn/changed address.
        # The immutable original remains available to authorized agency staff.
        if not current or current['dropoff'] != receipt['dropoff']:
            receipt['dropoff'] = None
            receipt['dropoff_withdrawn'] = True
    return receipt


def public_form(token):
    with engine.connect() as conn:
        link = _link(conn, token)
        return {'agency_name': link['agency_name'], 'phone': link['source_phone'],
                'offerings': catalog(conn, link['org_id']) if not link['request_id'] else [],
                'receipt': _receipt(conn, link['org_id'], link['request_id']) if link['request_id'] else None}


def submit_form(token, data):
    with engine.begin() as conn:
        link = _link(conn, token, lock=True)
        org_id, phone = link['org_id'], link['source_phone']
        conn.execute(text('select pg_advisory_xact_lock(hashtextextended(:key,0))'),
                     {'key': f'intake:{org_id}:{phone}'})
        if link['request_id']:
            return _receipt(conn, org_id, link['request_id'])
        # Two separately issued links for the same conversation must not create two expectations.
        prior = conn.execute(text("""select q.id from customer_intake_requests q
          join package_expectations e on e.id=q.expectation_id and e.org_id=q.org_id
          where q.org_id=:o and q.source_phone=:phone and e.status='EXPECTED'
          order by q.created_at desc limit 1"""), {'o': org_id, 'phone': phone}).scalar()
        if prior:
            conn.execute(text('update customer_intake_links set request_id=:r where id=:id'), {'r': prior, 'id': link['id']})
            return _receipt(conn, org_id, prior)
        offering = next((r for r in catalog(conn, org_id, lock=True) if str(r['id']) == str(data['offering_id'])), None)
        if not offering:
            raise HTTPException(409, 'intake_service_unavailable')
        dropoff = offering['dropoff'] if data['delivery_method'] == 'SUPPLIER' else None
        if data['delivery_method'] == 'SUPPLIER' and not dropoff:
            raise HTTPException(409, 'intake_dropoff_unavailable')
        if dropoff:
            # Recheck the explicitly published address while holding its row lock.
            depot = conn.execute(text("""select customer_dropoff_recipient recipient,address,country_code country,city,
              customer_dropoff_phone phone,customer_dropoff_instructions instructions,id warehouse_id
              from warehouses where org_id=:o and id=:id and active and archived_at is null
              and customer_dropoff_enabled and nullif(trim(address),'') is not null
              and nullif(trim(customer_dropoff_recipient),'') is not null for share"""),
              {'o': org_id, 'id': dropoff['warehouse_id']}).mappings().first()
            if not depot:
                raise HTTPException(409, 'intake_dropoff_unavailable')
            dropoff = {key: str(value) if key=='warehouse_id' else value for key,value in depot.items()}
        # This is a declaration, not verified ownership of the edited contact number.
        try:
            contact = normalize_contact_phone(data.get('contact_phone'))
        except ValueError as exc:
            raise HTTPException(422, 'intake_contact_invalid') from exc
        profile = {**data, 'offering_id': str(data['offering_id']), 'contact_phone': contact}
        matches = list(conn.execute(text("""select id from clients where org_id=:o and deleted_at is null
          and (normalized_phone=:phone or phone=:phone or whatsapp_phone=:phone) limit 2 for update"""),
                                    {'o': org_id, 'phone': phone}).scalars())
        if len(matches) > 1:
            raise HTTPException(409, 'intake_identity_review')
        if matches:
            client_id = matches[0]  # Never overwrite an existing customer's CRM profile.
        else:
            client = create_client(org_id, 'whatsapp-intake', {
                'name': data['full_name'], 'phone': phone, 'whatsapp_phone': phone,
                'country': data['country'], 'city': data['city'], 'source': 'whatsapp',
                'customer_type': 'individual', 'preferred_language': data['language'], 'lifecycle_status': 'pending',
            }, connection=conn)
            client_id = client['id']
        request_id = uuid4()
        reference = 'PRE-' + request_id.hex[:12].upper()
        mark = reference
        journey_id = conn.execute(text("""select j.id from parcel_customer_journeys j
          where j.org_id=:o and j.conversation_phone=:phone and j.stage<>'CONVERTED'
          and not exists(select 1 from package_expectations e where e.org_id=j.org_id and e.journey_id=j.id)
          for update of j"""), {'o': org_id, 'phone': phone}).scalar()
        description = (f"{reference} · {data['full_name']} · {offering['service_name']} · {offering['route_name']}"
                       f" · {data['package_count']} colis annoncés · "
                       + (f"{data['estimated_weight_kg']} kg estimés" if data['estimated_weight_kg'] is not None else 'poids à confirmer'))
        expectation_id = conn.execute(text("""insert into package_expectations
          (org_id,client_id,supplier_tracking,shipping_mark,description,expected_warehouse_id,journey_id,created_by)
          values(:o,:client,:reference,:mark,:description,:warehouse,:journey,'whatsapp-intake') returning id"""),
          {'o': org_id, 'client': client_id, 'reference': reference, 'mark': mark,
           'description': description, 'warehouse': dropoff['warehouse_id'] if dropoff else None, 'journey': journey_id}).scalar_one()
        if journey_id:
            # The existing conversion trigger sees this same journey expectation
            # and does nothing: do not create a second automatic expectation.
            conn.execute(text("""update parcel_customer_journeys set stage='CONVERTED',client_id=:client,
              full_name=:name,country=:country,city=:city,customer_type='individual',missing_fields='{}',
              converted_at=now(),followup_status='CANCELLED',next_followup_at=null,updated_at=now()
              where org_id=:o and id=:id"""), {'o': org_id, 'id': journey_id, 'client': client_id,
                'name': data['full_name'], 'country': data['country'], 'city': data['city']})
        conn.execute(text("""update followup_tasks set status='CANCELLED',cancelled_at=now(),updated_at=now()
          where org_id=:o and conversation_phone=:phone and followup_type='PARCEL_PROSPECT'
          and status in ('SCHEDULED','DUE','PENDING','WAITING_RESPONSE')"""), {'o': org_id, 'phone': phone})
        receipt = {'reference': reference, 'shipping_mark': mark, 'agency_name': link['agency_name'],
                   'full_name': data['full_name'], 'service_name': offering['service_name'],
                   'route_name': offering['route_name'], 'dropoff': dropoff,
                   'package_count': data['package_count'], 'estimated_weight_kg': data['estimated_weight_kg']}
        conn.execute(text("""insert into customer_intake_requests(id,org_id,reference,source_phone,client_id,
          expectation_id,offering_id,declared_profile,receipt) values(:id,:o,:reference,:phone,:client,:expectation,
          :offering,cast(:profile as jsonb),cast(:receipt as jsonb))"""),
          {'id': request_id, 'o': org_id, 'reference': reference, 'phone': phone, 'client': client_id,
           'expectation': expectation_id, 'offering': data['offering_id'],
           'profile': json.dumps(profile, default=str), 'receipt': json.dumps(receipt, default=str)})
        conn.execute(text('update customer_intake_links set request_id=:r where id=:id'), {'r': request_id, 'id': link['id']})
        conn.execute(text("""update conversation_assignments set client_id=:client
          where org_id=:o and client_phone=:phone and client_id is null"""), {'client': client_id, 'o': org_id, 'phone': phone})
        return receipt
