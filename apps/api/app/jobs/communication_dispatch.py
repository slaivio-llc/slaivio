"""Dispatch durable pending communication outbox rows from a scheduled worker."""

import os

os.environ["APP_RUNTIME"] = "cron"

from app.db.notification_repository import list_global_pending_notification_dispatches
from app.services.notification_sender import send_notification


def main(limit: int = 100):
    candidates = list_global_pending_notification_dispatches(limit)
    results = {"candidates": len(candidates), "sent": 0, "failed": 0, "skipped": 0, "unknown": 0}
    for notification in candidates:
        try:
            result = send_notification(notification["org_id"], notification["notification_id"])
            status = result.get("status")
            if status == "sent":
                results["sent"] += 1
            elif status == "failed":
                results["failed"] += 1
            elif status == "unknown":
                results["unknown"] += 1
            else:
                results["skipped"] += 1
        except Exception:
            # The row remains governed by its dispatch claim and reconciliation policy.
            results["unknown"] += 1
    return results


if __name__ == "__main__":
    print(main())
