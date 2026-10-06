from unittest.mock import MagicMock

import pytest

from app.dashboard import search_repository as repo
from app.api import dashboard


def test_no_permission_never_opens_database(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    assert repo.search_home('office-a', 'Jean', []) == []
    engine.connect.assert_not_called()


@pytest.mark.parametrize('permission,kind,table', [(s[0], s[1], s[2]) for s in repo.SEARCH_SOURCES])
def test_search_queries_only_authorized_resource_and_active_office(monkeypatch, permission, kind, table):
    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.all.return_value = [{'id': 'record-id', 'title': 'Example', 'subtitle': ''}]
    monkeypatch.setattr(repo, 'engine', engine)
    result = repo.search_home('office-a', "ab%_!", [permission], limit=1000)
    conn.execute.assert_called_once()
    statement, params = conn.execute.call_args.args
    assert f'from {table}' in str(statement)
    assert 'org_id=:org_id' in str(statement)
    assert params == {'org_id': 'office-a', 'query': '%ab!%!_!!%', 'limit': 10}
    assert set(statement.compile().params) == params.keys()
    assert result[0]['kind'] == kind
    assert result[0]['href'].endswith('record-id')


def test_api_permissions_are_resolved_for_verified_tenant(monkeypatch):
    permissions = MagicMock(return_value=['clients.read'])
    search = MagicMock(return_value=[])
    monkeypatch.setattr(dashboard, 'list_permissions_for_user', permissions)
    monkeypatch.setattr(dashboard, 'search_home', search)
    dashboard.dashboard_home_search('Jean', {'user_id': 'agent-a', 'org_id': 'office-a'})
    permissions.assert_called_once_with(user_id='agent-a', org_id='office-a')
    search.assert_called_once_with('office-a', 'Jean', ['clients.read'])


def test_short_query_does_not_open_database(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    assert repo.search_home('office-a', ' a ', ['clients.read']) == []
    engine.connect.assert_not_called()
