-- Apply before deploying the matching API/dashboard.
-- New incoming QR audio/images only; no historical files are sent to AI.
begin;
alter table messages add column if not exists media_analysis_status text
 check(media_analysis_status in('PENDING','PROCESSING','COMPLETED','FAILED'));
alter table messages add column if not exists media_analysis_text text;
alter table messages add column if not exists media_analysis_error text;
alter table messages add column if not exists media_analysis_attempts integer not null default 0;
alter table messages add column if not exists media_analysis_started_at timestamptz;
alter table messages add column if not exists media_analysis_dispatched boolean not null default false;
create index if not exists messages_media_analysis_pending
 on messages(created_at) where media_analysis_status is not null and not media_analysis_dispatched;
commit;
