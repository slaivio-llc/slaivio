from pathlib import Path
from unittest.mock import MagicMock

from app.db import broadcast_repository, notification_repository

ROOT = Path(__file__).resolve().parents[3]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_campaign_engine_contract():
    sql = read("infra/sql/079_broadcast_campaign_engine.sql")
    repo = read("apps/api/app/db/broadcast_repository.py")
    api = read("apps/api/app/api/broadcasts.py")
    for token in (
        "broadcast_audiences",
        "broadcast_consents",
        "broadcast_suppressions",
        "idempotency_key",
        "broadcasts.approve",
        "revoke all",
    ):
        assert token in sql
    for token in (
        "MARKETING_CONSENT_REQUIRED",
        "for update of r skip locked",
        "rendered_message",
        "process_queue",
    ):
        assert token in repo
    for token in (
        "save_template",
        "test_send",
        "save_settings",
        "export_recipients",
        "sync_delivery",
        "link_reply",
    ):
        assert token in repo
    for permission in (
        "broadcasts.read",
        "broadcasts.create",
        "broadcasts.audiences",
        "broadcasts.send",
        "broadcasts.analytics",
    ):
        assert permission in api


def test_broadcast_frontend_exists():
    ui = read("apps/web/dashboard/components/broadcasts/broadcasts-page.tsx")
    for label in (
        "Nouvelle campagne",
        "Créer un groupe de destinataires",
        "Calculer & figer audience",
        "Approuver",
        "Taux lecture",
    ):
        assert label in ui


def test_campaign_dispatch_states_follow_outbox_and_provider_acknowledgements():
    repo = read("apps/api/app/db/broadcast_repository.py")
    delivery = read("apps/api/app/db/whatsapp_delivery_repository.py")
    sender = read("apps/api/app/services/notification_sender.py")
    assert "status='DISPATCHING',notification_id=:n" in repo
    assert "r.status in('SNAPSHOT','QUEUED','DISPATCHING')" in repo
    assert "sync_broadcast_notification_status" in sender
    assert "where org_id=:org_id and notification_id=cast(:notification_id as uuid)" in repo
    assert "where r.org_id=:org_id and r.notification_id=:notification_id" in delivery
    assert "when r.status='READ' then 'READ'" in delivery


def test_campaign_outbox_insert_uses_the_callers_transaction():
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value._mapping = {"id": "notification-id"}

    result = notification_repository.create_notification_outbox(
        org_id="agency", client_id="client", dossier_id=None,
        recipient_phone="+123456789", notification_type="BROADCAST:INFO",
        message="Message", connection=connection,
    )

    connection.execute.assert_called_once()
    connection.commit.assert_not_called()
    assert result == {"id": "notification-id"}


def test_broadcast_queue_creates_outbox_inside_recipient_claim_transaction():
    repository = read("apps/api/app/db/broadcast_repository.py")
    assert "channel=r['channel'].lower(),connection=c" in repository


def test_campaign_start_rejects_channels_without_a_sender(monkeypatch):
    engine = MagicMock()
    monkeypatch.setattr(broadcast_repository, 'engine', engine)
    connection = engine.begin.return_value.__enter__.return_value
    connection.execute.return_value.mappings.return_value.first.return_value = {
        'channels': ['EMAIL'], 'approved_at': 'approved', 'scheduled_at': None,
    }

    result = broadcast_repository.action('agency', 'campaign', 'agent', 'START', 1)

    assert result == 'channel_not_available'
    assert connection.execute.call_count == 1


def test_campaign_api_exposes_unsupported_channel_as_conflict():
    api = read("apps/api/app/api/broadcasts.py")
    assert "'channel_not_available'" in api


def test_naive_campaign_schedule_is_interpreted_in_workspace_timezone():
    value = broadcast_repository._scheduled_at_utc('2026-10-20T15:30', 'Africa/Kinshasa')
    assert value.isoformat() == '2026-10-20T14:30:00+00:00'


def test_campaign_schedule_with_offset_preserves_absolute_instant():
    value = broadcast_repository._scheduled_at_utc('2026-10-20T15:30:00+02:00', 'UTC')
    assert value.isoformat() == '2026-10-20T13:30:00+00:00'


def test_campaign_start_uses_python_none_semantics():
    repo = read("apps/api/app/db/broadcast_repository.py")
    assert "campaign['approved_at'] is None" in repo


def test_saved_audience_can_target_selected_existing_clients_tenant_safely():
    repo = read("apps/api/app/db/broadcast_repository.py")
    ui = read("apps/web/dashboard/components/broadcasts/broadcasts-page.tsx")
    assert "selected_client_ids=[str(value)" in repo
    assert "c.id=any(cast(:group_client_ids as uuid[]))" in repo
    assert "c.org_id=:o" in repo
    assert "Sélectionner des clients précis" in ui
    assert "client_ids: selectedClientIds" in ui


def test_new_campaign_selects_existing_clients_directly():
    repo = read("apps/api/app/db/broadcast_repository.py")
    api = read("apps/api/app/api/broadcasts.py")
    ui = read("apps/web/dashboard/components/broadcasts/broadcasts-page.tsx")
    migration = read("infra/sql/143_broadcast_campaign_selected_clients.sql")
    assert "selected_client_ids:list[str]" in api
    assert "selected_client_ids" in repo
    assert "selected_client_ids: audienceSelection === \"__all__\" ? [] : selectedClientIds" in ui
    assert "Ajouter des clients précis" in ui
    assert "selected_client_ids jsonb" in migration
    assert "a.org_id=b.org_id and a.id=b.audience_id" in repo
    assert "Tous les clients éligibles" in ui
    assert "Clients sélectionnés manuellement" in ui
    assert "Sélectionner les {clientOptions.length} clients affichés" in ui
