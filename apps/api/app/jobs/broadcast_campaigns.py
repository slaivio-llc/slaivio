"""Render cron entrypoint for approved broadcast campaigns."""

import os

os.environ["APP_RUNTIME"] = "cron"

from app.db.broadcast_repository import process_queue
from app.db.database import engine
from app.jobs.communication_dispatch import main as dispatch_pending_notifications
from sqlalchemy import text
def main():
 with engine.begin() as c:c.execute(text("update broadcasts set status='QUEUED',updated_at=now() where status='SCHEDULED' and approved_at is not null and scheduled_at<=now()"));c.execute(text("update broadcast_recipients set status='QUEUED',queued_at=now() where status='SNAPSHOT' and exclusion_reason is null and broadcast_id in(select id from broadcasts where status='QUEUED')"))
 print({'processed':process_queue(200),'dispatch':dispatch_pending_notifications(200)})
if __name__=='__main__':main()
