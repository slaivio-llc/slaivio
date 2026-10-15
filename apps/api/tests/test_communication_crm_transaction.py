from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.clients import repository as crm
from app.ai.repositories import parcel_customer_journey_repository as journeys


def test_shared_creation_uses_callers_transaction_for_every_read_and_audit(monkeypatch):
    conn = MagicMock()
    conn.execute.return_value.fetchone.return_value = ('client',)
    conn.execute.return_value.scalar.return_value = None
    engine = MagicMock()
    monkeypatch.setattr(crm, 'engine', engine)
    duplicate = MagicMock(return_value=None)
    get = MagicMock(return_value={'id': 'client'})
    audit = MagicMock()
    monkeypatch.setattr(crm, '_find_duplicate', duplicate)
    monkeypatch.setattr(crm, 'get_client', get)
    monkeypatch.setattr(crm, '_audit_client', audit)
    result = crm.create_client('agency', 'actor', {'name': 'Jean', 'phone': '+243812345678'}, connection=conn)
    assert result == {'id': 'client'}
    engine.begin.assert_not_called()
    engine.connect.assert_not_called()
    conn.commit.assert_not_called()
    conn.close.assert_not_called()
    assert duplicate.call_args.kwargs['connection'] is conn
    assert get.call_args.kwargs['connection'] is conn
    assert audit.call_args.args[0] is conn


def setup_conversion(monkeypatch, matches=None):
    conn = MagicMock()
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = conn
    monkeypatch.setattr(journeys, 'engine', engine)
    journey = {'id': uuid4(), 'stage': 'QUALIFIED', 'full_name': 'Jean Mukendi',
               'customer_type': 'individual', 'metadata': {'last_extraction': {
                   'service_intent_confirmed': True, 'confidence': 0.95}}}
    conn.execute.return_value.mappings.return_value.first.return_value = journey
    conn.execute.return_value.mappings.return_value.all.return_value = matches or []
    create = MagicMock(return_value={'id': 'client', 'display_name': 'Jean Mukendi'})
    monkeypatch.setattr(journeys, 'create_client', create)
    return conn, engine, journey, create


def test_conversion_reuses_crm_and_one_transaction(monkeypatch):
    conn, engine, journey, create = setup_conversion(monkeypatch)
    result = journeys.convert_journey('agency', '+243812345678')
    assert result['id'] == 'client'
    org, actor, payload = create.call_args.args
    assert org == 'agency'
    assert actor == 'slaivio-ai'
    assert payload['idempotency_key'] == str(journey['id'])
    assert payload['source'] == 'whatsapp'
    assert create.call_args.kwargs['connection'] is conn
    sql = '\n'.join(str(call.args[0]) for call in conn.execute.call_args_list)
    assert 'insert into clients' not in sql
    assert 'update conversation_assignments' in sql
    assert 'for update' in sql


def test_failed_crm_creation_does_not_mark_prospect_converted(monkeypatch):
    conn, engine, journey, create = setup_conversion(monkeypatch)
    create.side_effect = ValueError('duplicate_client')
    with pytest.raises(ValueError, match='duplicate_client'):
        journeys.convert_journey('agency', '+243812345678')
    assert not any('update ' in str(call.args[0]) for call in conn.execute.call_args_list)
    assert engine.begin.return_value.__exit__.call_args.args[0] is ValueError


def test_ambiguous_identity_is_not_linked(monkeypatch):
    conn, engine, journey, create = setup_conversion(monkeypatch, [{'id': 'a'}, {'id': 'b'}])
    assert journeys.convert_journey('agency', '+243812345678') is None
    create.assert_not_called()
    assert not any('update ' in str(call.args[0]) for call in conn.execute.call_args_list)


@pytest.mark.parametrize('phone', ['123456789@lid', '0812345678', '', 'unknown'])
def test_non_phone_channel_identity_cannot_create_client(monkeypatch, phone):
    engine = MagicMock()
    monkeypatch.setattr(journeys, 'engine', engine)
    assert journeys.convert_journey('agency', phone) is None
    engine.begin.assert_not_called()
