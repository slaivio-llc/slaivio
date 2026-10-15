from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import inbox
from app.db import pilot_inbox_repository as repository


def connection(monkeypatch, current=None, active=True, exists=True):
    engine = MagicMock()
    conn = engine.begin.return_value.__enter__.return_value
    monkeypatch.setattr(repository, 'engine', engine)
    conn.execute.return_value.first.side_effect = [(1,) if active else None, (1,) if exists else None]
    conn.execute.return_value.mappings.return_value.first.return_value = current
    conn.execute.return_value.mappings.return_value.one.return_value = {'id': 'assignment', 'assigned_to': 'agent'}
    return conn


def test_claim_scopes_membership_and_pauses_ai(monkeypatch):
    conn = connection(monkeypatch)
    repository.claim_conversation('agency', '+123', 'agent', 0)
    calls = conn.execute.call_args_list
    assert calls[0].args[1] == {'org_id': 'agency', 'actor': 'agent'}
    sql = '\n'.join(str(call.args[0]) for call in calls)
    assert 'for update' in sql
    assert 'pg_advisory_xact_lock' in sql
    assert "ai_mode_override='PAUSED'" in sql
    assert 'insert into audit_logs' in sql


@pytest.mark.parametrize('current,version,error', [
    ({'row_version': 2, 'assigned_to': None}, 1, 'stale_conversation_version'),
    ({'row_version': 2, 'assigned_to': 'other'}, 2, 'conversation_already_assigned'),
])
@pytest.mark.parametrize('release', [False, True])
def test_no_silent_steal_or_release(monkeypatch, current, version, error, release):
    conn = connection(monkeypatch, current)
    with pytest.raises(ValueError, match=error):
        repository.claim_conversation('agency', '+123', 'agent', version, release=release)
    assert not any('insert into' in str(call.args[0]) for call in conn.execute.call_args_list)


def test_inactive_agent_rejected_before_conversation_read(monkeypatch):
    conn = connection(monkeypatch, active=False)
    with pytest.raises(ValueError, match='agent_not_active'):
        repository.claim_conversation('agency', '+123', 'agent', 0)
    assert conn.execute.call_count == 1


def test_release_does_not_reactivate_ai(monkeypatch):
    conn = connection(monkeypatch, {'row_version': 4, 'assigned_to': 'agent'})
    repository.claim_conversation('agency', '+123', 'agent', 4, release=True)
    write = next(call for call in conn.execute.call_args_list if 'insert into conversation_assignments' in str(call.args[0]))
    assert write.args[1]['owner'] is None
    assert "ai_mode_override='PAUSED'" in str(write.args[0])


def test_mine_uses_authenticated_actor_and_tenant(monkeypatch):
    fetch = MagicMock(return_value={'items': [], 'page': 1, 'page_size': 40, 'total': 0})
    monkeypatch.setattr(inbox, 'list_pilot_conversations', fetch)
    inbox.list_conversations(view='mine', tenant={'org_id': 'agency', 'user_id': 'agent'})
    assert fetch.call_args.args[0] == 'agency'
    assert fetch.call_args.kwargs['actor_id'] == 'agent'


def test_owner_endpoint_does_not_accept_target_agent_from_browser(monkeypatch):
    claim = MagicMock(return_value={'assigned_to': 'real-agent'})
    monkeypatch.setattr(inbox, 'claim_conversation', claim)
    inbox.take_conversation('+123', inbox.ConversationClaimRequest(expected_version=3),
                            tenant={'org_id': 'agency', 'user_id': 'real-agent'})
    assert claim.call_args.args == ('agency', '+123', 'real-agent', 3)


def test_conflict_is_http_409(monkeypatch):
    monkeypatch.setattr(inbox, 'claim_conversation', MagicMock(side_effect=ValueError('conversation_already_assigned')))
    with pytest.raises(HTTPException) as error:
        inbox.take_conversation('+123', inbox.ConversationClaimRequest(expected_version=3),
                                tenant={'org_id': 'agency', 'user_id': 'agent'})
    assert error.value.status_code == 409
