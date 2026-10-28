from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import platform_admin as api
from app.core.auth import get_current_manager
from app.core import platform_permissions
from app.platform_admin import demo_requests as repo
from app.platform_admin import repository as platform_repo

ID = UUID('11111111-1111-4111-8111-111111111111')
STAMP = datetime(2026, 10, 28, 10, tzinfo=timezone.utc)


def test_public_visitors_cannot_read_demo_contacts(monkeypatch):
    app = FastAPI()
    app.include_router(api.router)
    listing = MagicMock()
    monkeypatch.setattr(repo, 'listing', listing)
    with TestClient(app) as http:
        assert http.get('/platform/admin/demo-requests').status_code == 401
    listing.assert_not_called()


def test_privacy_migration_closes_browser_table_access():
    from pathlib import Path
    migration = (Path(__file__).resolve().parents[3] / 'infra/sql/159_platform_demo_requests_privacy.sql').read_text(encoding='utf-8')
    assert 'alter table landing_demo_requests enable row level security' in migration
    assert 'alter table platform_admin_audit_log enable row level security' in migration
    assert 'revoke all on landing_demo_requests,platform_admin_audit_log from public' in migration
    assert "array['anon','authenticated']" in migration
    assert 'grant ' not in migration.lower()


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(api.router)
    app.dependency_overrides[get_current_manager] = lambda: {'user_id': 'staff'}
    granted = {'platform.admin.read', 'platform.agencies.manage'}
    monkeypatch.setattr(platform_permissions, 'user_has_platform_permission', lambda user, permission: user == 'staff' and permission in granted)
    with TestClient(app) as http:
        yield http, granted


def test_agency_owner_without_platform_grant_cannot_read_leads(client, monkeypatch):
    http, granted = client
    granted.clear()
    listing = MagicMock()
    monkeypatch.setattr(repo, 'listing', listing)
    assert http.get('/platform/admin/demo-requests').status_code == 403
    listing.assert_not_called()


def test_platform_read_access_does_not_grant_write_access(client, monkeypatch):
    http, granted = client
    granted.remove('platform.agencies.manage')
    write = MagicMock()
    monkeypatch.setattr(repo, 'update', write)
    response = http.patch(f'/platform/admin/demo-requests/{ID}', json={'status': 'CONTACTED', 'expected_updated_at': STAMP.isoformat()})
    assert response.status_code == 403
    write.assert_not_called()


@pytest.mark.parametrize('query', ['page=0', 'page_size=101', 'status=UNKNOWN', 'q=' + 'a' * 121])
def test_demo_filters_are_bounded(client, monkeypatch, query):
    http, _ = client
    listing = MagicMock()
    monkeypatch.setattr(repo, 'listing', listing)
    assert http.get('/platform/admin/demo-requests?' + query).status_code == 422
    listing.assert_not_called()


def test_demo_list_uses_current_filters_and_pagination(client, monkeypatch):
    http, _ = client
    listing = MagicMock(return_value={'items': [], 'total': 0, 'page': 2})
    monkeypatch.setattr(repo, 'listing', listing)
    assert http.get('/platform/admin/demo-requests?q=Congo&status=NEW&page=2').status_code == 200
    listing.assert_called_once_with('Congo', 'NEW', 2, 25)


def test_demo_update_uses_authenticated_actor_and_returns_saved_row(client, monkeypatch):
    http, _ = client
    write = MagicMock(return_value={'id': str(ID), 'status': 'CONTACTED'})
    monkeypatch.setattr(repo, 'update', write)
    response = http.patch(f'/platform/admin/demo-requests/{ID}', json={'status': 'CONTACTED', 'expected_updated_at': STAMP.isoformat(), 'note': 'Appel effectué', 'actor': 'attacker'})
    assert response.status_code == 200
    assert response.json()['request']['status'] == 'CONTACTED'
    write.assert_called_once_with(ID, 'staff', 'CONTACTED', STAMP, 'Appel effectué')


@pytest.mark.parametrize('outcome,status', [('missing', 404), ('conflict', 409)])
def test_missing_or_stale_demo_update_is_not_success(client, monkeypatch, outcome, status):
    http, _ = client
    monkeypatch.setattr(repo, 'update', lambda *_: outcome)
    assert http.patch(f'/platform/admin/demo-requests/{ID}', json={'status': 'CONTACTED', 'expected_updated_at': STAMP.isoformat()}).status_code == status


