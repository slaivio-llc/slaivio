-- Complete QR audio support after 167. No files, sessions or policies deleted.
-- The QR inbox uses this private bucket, originally restricted to PDF/images.
begin;
insert into storage.buckets as existing
 (id,name,public,file_size_limit,allowed_mime_types)
values ('dossier-documents','dossier-documents',false,12582912,
 array['application/pdf','image/jpeg','image/png','image/webp',
       'audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-wav',
       'audio/webm','audio/flac','audio/aac'])
on conflict(id) do update set
 public=false,
 -- Preserve a deliberately unlimited bucket or an existing larger limit.
 file_size_limit=case when existing.file_size_limit is null then null
   else greatest(existing.file_size_limit,excluded.file_size_limit) end,
 -- Preserve other approved types; NULL already means no MIME restriction.
 allowed_mime_types=case when existing.allowed_mime_types is null then null
   else array(select distinct mime from unnest(
     existing.allowed_mime_types || excluded.allowed_mime_types) as types(mime)
     order by mime) end;
commit;
