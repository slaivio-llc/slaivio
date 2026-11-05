-- Retire only the legacy automatically generated silence reminders.
-- Never reset, resend, or mark as sent an uncertain/claimed/delivered message.
begin;
update notification_outbox n
set status='CANCELLED',dispatch_state='REJECTED',
    error_message='Cette relance automatique n’est plus applicable.'
from followup_attempts a join followup_tasks f
 on f.id=a.followup_id and f.org_id=a.org_id
where n.id=a.notification_id and n.org_id=a.org_id
 and f.followup_type='CONVERSATION_ABANDONED'
 and f.idempotency_key like 'auto:CONVERSATION_ABANDONED:%'
 and n.status='PENDING' and n.dispatch_state='IDLE';

update followup_attempts a set status='CANCELLED',error_code='legacy_silence_reminder_disabled'
from followup_tasks f
where a.org_id=f.org_id and a.followup_id=f.id
 and f.followup_type='CONVERSATION_ABANDONED'
 and f.idempotency_key like 'auto:CONVERSATION_ABANDONED:%'
 and a.status in ('QUEUED','DISPATCHING')
 and (a.notification_id is null or exists(
  select 1 from notification_outbox n where n.id=a.notification_id and n.org_id=a.org_id
   and n.status='CANCELLED' and n.dispatch_state='REJECTED'));

update followup_tasks f set status='CANCELLED',cancelled_at=now(),updated_at=now(),row_version=row_version+1
where f.followup_type='CONVERSATION_ABANDONED'
 and f.idempotency_key like 'auto:CONVERSATION_ABANDONED:%'
 and f.status in ('PENDING','SCHEDULED','DUE','FAILED','WAITING_RESPONSE')
 and not exists(select 1 from followup_attempts a where a.org_id=f.org_id and a.followup_id=f.id
  and (a.status not in ('CANCELLED','FAILED') or exists(
   select 1 from notification_outbox n where n.org_id=a.org_id and n.id=a.notification_id
    and (n.dispatch_state in ('UNKNOWN','CLAIMED','ACCEPTED') or n.status in ('SENT','DELIVERED','READ')))));
commit;
