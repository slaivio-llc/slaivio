"""Render cron entrypoint for follow-up detection and delivery."""

import os

os.environ["APP_RUNTIME"] = "cron"

from app.db.followup_repository import process_attempt_queue,advance_sequences,detect_all_organizations,queue_due_tasks
from app.jobs.communication_dispatch import main as dispatch_pending_notifications
def main():
 from app.jobs.customer_automation import main as customer_automation
 automation=customer_automation()
 result={'detected':detect_all_organizations(),'advanced':advance_sequences(),'queued':queue_due_tasks(200),'processed':process_attempt_queue(100)}
 result['customer_automation']=automation
 result['dispatch']=dispatch_pending_notifications(100)
 print(result)
if __name__=='__main__':main()
