-- Complete the parcel and freight operational notification audit trail.
-- Safe and idempotent after 115_agency_business_type.sql.

alter table package_notifications
  add column if not exists created_by text,
  add column if not exists notification_outbox_id uuid
    references notification_outbox(id) on delete set null;

create index if not exists idx_package_notifications_org_type
  on package_notifications(org_id, notification_type, created_at desc);

create unique index if not exists uq_package_notifications_outbox
  on package_notifications(notification_outbox_id)
  where notification_outbox_id is not null;

comment on column package_notifications.created_by is
  'User or system actor that initiated the customer package notification.';

comment on column package_notifications.notification_outbox_id is
  'Outbox delivery record used to mirror the final WhatsApp delivery state.';
