from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.clients import directory_scope as scope
from app.clients import directory as repository
from app.api import clients as api


TENANT = {'org_id': 'a', 'user_id': 'u'}


def test_without_network_permission_no_other_office_is_queried(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(scope, 'engine', engine)
    monkeypatch.setattr(scope, 'list_permissions_for_user', lambda *_: ['clients.read'])
    assert scope.offices_for_user(TENANT) == [{'org_id': 'a', 'name': 'Bureau actif'}]
    engine.connect.assert_not_called()


def test_network_requires_local_read_and_active_same_group_membership(monkeypatch):
    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.all.return_value = [
        {'org_id': 'a', 'name': 'A'}, {'org_id': 'b', 'name': 'B'}, {'org_id': 'c', 'name': 'C'}]
    monkeypatch.setattr(scope, 'engine', engine)
    monkeypatch.setattr(scope, 'list_permissions_for_user',
                        lambda user, org: ['network.read', 'clients.read'] if org != 'c' else ['network.read'])
    assert [item['org_id'] for item in scope.offices_for_user(TENANT)] == ['a', 'b']
    sql, params = conn.execute.call_args.args
    assert 'office.group_id=active_office.group_id' in str(sql)
    assert "membership.status='ACTIVE'" in str(sql)
    assert 'membership.clerk_user_id=:user' in str(sql)
    assert params == {'active': 'a', 'user': 'u'}


def test_scope_rejects_arbitrary_office(monkeypatch):
    monkeypatch.setattr(scope, 'offices_for_user', lambda _: [{'org_id': 'a'}, {'org_id': 'b'}])
    assert scope.resolve_scope(TENANT, None) is None
    assert scope.resolve_scope(TENANT, 'all') == ['a', 'b']
    assert scope.resolve_scope(TENANT, 'b') == ['b']
    with pytest.raises(HTTPException) as error:
        scope.resolve_scope(TENANT, 'foreign')
    assert error.value.status_code == 403


def test_network_count_and_rows_use_identical_scope(monkeypatch):
    engine = MagicMock()
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.scalar_one.return_value = 0
    conn.execute.return_value.mappings.return_value = []
    monkeypatch.setattr(repository, 'engine', engine)
    repository.directory('a', office_ids=['a', 'b'])
    for call in conn.execute.call_args_list:
        sql, params = call.args
        assert 'c.org_id=any(cast(:office_ids as text[]))' in str(sql)
        assert params['office_ids'] == ['a', 'b']


def test_export_cannot_bypass_other_office_export_permission(monkeypatch):
    monkeypatch.setattr(api, 'resolve_scope', lambda *_: ['a', 'b'])
    def check(user, org, permission):
        assert permission == 'clients.export'
        if org == 'b':
            raise HTTPException(403, 'forbidden')
    monkeypatch.setattr(api, 'assert_permission', check)
    query = MagicMock()
    monkeypatch.setattr(repository, 'directory', query)
    with pytest.raises(HTTPException) as error:
        api.client_directory_export(request=MagicMock(), q='', tenant=TENANT, office_id='all')
    assert error.value.status_code == 403
    query.assert_not_called()
