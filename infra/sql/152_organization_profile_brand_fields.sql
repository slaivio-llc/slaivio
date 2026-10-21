-- Store the public-facing agency profile copy used by settings and customer documents.
begin;

alter table organizations
  add column if not exists brand_slogan text,
  add column if not exists brand_description text;

commit;
