import json
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.customer_intake import IntakeForm
from app.services import customer_intake as service
from app.ai.services import pilot_inbox_ai_service as ai


ORG = 'agency-a'
PHONE = '+33612345678'
TOKEN = 'a' * 43
OFFER = str(uuid4())
DEPOT = {'warehouse_id': str(uuid4()), 'address': '广州市白云区仓库 9号', 'recipient': '王先生',
         'phone': '+86 123', 'country': 'CN', 'city': '广州', 'instructions': '每箱写唛头'}


def form(**changes):
    return IntakeForm(**{**dict(full_name='Alice Client', country='CD', city='Kinshasa', contact_phone=PHONE,
                               offering_id=OFFER, package_count=2, estimated_weight_kg=None,
                               delivery_method='SUPPLIER', language='FR', consent=True), **changes}).model_dump()


class Result:
    def __init__(self, value=None):
        self.value = value

    def mappings(self): return self
    def scalars(self): return iter(self.value or [])
    def first(self): return self.value
    def scalar(self): return self.value
    def scalar_one(self): return self.value
    def one(self): return self.value


class Connection:
    def __init__(self, matches=None, prior=None, journey=None, dropoff=DEPOT):
        self.calls = []
        self.matches = matches or []
        self.prior = prior
        self.journey = journey
        self.dropoff = dropoff

    def execute(self, statement, params=None):
        sql = str(statement)
        self.calls.append((sql, params or {}))
        if 'select id from clients' in sql: return Result(self.matches)
        if 'select q.id' in sql: return Result(self.prior)
        if 'select j.id' in sql: return Result(self.journey)
        if 'select customer_dropoff_recipient' in sql: return Result(self.dropoff)
        if 'insert into package_expectations' in sql: return Result(uuid4())
        return Result()


@pytest.fixture
def setup(monkeypatch):
    def build(**kwargs):
        conn = Connection(**kwargs)
        monkeypatch.setattr(service, 'engine', SimpleNamespace(begin=lambda: nullcontext(conn), connect=lambda: nullcontext(conn)))
        monkeypatch.setattr(service, '_link', lambda c, t, **kw: dict(org_id=ORG, source_phone=PHONE, id=uuid4(), request_id=None, agency_name='Cargo test'))
        monkeypatch.setattr(service, 'catalog', lambda *args, **kw: [dict(id=OFFER, service_name='Fret Chine', route_name='Guangzhou → Kinshasa', dropoff=DEPOT)])
        created = []
        def create(org, actor, payload, *, connection):
            created.append((org, actor, payload, connection))
            return {'id': uuid4()}
        monkeypatch.setattr(service, 'create_client', create)
        return conn, created
    return build


def test_supplier_submission_preserves_chinese_address_and_creates_only_expectation(setup):
    conn, created = setup(journey=uuid4())
    receipt = service.submit_form(TOKEN, form())
    assert receipt['dropoff'] == DEPOT
    assert receipt['estimated_weight_kg'] is None
    assert receipt['shipping_mark'].startswith('PRE-')
    assert created[0][2]['lifecycle_status'] == 'pending'
    assert created[0][3] is conn
    sql = '\n'.join(q for q, _ in conn.calls)
    assert sql.count('insert into package_expectations') == 1
    assert 'insert into cargo_packages' not in sql
    assert 'insert into finance_documents' not in sql
    expectation = next(p for q,p in conn.calls if 'insert into package_expectations' in q)
    assert expectation['journey'] is not None
    assert expectation['warehouse'] == DEPOT['warehouse_id']
    assert sql.index('insert into package_expectations') < sql.index('update parcel_customer_journeys')
    assert "followup_type='PARCEL_PROSPECT'" in sql


def test_edited_or_removed_contact_never_replaces_trusted_sender(setup):
    for contact in ('+442079460018', None):
        conn, created = setup()
        service.submit_form(TOKEN, form(contact_phone=contact))
        assert created[0][2]['phone'] == PHONE
        assert created[0][2]['whatsapp_phone'] == PHONE
        matching = next(p for q,p in conn.calls if 'select id from clients' in q)
        assert matching['phone'] == PHONE
        request = next(p for q,p in conn.calls if 'insert into customer_intake_requests' in q)
        assert json.loads(request['profile'])['contact_phone'] == contact


def test_existing_client_is_reused_without_profile_overwrite(setup):
    client = uuid4()
    conn, created = setup(matches=[client])
    service.submit_form(TOKEN, form())
    assert not created
    request = next(p for q,p in conn.calls if 'insert into customer_intake_requests' in q)
    assert request['client'] == client
    assert not any('update clients' in q for q,p in conn.calls)


def test_ambiguous_identity_goes_to_agency(setup):
    conn, created = setup(matches=[uuid4(), uuid4()])
    with pytest.raises(HTTPException, match='intake_identity_review'):
        service.submit_form(TOKEN, form())
    assert not created
    assert not any('insert into package_expectations' in q for q,p in conn.calls)


