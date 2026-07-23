create table if not exists dashboard_home_preferences (
    org_id text not null,
    user_id text not null,
    resource_key text not null,
    is_starred boolean not null default false,
    last_opened_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (org_id, user_id, resource_key)
);

create index if not exists idx_dashboard_home_preferences_recent
    on dashboard_home_preferences (org_id, user_id, last_opened_at desc)
    where last_opened_at is not null;

create index if not exists idx_dashboard_home_preferences_starred
    on dashboard_home_preferences (org_id, user_id, updated_at desc)
    where is_starred = true;

