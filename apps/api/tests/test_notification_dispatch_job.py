from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def source(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_dispatch_scan_only_claims_safe_pending_rows():
    repository = source("apps/api/app/db/notification_repository.py")
    assert "where status='PENDING' and dispatch_state='IDLE'" in repository
    assert "claim_notification_dispatch" in source("apps/api/app/services/notification_sender.py")


def test_followup_and_broadcast_cron_jobs_dispatch_the_outbox():
    followups = source("apps/api/app/jobs/followup_recovery.py")
    campaigns = source("apps/api/app/jobs/broadcast_campaigns.py")
    dispatcher = source("apps/api/app/jobs/communication_dispatch.py")

    assert "dispatch_pending_notifications(100)" in followups
    assert "dispatch_pending_notifications(200)" in campaigns
    assert "send_notification(notification[\"org_id\"], notification[\"notification_id\"])" in dispatcher
    assert '"unknown"' in dispatcher