def test_two_links_for_same_pending_shipment_return_original_receipt(setup, monkeypatch):
    conn, created = setup(prior=uuid4())
    monkeypatch.setattr(service, '_receipt', lambda *a: {'reference': 'PRE-EXISTING'})
    assert service.submit_form(TOKEN, form()) == {'reference': 'PRE-EXISTING'}
    assert not created
    assert not any('insert into package_expectations' in q for q,p in conn.calls)


def test_consumed_link_returns_receipt_without_new_mutations(setup, monkeypatch):
    conn, created = setup()
    monkeypatch.setattr(service, '_link', lambda *a, **kw: dict(org_id=ORG, source_phone=PHONE, id=uuid4(), request_id=uuid4()))
    monkeypatch.setattr(service, '_receipt', lambda *a: {'reference': 'PRE-ORIGINAL'})
    assert service.submit_form(TOKEN, form(full_name='Changed'))['reference'] == 'PRE-ORIGINAL'
    assert not created
    assert not any('insert into' in q for q,p in conn.calls)


def test_unpublished_or_other_tenant_offering_rejected(setup, monkeypatch):
    conn, created = setup()
    monkeypatch.setattr(service, 'catalog', lambda *a, **kw: [])
    with pytest.raises(HTTPException, match='intake_service_unavailable'):
        service.submit_form(TOKEN, form())
    assert not created


def test_withdrawn_dropoff_rechecked_under_lock(setup):
    conn, created = setup(dropoff=None)
    with pytest.raises(HTTPException, match='intake_dropoff_unavailable'):
        service.submit_form(TOKEN, form())
    assert not created


def test_self_arranged_shipment_does_not_assign_depot(setup):
    conn, _ = setup()
    receipt = service.submit_form(TOKEN, form(delivery_method='SELF'))
    assert receipt['dropoff'] is None
    assert next(p for q,p in conn.calls if 'insert into package_expectations' in q)['warehouse'] is None


@pytest.mark.parametrize('changes', [dict(package_count=0),dict(package_count=True),dict(package_count=1.5),
    dict(estimated_weight_kg=-1),dict(estimated_weight_kg=float('nan')),dict(estimated_weight_kg=float('inf')),
    dict(country='ZZ'),dict(consent=False),dict(full_name=' '),dict(org_id='agency-b'),dict(client_id=str(uuid4()))])
def test_invalid_or_scope_changing_fields_rejected(changes):
    with pytest.raises(ValidationError): form(**changes)


@pytest.mark.parametrize('value', ['', '../secrets', 'a'*42, 'a'*44, 'a'*42+'!'])
def test_invalid_capability_rejected_before_database(value):
    with pytest.raises(HTTPException): service.token_hash(value)


def test_capability_query_requires_expiry_revocation_org_and_opt_in():
    conn = Connection()
    with pytest.raises(HTTPException): service._link(conn, TOKEN, lock=True)
    sql, params = conn.calls[0]
    assert params == {'h': service.token_hash(TOKEN)}
    assert TOKEN not in sql and TOKEN not in params.values()
    for guard in ("o.status='ACTIVE'", 'a.customer_intake_enabled', 'l.revoked_at is null', 'l.expires_at>now()', 'for update of l'):
        assert guard in sql


def test_catalog_never_returns_internal_contacts_and_scopes_all_joins():
    sql = service.CATALOG_SQL
    for guard in ('f.org_id=:o','s.org_id=f.org_id','r.org_id=f.org_id','w.org_id=f.org_id',
                  'f.public_visible','s.public_visible','r.public_visible','w.customer_dropoff_enabled',
                  'effective_until>now()', 's.archived_at is null','w.archived_at is null'):
        assert guard in sql
    assert 'w.contact_phone' not in sql
    assert 'w.contact_name' not in sql


def test_ai_issues_server_link_only_after_explicit_intent(monkeypatch):
    monkeypatch.setattr(ai, 'is_parcel_organization', lambda o: True)
    monkeypatch.setattr(ai, 'upsert_journey', lambda *a, **kw: {'id': uuid4(), 'stage': 'QUALIFYING','missing_fields':['full_name']})
    issued = []
    monkeypatch.setattr(service, 'issue_link', lambda *args: issued.append(args) or 'https://slaivio.com/prepare-shipment#'+TOKEN)
    monkeypatch.setattr(ai, 'convert_journey', lambda *a: pytest.fail('Form opt-in must prevent direct CRM creation'))
    context = dict(org_id=ORG, recent_messages=[], source_message_id=uuid4())
    extracted = dict(stage='QUALIFYING',service_intent_confirmed=True,confidence=.95,customer_type=None)
    monkeypatch.setattr(ai, '_provider_response', lambda *a, **kw: {'success':True,'content':json.dumps(extracted)})
    result = ai._parcel_qualification({'customer_intake_enabled': True}, context, PHONE)
    assert result['intake'] and TOKEN in result['reply'] and len(result['reply']) < 650
    assert issued == [(ORG, PHONE, context['source_message_id'])]
    # Model output cannot bypass the explicit boolean/confidence gates.
    monkeypatch.setattr(ai, 'upsert_journey', lambda o,p,e,**kw: {'id':uuid4(),'stage':e['stage']})
    for changes in ({'service_intent_confirmed':False},{'confidence':True},{'confidence':.5}):
        issued.clear()
        monkeypatch.setattr(ai, '_provider_response', lambda *a, **kw: {'success':True,'content':json.dumps({**extracted,**changes})})
        ai._parcel_qualification({'customer_intake_enabled':True},context,PHONE)
        assert not issued


