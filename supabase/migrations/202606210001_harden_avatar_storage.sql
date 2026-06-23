begin;

-- Restrict avatar uploads to small, browser-safe raster formats.
update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'avatars';

-- Existing permissive policies remain responsible for granting operations.
-- This restrictive guard ensures authenticated users can only operate inside
-- their own top-level folder, regardless of future permissive policies.
drop policy if exists avatars_owner_guard on storage.objects;
create policy avatars_owner_guard
  on storage.objects as restrictive
  for all to authenticated
  using (
    bucket_id <> 'avatars'
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id <> 'avatars'
    or (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
