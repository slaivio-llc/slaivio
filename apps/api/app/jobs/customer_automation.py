"""Run periodically; no direct provider call, only durable outbox producers."""
import os
os.environ['APP_RUNTIME']='cron'
from app.customer_automation.repository import process_events,process_expectations,process_packages


def main(limit=100):
 return {'events':process_events(limit),'expectations':process_expectations(limit),'packages':process_packages(limit)}


if __name__=='__main__':
 print(main())
