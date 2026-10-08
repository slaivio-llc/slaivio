from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.clients.creation_requests import replay_request, request_fingerprint
from app.clients import repository
from app.clients.phone import normalize_contact_phone


@pytest.mark.parametrize('value,region,expected', [
    ('06 12 34 56 78', 'FR', '+33612345678'),
    ('+32 470 12 34 56', None, '+32470123456'),
    ('0033 6 12 34 56 78', None, '+33612345678'),
    ('0812345678', 'CD', '+243812345678'),
    ('02 3661 8300', 'IT', '+390236618300'),
    ('', None, None),
])
def test_phone_normalization(value, region, expected):
    assert normalize_contact_phone(value, region) == expected


@pytest.mark.parametrize('value,region', [
    ('123', 'FR'), ('0612345678', None), ('call +33612345678', 'FR'),
    ('+33612345678 ext 2', 'FR'), ('+999123456789', None),
])
def test_invalid_phone_rejected(value, region):
    with pytest.raises(ValueError, match='invalid_phone'):
        normalize_contact_phone(value, region)


def test_fingerprint_stable_and_excludes_key():
    assert request_fingerprint({'name': 'A', 'idempotency_key': uuid4()}) == request_fingerprint({'name': 'A'})
    assert request_fingerprint({'name': 'A'}) != request_fingerprint({'name': 'B'})


def test_replay_scoped_and_locked():
    conn = MagicMock()
    conn.execute.return_value.mappings.return_value.first.return_value = {'payload_hash': 'hash', 'client_id': 'client'}
    assert replay_request(conn, 'office', 'actor', 'key', 'hash') == 'client'
    calls = conn.execute.call_args_list
    assert 'to_regclass' in str(calls[0].args[0])
    assert 'pg_advisory_xact_lock' in str(calls[1].args[0])
    assert calls[2].args[1] == {'org_id': 'office', 'actor_id': 'actor', 'key': 'key'}
    with pytest.raises(ValueError, match='client_creation_key_conflict'):
        replay_request(conn, 'office', 'actor', 'key', 'different')


def test_repository_replays_before_duplicate_check_or_insert(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    monkeypatch.setattr(repository, 'replay_request', MagicMock(return_value='client'))
    monkeypatch.setattr(repository, 'get_client', MagicMock(return_value={'id': 'client'}))
    duplicate = MagicMock()
    monkeypatch.setattr(repository, '_find_duplicate', duplicate)
    result = repository.create_client('office', 'actor', {'name': 'A', 'idempotency_key': str(uuid4())})
    assert result == {'id': 'client'}
    duplicate.assert_not_called()
    engine.begin.return_value.__enter__.return_value.execute.assert_not_called()


def test_archived_replay_does_not_recreate_client(monkeypatch):
    monkeypatch.setattr(repository, 'engine', MagicMock())
    monkeypatch.setattr(repository, 'replay_request', MagicMock(return_value='archived'))
    monkeypatch.setattr(repository, 'get_client', MagicMock(return_value=None))
    with pytest.raises(ValueError, match='client_creation_no_longer_available'):
        repository.create_client('office', 'actor', {'name': 'A', 'idempotency_key': str(uuid4())})
