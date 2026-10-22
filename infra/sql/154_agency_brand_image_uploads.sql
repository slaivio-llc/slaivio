-- Public branding assets only. Uploads go through the permission-checked API;
-- no client INSERT/UPDATE/DELETE storage policies are granted.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-brand-images', 'agency-brand-images', true, 5242880, array['image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
