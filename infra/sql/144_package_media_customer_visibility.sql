-- Customer sharing is opt-in. Existing and newly uploaded media remain private.
begin;
alter table package_media
  add column if not exists customer_visible boolean not null default false;
create index if not exists idx_package_media_customer_visible
  on package_media(org_id, package_id, created_at desc)
  where customer_visible = true;
comment on column package_media.customer_visible is
  'Explicitly approved for the customer tracking page; false keeps media internal.';
commit;
