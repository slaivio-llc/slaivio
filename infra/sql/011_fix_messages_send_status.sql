alter table messages
add column if not exists send_status text default 'PENDING';

alter table messages
add column if not exists error_message text;
