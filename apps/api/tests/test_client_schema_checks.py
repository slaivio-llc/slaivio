from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.clients.creation_requests import replay_request
from app.clients.company_contacts import list_contacts, save_contact
from app.clients import company_contacts
from app.clients.schema_checks import missing_tables, REQUIRED_TABLES


def test_missing_creation_table_stops_before_lock_or_write():
    conn = MagicMock()
    conn.execute.return_value.scalar_one.return_value = False
    with pytest.raises(HTTPException) as error:
        replay_request(conn, 'office', 'actor', 'key', 'hash')
    assert error.value.status_code == 503
    assert error.value.detail['code'] == 'crm_migration_required'
    assert error.value.detail['migrations'] == ['126_client_creation_requests.sql']
    assert conn.execute.call_count == 1
    assert 'to_regclass' in str(conn.execute.call_args.args[0])


@pytest.mark.parametrize('write', [False, True])
def test_missing_contacts_table_returns_deployment_error(monkeypatch, write):
    engine = MagicMock()
    monkeypatch.setattr(company_contacts, 'engine', engine)
    context = engine.begin if write else engine.connect
    context.return_value.__enter__.return_value.execute.return_value.scalar_one.return_value = False
    with pytest.raises(HTTPException) as error:
        if write:
            save_contact('office', 'company', 'actor', {'name':'Jean'})
        else:
            list_contacts('office', 'company')
    assert error.value.status_code == 503
    assert error.value.detail['migrations'] == ['127_client_company_contacts.sql']


def test_schema_report_lists_both_missing_migrations():
    conn = MagicMock()
    conn.execute.return_value.scalar_one.return_value = False
    assert missing_tables(conn, REQUIRED_TABLES) == list(REQUIRED_TABLES.values())
