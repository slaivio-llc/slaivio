"""Recovery cron: python -m app.jobs.inbox_media (run every minute)."""
import os

os.environ["APP_RUNTIME"] = "cron"

from app.services.inbox_media_jobs import process_pending_media

if __name__ == "__main__":
    results = process_pending_media()
    print({"processed": len(results)})
