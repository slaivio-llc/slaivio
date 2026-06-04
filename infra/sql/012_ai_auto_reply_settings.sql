alter table ai_settings
add column if not exists auto_reply_enabled boolean not null default false;

alter table ai_settings
add column if not exists auto_reply_min_confidence numeric not null default 0.75;
