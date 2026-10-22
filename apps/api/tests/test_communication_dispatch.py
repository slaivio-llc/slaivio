from unittest.mock import MagicMock

import pytest

from app.services import notification_sender as sender
from app.db import notification_repository as repository


@pytest.fixture
def setup(monkeypatch):
    notification = {'id': 'notification', 'org_id': 'agency', 'channel': 'whatsapp',
                    'recipient_phone': '+243812345678', 'message': 'Votre colis est arrivé.'}
    mocks = {}
    for name in ('claim_notification_dispatch', 'finish_notification_dispatch', 'mark_notification_sent',
                 'mark_notification_failed', 'sync_package_notification_status', 'emit_notification_event'):
        mocks[name] = MagicMock()
        monkeypatch.setattr(sender, name, mocks[name])
    mocks['claim_notification_dispatch'].return_value = notification
    provider = MagicMock()
    provider.send_message.return_value = {'success': True, 'provider_message_id': 'external', 'status': 'accepted'}
    monkeypatch.setattr(sender, 'get_whatsapp_provider', MagicMock(return_value=provider))
    return notification, mocks, provider


def test_one_claim_only_sends_once(setup):
    notification, mocks, provider = setup
    mocks['claim_notification_dispatch'].side_effect = [notification, None]
    assert sender.send_notification('agency', 'notification')['status'] == 'sent'
    assert mocks['emit_notification_event'].call_args.kwargs['message'] == 'Le message WhatsApp a bien été envoyé au destinataire.'
    assert sender.send_notification('agency', 'notification')['status'] == 'skipped'
    assert provider.send_message.call_count == 1


@pytest.mark.parametrize('projection', ['sync_package_notification_status', 'emit_notification_event'])
def test_projection_failure_never_retries_accepted_message(setup, projection):
    _, mocks, _ = setup
    mocks[projection].side_effect = RuntimeError('local failure')
    assert sender.send_notification('agency', 'notification')['status'] == 'sent'
    mocks['mark_notification_failed'].assert_not_called()
    mocks['finish_notification_dispatch'].assert_called_with('agency', 'notification', 'ACCEPTED')


@pytest.mark.parametrize('result', [None, {'success': False}, {'success': False, 'http_status': 504},
    {'success': False, 'http_status': 400, 'provider_message_id': 'external'}])
def test_ambiguous_outcome_is_not_retryable_failure(setup, result):
    _, mocks, provider = setup
    provider.send_message.return_value = result
    assert sender.send_notification('agency', 'notification')['status'] == 'unknown'
    mocks['mark_notification_failed'].assert_not_called()
    mocks['finish_notification_dispatch'].assert_called_with('agency', 'notification', 'UNKNOWN')


def test_timeout_is_unknown(setup):
    _, mocks, provider = setup
    provider.send_message.side_effect = TimeoutError()
    assert sender.send_notification('agency', 'notification')['status'] == 'unknown'
    mocks['mark_notification_failed'].assert_not_called()


def test_rejection_is_failed(setup):
    _, mocks, provider = setup
    provider.send_message.return_value = {'success': False, 'http_status': 400}
    assert sender.send_notification('agency', 'notification')['status'] == 'failed'
    mocks['finish_notification_dispatch'].assert_called_with('agency', 'notification', 'REJECTED')
    assert 'n’a pas pu être envoyé' in mocks['emit_notification_event'].call_args.kwargs['message']


def test_email_is_never_sent_on_whatsapp(setup):
    notification, _, provider = setup
    notification['channel'] = 'email'
    assert sender.send_notification('agency', 'notification')['message'] == 'unsupported_notification_channel'
    provider.send_message.assert_not_called()


def test_acceptance_persistence_failure_never_marks_failed(setup):
    _, mocks, _ = setup
    mocks['mark_notification_sent'].side_effect = RuntimeError('database unavailable')
    assert sender.send_notification('agency', 'notification')['status'] == 'unknown'
    mocks['mark_notification_failed'].assert_not_called()


def test_claim_is_atomic_and_tenant_scoped(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    conn = engine.begin.return_value.__enter__.return_value
    conn.execute.return_value.mappings.return_value.first.return_value = None
    assert repository.claim_notification_dispatch('agency', 'notification') is None
    sql, params = conn.execute.call_args.args
    assert "dispatch_state='IDLE'" in str(sql)
    assert "status='PENDING'" in str(sql)
    assert params == {'org_id': 'agency', 'id': 'notification'}


def test_retry_cannot_reset_other_tenant_or_unknown_send(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(repository, 'engine', engine)
    conn = engine.connect.return_value.__enter__.return_value
    conn.execute.return_value.fetchone.return_value = None
    assert repository.reset_notification_for_retry('notification', org_id='agency') is None
    sql, params = conn.execute.call_args.args
    assert 'org_id = :org_id' in str(sql)
    assert "dispatch_state in ('IDLE','REJECTED')" in str(sql)
    assert "status = 'FAILED'" in str(sql)
    assert params['org_id'] == 'agency'


def test_manual_sent_route_cannot_fabricate_delivery():
    from fastapi import HTTPException
    from app.api.notifications import mark_notification_sent_endpoint
    with pytest.raises(HTTPException) as error:
        mark_notification_sent_endpoint('notification', tenant={'org_id': 'agency'})
    assert error.value.status_code == 410


def test_reconciliation_api_uses_current_tenant(monkeypatch):
    from app.api import notifications
    lookup = MagicMock(return_value=[])
    monkeypatch.setattr(notifications, 'list_dispatch_reconciliation', lookup)
    notifications.get_reconciliation_queue(limit=20, tenant={'org_id': 'agency'})
    lookup.assert_called_once_with('agency', 20)
