from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from app.db import broadcast_repository as repo
from app.api import broadcasts


def repository(monkeypatch, *, eligible=True, future=False, stale=False, status='DRAFT', bad=0, template=False):
    engine = MagicMock()
    monkeypatch.setattr(repo, 'engine', engine)
    conn = engine.begin.return_value.__enter__.return_value
    campaign = {'id': 'campaign', 'org_id': 'agency', 'status': status, 'channels': ['WHATSAPP'],
                'scheduled_at': datetime.now(timezone.utc) + timedelta(days=1) if future else None,
                'approved_at': None, 'template_id': 'template' if template else None, 'provider_status': 'DRAFT'}
    def execute(statement, params):
        result = MagicMock()
        sql = str(statement)
        if sql.startswith('select b.*'):
            result.mappings.return_value.first.return_value = campaign
        elif sql.startswith('select count'):
            result.scalar_one.return_value = bad
        elif sql.startswith('select 1'):
            result.first.return_value = (1,) if eligible else None
        elif sql.startswith('update broadcasts'):
            result.mappings.return_value.first.return_value = None if stale else {**campaign, 'status': params['s']}
        return result
    conn.execute.side_effect = execute
    return conn


@pytest.mark.parametrize('future,expected', [(False, 'QUEUED'), (True, 'SCHEDULED')])
def test_single_confirmation_approves_and_launches_atomically(monkeypatch, future, expected):
    conn = repository(monkeypatch, future=future)
    result = repo.action('agency', 'campaign', 'actor', 'LAUNCH', 7)
    assert result['status'] == expected
    changes = [call for call in conn.execute.call_args_list if str(call.args[0]).startswith('update broadcasts')]
    assert len(changes) == 1
    assert changes[0].args[1] == {'s': expected, 'act': 'LAUNCH', 'a': 'actor', 'o': 'agency', 'b': 'campaign', 'v': 7}
    assert "in('APPROVE','LAUNCH')" in str(changes[0].args[0])
    queue = [call for call in conn.execute.call_args_list if str(call.args[0]).startswith('update broadcast_recipients')]
    assert len(queue) == (0 if future else 1)
    assert 'for update of b' in str(conn.execute.call_args_list[0].args[0])


@pytest.mark.parametrize('options,reason', [
    ({'eligible': False}, 'audience_empty'), ({'bad': 1}, 'precheck_failed'),
    ({'template': True}, 'template_not_approved'), ({'status': 'QUEUED'}, 'campaign_not_launchable'),
    ({'status': 'COMPLETED'}, 'campaign_not_launchable'),
])
def test_launch_never_approves_or_queues_an_unready_campaign(monkeypatch, options, reason):
    conn = repository(monkeypatch, **options)
    assert repo.action('agency', 'campaign', 'actor', 'LAUNCH', 7) == reason
    assert not any(str(call.args[0]).startswith(('update ', 'insert ')) for call in conn.execute.call_args_list)


def test_stale_confirmation_does_not_queue_recipients(monkeypatch):
    conn = repository(monkeypatch, stale=True)
    assert repo.action('agency', 'campaign', 'actor', 'LAUNCH', 6) is None
    assert not any(str(call.args[0]).startswith('update broadcast_recipients') for call in conn.execute.call_args_list)


def test_launch_api_passes_tenant_actor_and_expected_version(monkeypatch):
    action = MagicMock(return_value={'id': 'campaign', 'status': 'QUEUED'})
    monkeypatch.setattr(broadcasts.repo, 'action', action)
    result = broadcasts.launch('campaign', broadcasts.Launch(expected_version=7), {'org_id': 'agency', 'user_id': 'actor'})
    action.assert_called_once_with('agency', 'campaign', 'actor', 'LAUNCH', 7)
    assert result['campaign']['status'] == 'QUEUED'


def test_launch_rejects_invalid_state_with_explicit_conflict(monkeypatch):
    monkeypatch.setattr(broadcasts.repo, 'action', lambda *args: 'audience_empty')
    with pytest.raises(HTTPException) as error:
        broadcasts.launch('campaign', broadcasts.Launch(expected_version=1), {'org_id': 'agency'})
    assert error.value.status_code == 409
    assert error.value.detail == 'audience_empty'


def test_send_permission_alone_cannot_approve_and_launch(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.core import permissions
    from app.core.auth import get_current_manager
    from app.core.tenant_context import get_current_tenant
    app = FastAPI()
    app.include_router(broadcasts.router)
    app.dependency_overrides[get_current_manager] = lambda: {'user_id': 'actor'}
    app.dependency_overrides[get_current_tenant] = lambda: {'org_id': 'agency'}
    checked = []
    def permission(**kwargs):
        checked.append(kwargs['permission_code'])
        if kwargs['permission_code'] == 'broadcasts.approve':
            raise HTTPException(403, 'permission_denied')
    monkeypatch.setattr(permissions, 'assert_permission', permission)
    action = MagicMock()
    monkeypatch.setattr(broadcasts.repo, 'action', action)
    response = TestClient(app).post('/broadcasts/campaign/launch', json={'expected_version': 1})
    assert response.status_code == 403
    assert checked == ['broadcasts.send', 'broadcasts.approve']
    action.assert_not_called()
