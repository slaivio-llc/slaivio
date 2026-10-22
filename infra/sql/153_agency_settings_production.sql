-- Production settings: unique public addresses and atomic parcel references.
begin;

create table if not exists goods_rules (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references organizations(id),
  goods_name text not null,normalized_name text not null,category text,
  accepted boolean not null default true,pricing_mode text not null default 'PER_KG',
  price_note text,handling_note text,restriction_note text,
  requires_manual_validation boolean not null default false,
  language text not null default 'FR',tags text[] not null default '{}',
  priority integer not null default 0,is_active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create unique index if not exists organization_public_tracking_slug_unique
  on organization_settings ((settings->'public_tracking_page'->>'slug'))
  where nullif(settings->'public_tracking_page'->>'slug','') is not null;

alter table document_numbering_settings
  add column if not exists counter_scope text not null default 'GLOBAL'
    check (counter_scope in ('GLOBAL','OFFICE')),
  add column if not exists reset_period text not null default 'NEVER'
    check (reset_period in ('NEVER','YEAR','MONTH'));

create table if not exists organization_reference_counters (
  org_id text not null references organizations(id) on delete cascade,
  document_type text not null,
  scope_key text not null,
  period_key text not null,
  next_number bigint not null default 1 check (next_number > 0),
  primary key (org_id,document_type,scope_key,period_key)
);

create or replace function next_organization_reference(
  requested_org_id text,requested_document_type text,fallback_format text,requested_office_id uuid
) returns text language plpgsql as $$
declare
  cfg document_numbering_settings%rowtype;
  selected_number bigint;
  rendered_reference text;
  office_code text;
  scope_value text := '';
  period_value text := '';
  local_date date;
  sequence_token text;
  sequence_width integer;
begin
  insert into document_numbering_settings(org_id,document_type,prefix_format)
    values(requested_org_id,upper(requested_document_type),fallback_format)
    on conflict(org_id,document_type) do nothing;
  select * into cfg from document_numbering_settings
    where org_id=requested_org_id and document_type=upper(requested_document_type) for update;
  select (current_timestamp at time zone coalesce(s.timezone,'UTC'))::date into local_date
    from organizations o left join organization_settings s on s.org_id=o.id where o.id=requested_org_id;
  if cfg.counter_scope='OFFICE' or position('{OFFICE}' in cfg.prefix_format)>0 then
    select upper(code) into office_code from organization_locations
      where org_id=requested_org_id and id=requested_office_id and location_type='OFFICE' and status='ACTIVE';
    if office_code is null then
      select upper(min(code)) into office_code from organization_locations
        where org_id=requested_org_id and location_type='OFFICE' and status='ACTIVE'
        having count(*)=1;
    end if;
    if office_code is null then raise exception 'reference_office_required'; end if;
  end if;
  if cfg.counter_scope='OFFICE' then scope_value:=office_code; end if;
  if cfg.reset_period='YEAR' then period_value:=to_char(local_date,'YYYY'); end if;
  if cfg.reset_period='MONTH' then period_value:=to_char(local_date,'YYYY-MM'); end if;
  sequence_token:=substring(cfg.prefix_format from '\{(0+1)\}');
  sequence_width:=coalesce(length(sequence_token),0);
  loop
    if cfg.counter_scope='GLOBAL' and cfg.reset_period='NEVER' then
      update document_numbering_settings set next_number=next_number+1,updated_at=now()
        where id=cfg.id returning next_number-1 into selected_number;
    else
      insert into organization_reference_counters(org_id,document_type,scope_key,period_key,next_number)
        values(requested_org_id,upper(requested_document_type),scope_value,period_value,2)
        on conflict(org_id,document_type,scope_key,period_key) do update
          set next_number=organization_reference_counters.next_number+1
        returning next_number-1 into selected_number;
    end if;
    rendered_reference:=replace(replace(replace(replace(cfg.prefix_format,
      '{YYYY}',to_char(local_date,'YYYY')),'{YEAR}',to_char(local_date,'YYYY')),
      '{MM}',to_char(local_date,'MM')),'{OFFICE}',coalesce(office_code,''));
    if sequence_width>0 then
      rendered_reference:=replace(rendered_reference,'{'||sequence_token||'}',
        lpad(selected_number::text,greatest(sequence_width,length(selected_number::text)),'0'));
    end if;
    rendered_reference:=replace(rendered_reference,'{SEQUENCE}',selected_number::text);
    exit when upper(requested_document_type)<>'PACKAGE' or not exists(
      select 1 from cargo_packages where org_id=requested_org_id
        and (package_reference=rendered_reference or tracking_id=rendered_reference));
  end loop;
  return rendered_reference;
end; $$;

create or replace function next_organization_reference(
  requested_org_id text,requested_document_type text,fallback_format text
) returns text language sql as $$
  select next_organization_reference(requested_org_id,requested_document_type,fallback_format,null::uuid);
$$;

insert into document_numbering_settings(org_id,document_type,prefix_format)
  select id,'PACKAGE','COL-{YYYY}-{000001}' from organizations
  on conflict(org_id,document_type) do nothing;

commit;