def test_migration_opt_in_private_rls_and_no_existing_customer_rewrites():
    sql = (Path(__file__).parents[3]/'infra/sql/169_whatsapp_customer_intake.sql').read_text(encoding='utf-8')
    assert 'default false' in sql
    assert 'enable row level security' in sql
    assert 'token_hash text not null unique' in sql
    assert 'references package_expectations(id)' in sql
    assert 'update clients' not in sql
    assert 'delete from' not in sql


def test_issue_link_requires_real_inbound_whatsapp_and_caps_issuance(monkeypatch):
    class IssueConnection(Connection):
        count = 0
        valid_message = True
        enabled = True
        def execute(self, stmt, params=None):
            self.calls.append((str(stmt), params or {}))
            if 'select 1 from ai_settings' in str(stmt): return Result(1 if self.enabled else None)
            if 'select 1 from messages' in str(stmt): return Result(1 if self.valid_message else None)
            if 'select count(*)' in str(stmt): return Result(self.count)
            return Result()
    conn = IssueConnection()
    monkeypatch.setattr(service, 'engine', SimpleNamespace(begin=lambda: nullcontext(conn)))
    monkeypatch.setattr(service, 'catalog', lambda *a, **kw: [{'id': OFFER}])
    url = service.issue_link(ORG, PHONE, uuid4())
    token = url.split('#')[1]
    assert len(token) == 43
    assert '/prepare-shipment#' in url
    insertion = next(p for sql,p in conn.calls if 'insert into customer_intake_links' in sql)
    assert insertion['h'] == service.token_hash(token)
    assert token not in insertion.values()
    check = next(sql for sql,p in conn.calls if 'select 1 from messages' in sql)
    for guard in ("direction='inbound'", 'org_id=:o', 'id=:id', 'from_phone=:phone', 'not coalesce(is_group,false)', "='WHATSAPP'"):
        assert guard in check
    conn.count = 6
    assert service.issue_link(ORG, PHONE, uuid4()) is None
    conn.count = 0
    conn.valid_message = False
    assert service.issue_link(ORG, PHONE, uuid4()) is None
    conn.valid_message = True
    conn.enabled = False
    assert service.issue_link(ORG, PHONE, uuid4()) is None


def test_returning_receipt_hides_changed_or_unpublished_depot(monkeypatch):
    class ReceiptConnection(Connection):
        def execute(self, *a, **kw):
            return Result({'receipt': {'reference': 'PRE-OLD', 'dropoff': DEPOT}, 'offering_id': OFFER})
    for offerings in ([], [{'id': OFFER, 'dropoff': {**DEPOT, 'address': 'A different address'}}]):
        monkeypatch.setattr(service, 'catalog', lambda *a, **kw: offerings)
        receipt = service._receipt(ReceiptConnection(), ORG, uuid4())
        assert receipt['dropoff'] is None and receipt['dropoff_withdrawn']
        assert DEPOT['address'] not in json.dumps(receipt, ensure_ascii=False)


def test_public_api_uses_header_not_query_scope_and_validates_submission(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.customer_intake import router
    app = FastAPI()
    app.include_router(router)
    monkeypatch.setattr(service, 'public_form', lambda token: {'offerings': [], 'phone': PHONE, 'receipt': None})
    monkeypatch.setattr(service, 'submit_form', lambda token, data: {'reference': 'PRE-OK'})
    client = TestClient(app)
    assert client.get('/public/customer-intake?token='+TOKEN).status_code == 404
    response = client.get('/public/customer-intake', headers={'Authorization': 'Bearer '+TOKEN})
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'private, no-store'
    assert response.headers['x-robots-tag'] == 'noindex, nofollow'
    payload = form()
    payload['offering_id'] = str(payload['offering_id'])
    assert client.post('/public/customer-intake', json=payload, headers={'Authorization':'Bearer '+TOKEN}).status_code == 200
    assert client.post('/public/customer-intake', json={**payload, 'org_id':'other'}, headers={'Authorization':'Bearer '+TOKEN}).status_code == 422
