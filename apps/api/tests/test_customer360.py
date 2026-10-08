from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api import clients as api
from app.clients import customer360 as crm
from app.clients import company_contacts as contacts
from app.clients import repository


def test_activity_only_reads_sources_allowed_by_business_permissions():
    base = crm.activity_source(set())
    assert 'audit_logs' in base
    for table in ('package_events', 'expedition_events', 'finance_events', 'from messages'):
        assert table not in base
    full = crm.activity_source({'packages.read', 'shipments.read', 'finance.read', 'inbox.read'})
    for table in ('package_events', 'expedition_events', 'finance_events', 'from messages'):
        assert table in full
    assert 'e.occurred_at>=ep.added_at' in full
    assert 'e.occurred_at<=ep.removed_at' in full
    assert "'package-'" in full and "'finance-'" in full


@pytest.mark.parametrize('section,permission', list(crm.SECTION_PERMISSIONS.items()))
def test_section_checks_its_business_permission_before_query(monkeypatch, section, permission):
    query = MagicMock()
    permission_check = MagicMock(side_effect=HTTPException(403))
    monkeypatch.setattr(api, 'assert_permission', permission_check)
    monkeypatch.setattr(api, 'read_section', query)
    with pytest.raises(HTTPException) as error:
        api.customer_section(uuid4(), section, 1, {'org_id': 'office', 'user_id': 'user'})
    assert error.value.status_code == 403
    permission_check.assert_called_once_with('user', 'office', permission)
    query.assert_not_called()


def test_section_uses_active_office_and_returns_not_found(monkeypatch):
    monkeypatch.setattr(api, 'assert_permission', MagicMock())
    query = MagicMock(return_value=None)
    monkeypatch.setattr(api, 'read_section', query)
    client = uuid4()
    with pytest.raises(HTTPException) as error:
        api.customer_section(client, 'finance', 2, {'org_id': 'office', 'user_id': 'user'})
    assert error.value.status_code == 404
    query.assert_called_once_with('office', str(client), 'finance', 2)


def test_finance_is_paginated_but_totals_are_grouped_over_all_invoices(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(crm, 'engine', engine)
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value = {'id': 'client'}
    conn.execute.return_value.scalar_one.return_value = 60
    conn.execute.return_value.mappings.return_value.all.return_value = []
    result = crm.read_section('office', str(uuid4()), 'finance', 3)
    assert result['total'] == 60
    for call in conn.execute.call_args_list:
        sql, params = call.args
        assert 'org_id' in str(sql) and 'client_id' in str(sql)
        assert params['org_id'] == 'office'
    assert conn.execute.call_args_list[2].args[1]['offset'] == 50
    totals = str(conn.execute.call_args_list[-1].args[0])
    assert 'group by currency' in totals
    assert "document_type='INVOICE'" in totals
    assert 'limit' not in totals


def test_legacy_workspace_does_not_read_unauthorized_sections(monkeypatch):
    monkeypatch.setattr(repository, 'get_client', MagicMock(return_value={'id':'client','current_balance':500}))
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    exists = MagicMock(return_value=True)
    monkeypatch.setattr(repository, '_table_exists', exists)
    result = repository.client_workspace('office', str(uuid4()), permissions=set())
    exists.assert_not_called()
    engine.connect.return_value.__enter__.return_value.execute.assert_not_called()
    assert 'current_balance' not in result['client']
    assert result['messages'] == result['documents'] == result['payments'] == []


def test_contact_edit_checks_version_before_changing_primary(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(contacts, 'engine', engine)
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.first.return_value = ('company',)
    conn.execute.return_value.scalar.return_value = 3
    with pytest.raises(HTTPException) as error:
        contacts.save_contact('office', str(uuid4()), 'actor', {
            'id':str(uuid4()),'row_version':2,'name':'Contact','is_primary':True,
        })
    assert error.value.status_code == 409
    assert len(conn.execute.call_args_list) == 3
    assert 'for update' in str(conn.execute.call_args_list[1].args[0])


def test_contact_rejects_non_company_or_wrong_office(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(contacts, 'engine', engine)
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.first.return_value = None
    with pytest.raises(HTTPException) as error:
        contacts.save_contact('office', str(uuid4()), 'actor', {'name':'Contact'})
    assert error.value.status_code == 404
    assert len(conn.execute.call_args_list) == 2
    assert "customer_type='business'" in str(conn.execute.call_args.args[0])
