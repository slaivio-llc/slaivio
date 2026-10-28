from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import platform_admin as api
from app.core.auth import get_current_manager
from app.core import platform_permissions
from app.platform_admin import console, repository as repo


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(api.router)
    app.dependency_overrides[get_current_manager] = lambda: {'user_id': 'user_staff'}
    granted = {'platform.admin.read'}
    check = lambda user, permission: user == 'user_staff' and permission in granted
    monkeypatch.setattr(platform_permissions, 'user_has_platform_permission', check)
    monkeypatch.setattr(api, 'user_has_platform_permission', check)
    with TestClient(app) as http:
        yield http, granted


@pytest.mark.parametrize('kind,permission', [('subscriptions','platform.billing.manage'),('invoices','platform.billing.manage'),('checkouts','platform.billing.manage'),('support','platform.support.manage'),('audit','platform.audit.read'),('quarantine','quarantine.read')])
def test_sensitive_register_requires_its_own_permission(client, monkeypatch, kind, permission):
    http, granted = client
    query = MagicMock(return_value={'items': [], 'total': 0})
    monkeypatch.setattr(console, 'register', query)
    assert http.get('/platform/admin/register/' + kind).status_code == 403
    query.assert_not_called()
    granted.add(permission)
    assert http.get('/platform/admin/register/' + kind).status_code == 200


@pytest.mark.parametrize('query',['page=0','page_size=101','q='+'x'*121,'status='+'x'*81])
def test_register_filters_are_bounded(client, query):
    http, _ = client
    assert http.get('/platform/admin/register/agencies?' + query).status_code == 422


def test_no_raw_messages_or_secrets_in_technical_register():
    base = console.REGISTERS['quarantine'][0]
    assert 'payload' not in base
    assert 'failure_reason' not in base
    assert 'last_replay_error' not in base
    assert 'checkout_url' not in console.REGISTERS['checkouts'][0]


def test_register_uses_parameters_and_root_agencies(monkeypatch):
    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar_one.return_value = 26
    conn.execute.return_value.mappings.return_value.all.return_value = []
    monkeypatch.setattr(console, 'engine', engine)
    payload = "x' OR true--"
    result = console.register('agencies', payload, 'ACTIVE', 2, 25)
    assert result['total_pages'] == 2
    sql, params = conn.execute.call_args.args
    assert payload not in str(sql)
    assert params['q'] == '%' + payload + '%'
    assert params['offset'] == 25
    assert 'o.parent_org_id is null' in str(sql)


def test_read_only_agency_detail_does_not_leak_billing_records(client, monkeypatch):
    http, _ = client
    monkeypatch.setattr(repo, 'agency', lambda _: {'organization': {}, 'invoices': [{'invoice_number': 'private'}]})
    monkeypatch.setattr(console,'spaces',lambda _:[])
    assert http.get('/platform/admin/agencies/org').json()['invoices'] == []


def test_support_requires_permission_and_returns_real_conversation(client, monkeypatch):
    http, granted = client
    query = MagicMock(return_value={'ticket': {}, 'messages': [{'message':'Bonjour'}]})
    monkeypatch.setattr(console, 'ticket', query)
    path = '/platform/admin/tickets/11111111-1111-4111-8111-111111111111'
    assert http.get(path).status_code == 403
    query.assert_not_called()
    granted.add('platform.support.manage')
    assert http.get(path).json()['messages'][0]['message'] == 'Bonjour'


def test_operator_changes_require_snapshot_reason_and_read_access(client, monkeypatch):
    http, granted = client
    granted.add('platform.permissions.manage')
    write = MagicMock(return_value=[])
    monkeypatch.setattr(repo, 'grant', write)
    url = '/platform/admin/operators'
    assert http.put(url, json={'user_id':'user_target','permissions':[]}).status_code == 422
    payload = {'user_id':'user_target','permissions':['platform.billing.manage'],'expected_permissions':[],'reason':'Mission facturation'}
    assert http.put(url,json=payload).status_code == 422
    write.assert_not_called()
    payload['permissions'] = []
    assert http.put(url,json=payload).status_code == 200
    write.assert_called_once_with('user_staff','user_target',[],[],'Mission facturation')


@pytest.mark.parametrize('result', ['self','last_admin','conflict'])
def test_protected_operator_changes_never_report_success(client,monkeypatch,result):
    http, granted = client
    granted.add('platform.permissions.manage')
    monkeypatch.setattr(repo,'grant',lambda *args:result)
    assert http.put('/platform/admin/operators',json={'user_id':'user_target','permissions':[],'expected_permissions':[],'reason':'Fin de mission'}).status_code == 409


@pytest.mark.parametrize('actor,target,active,old,expected,result',[
    ('user_staff','user_other',[],[],[],'forbidden'),
    ('user_staff','user_staff',['platform.admin.read','platform.permissions.manage'],[],[],'self'),
    ('user_staff','user_other',['platform.admin.read','platform.permissions.manage'],['platform.admin.read'],[],'conflict'),
])
def test_operator_protection_precedes_any_write(monkeypatch,actor,target,active,old,expected,result):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.scalars.return_value.all.side_effect=[active,old]
    monkeypatch.setattr(repo,'engine',engine)
    assert repo.grant(actor,target,[],expected,'Fin de mission')==result
    statements=[str(call.args[0]).lower() for call in conn.execute.call_args_list]
    assert 'pg_advisory_xact_lock' in statements[0]
    assert not any(sql.startswith(('update','insert')) for sql in statements)


def test_subscription_activation_rejects_expired_access(monkeypatch):
    engine=MagicMock();conn=engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.scalar.return_value='plan'
    conn.execute.return_value.mappings.return_value.first.return_value={'ends_at':datetime.now(timezone.utc)-timedelta(days=1),'trial_ends_at':None}
    monkeypatch.setattr(repo,'engine',engine)
    assert repo.subscription('org','staff','PRO','ACTIVE','Correction',1)=='expiry'
    assert not any(str(call.args[0]).startswith('update') for call in conn.execute.call_args_list)


def test_bootstrap_is_manual_guarded_and_not_an_automatic_migration():
    root=Path(__file__).resolve().parents[3]
    sql=(root/'infra/manual/bootstrap_platform_admin.sql').read_text(encoding='utf-8')
    assert 'REMPLACER_PAR_USER_ID_CLERK' in sql
    assert "'^user_[A-Za-z0-9]+$'" in sql
    assert 'raise exception' in sql
    migration=(root/'infra/sql/160_platform_operator_privacy.sql').read_text(encoding='utf-8')
    assert 'alter table platform_operator_permissions enable row level security' in migration
    assert 'alter table platform_agency_notes enable row level security' in migration
    assert "array['anon','authenticated']" in migration