@pytest.mark.parametrize('payload', [{'status': 'CONVERTED', 'expected_updated_at': STAMP.isoformat()}, {'status': 'CONTACTED', 'expected_updated_at': '2026-10-28T10:00:00'}, {'status': 'CONTACTED', 'expected_updated_at': STAMP.isoformat(), 'note': 'a' * 2001}])
def test_update_rejects_invalid_status_naive_time_or_oversized_note(client, monkeypatch, payload):
    http, _ = client
    write = MagicMock()
    monkeypatch.setattr(repo, 'update', write)
    assert http.patch(f'/platform/admin/demo-requests/{ID}', json=payload).status_code == 422
    write.assert_not_called()


def connection(monkeypatch):
    conn, engine = MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(repo, 'engine', engine)
    return conn, engine


def test_listing_binds_user_search_and_has_stable_pagination(monkeypatch):
    conn, _ = connection(monkeypatch)
    count, rows = MagicMock(), MagicMock()
    count.scalar_one.return_value = 26
    rows.mappings.return_value.all.return_value = [{'id': str(ID)}]
    conn.execute.side_effect = [count, rows]
    result = repo.listing("x' or true--", 'NEW', 2, 25)
    assert result['total_pages'] == 2
    sql, params = conn.execute.call_args.args
    assert "x' or true--" not in str(sql)
    assert 'order by created_at desc,id desc' in str(sql)
    assert params['offset'] == 25 and params['status'] == 'NEW'
    assert params['q'] == "%x' or true--%"


def test_update_is_version_checked_and_audited_in_one_transaction(monkeypatch):
    conn, engine = connection(monkeypatch)
    old, updated = MagicMock(), MagicMock()
    old.mappings.return_value.first.return_value = {'status': 'NEW'}
    updated.mappings.return_value.first.return_value = {'status': 'CONTACTED'}
    conn.execute.side_effect = [old, updated]
    audit = MagicMock()
    monkeypatch.setattr(repo, '_audit', audit)
    assert repo.update(ID, 'staff', 'CONTACTED', STAMP, '  Premier appel  ') == {'status': 'CONTACTED'}
    engine.begin.assert_called_once()
    sql, params = conn.execute.call_args.args
    assert 'updated_at=:expected' in str(sql)
    assert params['expected'] == STAMP
    audit.assert_called_once_with(conn, 'staff', 'DEMO_REQUEST_UPDATED', 'demo_request', ID, {'status': 'NEW'}, {'status': 'CONTACTED'}, 'Premier appel')


def test_conflicting_update_does_not_add_a_note_or_audit(monkeypatch):
    conn, _ = connection(monkeypatch)
    old, missing = MagicMock(), MagicMock()
    old.mappings.return_value.first.return_value = {'status': 'CONTACTED'}
    missing.mappings.return_value.first.return_value = None
    conn.execute.side_effect = [old, missing]
    audit = MagicMock()
    monkeypatch.setattr(repo, '_audit', audit)
    assert repo.update(ID, 'staff', 'COMPLETED', STAMP, 'note') == 'conflict'
    audit.assert_not_called()


def test_platform_stats_distinguish_agencies_users_and_currencies(monkeypatch):
    conn, engine = MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    main = MagicMock()
    main.mappings.return_value.one.return_value = {'agencies': 2, 'demo_requests': 3}
    revenue = MagicMock()
    revenue.__iter__.return_value = iter([SimpleNamespace(_mapping={'currency_code': 'USD', 'collected_minor': 11900}), SimpleNamespace(_mapping={'currency_code': 'XOF', 'collected_minor': 50000})])
    conn.execute.side_effect = [main, [], revenue, []]
    monkeypatch.setattr(platform_repo, 'engine', engine)
    result = platform_repo.overview()
    queries = [str(call.args[0]) for call in conn.execute.call_args_list]
    assert 'parent_org_id is null' in queries[0]
    assert 'count(distinct clerk_user_id)' in queries[0]
    assert 'trial_ends_at>now()' in queries[0]
    assert 'group by currency_code' in queries[2]
    assert len(result['revenues_by_currency']) == 2
