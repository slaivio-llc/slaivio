"""Transport dispatch: business operations are already committed."""
import logging

from app.services.whatsapp_provider_factory import get_whatsapp_provider
from app.db.notification_repository import (
    claim_notification_dispatch, finish_notification_dispatch,
    mark_notification_sent, mark_notification_failed, sync_package_notification_status,
)
from app.db.broadcast_repository import sync_notification_status as sync_broadcast_notification_status
from app.services.manager_event_service import emit_notification_event

logger = logging.getLogger(__name__)


def _project_result(notification: dict, status: str, result: dict):
    """Projection failures never turn an accepted send into a retry."""
    try:
        sync_package_notification_status(
            notification, status, provider=result.get('provider') or 'meta',
            provider_message_id=result.get('provider_message_id'),
            error='provider_rejected_message' if status == 'FAILED' else None,
        )
    except Exception:
        logger.warning('notification_projection_failed')
    try:
        sync_broadcast_notification_status(
            notification['org_id'], str(notification['id']), status,
            result.get('provider_message_id'),
            'provider_rejected_message' if status == 'FAILED' else None,
        )
    except Exception:
        logger.warning('broadcast_notification_projection_failed')
    try:
        emit_notification_event(
            org_id=notification['org_id'], notification_id=str(notification['id']),
            dossier_id=str(notification['dossier_id']) if notification.get('dossier_id') else None,
            title='Notification envoyée' if status == 'SENT' else 'Échec notification',
            message='Message accepté par le fournisseur.' if status == 'SENT' else 'Message refusé par le fournisseur.',
            status=status,
        )
    except Exception:
        logger.warning('notification_event_projection_failed')


def send_notification(org_id: str, notification_id: str):
    notification = claim_notification_dispatch(org_id, notification_id)
    if not notification:
        return {'status': 'skipped', 'message': 'notification_not_pending_or_already_claimed'}
    channel = str(notification.get('channel') or '').lower()
    if channel != 'whatsapp':
        # Never route an email/TikTok destination through WhatsApp.
        mark_notification_failed(org_id, notification_id, 'unsupported_notification_channel')
        finish_notification_dispatch(org_id, notification_id, 'REJECTED')
        return {'status': 'failed', 'message': 'unsupported_notification_channel'}
    recipient = notification.get('recipient_phone') or notification.get('destination')
    message = notification.get('message') or notification.get('message_body')
    if not recipient or not message:
        mark_notification_failed(org_id, notification_id, 'invalid_notification_payload')
        finish_notification_dispatch(org_id, notification_id, 'REJECTED')
        return {'status': 'failed', 'message': 'invalid_notification_payload'}
    try:
        provider = get_whatsapp_provider(org_id=org_id)
    except Exception:
        mark_notification_failed(org_id, notification_id, 'notification_provider_unavailable')
        finish_notification_dispatch(org_id, notification_id, 'REJECTED')
        return {'status': 'failed', 'message': 'notification_provider_unavailable'}
    try:
        result = provider.send_message(to=recipient, message=message)
    except Exception:
        # A timeout does not prove that the provider rejected the message.
        finish_notification_dispatch(org_id, notification_id, 'UNKNOWN')
        return {'status': 'unknown', 'message': 'provider_result_requires_reconciliation'}
    if not isinstance(result, dict) or not isinstance(result.get('success'), bool):
        finish_notification_dispatch(org_id, notification_id, 'UNKNOWN')
        return {'status': 'unknown', 'message': 'provider_result_requires_reconciliation'}
    if not result['success']:
        http_status = result.get('http_status')
        explicit_rejection = (isinstance(http_status, int) and 400 <= http_status < 500
                              and http_status != 408 and not result.get('provider_message_id'))
        if not explicit_rejection:
            finish_notification_dispatch(org_id, notification_id, 'UNKNOWN')
            return {'status': 'unknown', 'message': 'provider_result_requires_reconciliation'}
        mark_notification_failed(org_id, notification_id, 'provider_rejected_message')
        finish_notification_dispatch(org_id, notification_id, 'REJECTED')
        _project_result(notification, 'FAILED', result)
        return {'status': 'failed', 'message': 'provider_error'}
    try:
        mark_notification_sent(notification_id=notification_id,
            provider_message_id=result.get('provider_message_id'),
            provider=result.get('provider') or 'meta', provider_status=result.get('status'))
        finish_notification_dispatch(org_id, notification_id, 'ACCEPTED')
    except Exception:
        # Persisted claim stays non-retryable until reconciliation.
        logger.error('notification_acceptance_persistence_failed')
        return {'status': 'unknown', 'message': 'provider_acceptance_requires_reconciliation'}
    _project_result(notification, 'SENT', result)
    return {'status': 'sent', 'provider': result.get('provider'),
            'provider_message_id': result.get('provider_message_id'), 'provider_status': result.get('status')}
