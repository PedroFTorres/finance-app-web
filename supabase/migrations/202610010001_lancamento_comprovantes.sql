begin;

alter table public.receitas
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_uploaded_at timestamptz;

alter table public.despesas
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_uploaded_at timestamptz;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'comprovantes',
  'comprovantes',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists comprovantes_select_own on storage.objects;
create policy comprovantes_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists comprovantes_insert_own on storage.objects;
create policy comprovantes_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists comprovantes_delete_own on storage.objects;
create policy comprovantes_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists comprovantes_owner_guard on storage.objects;
create policy comprovantes_owner_guard
  on storage.objects as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'comprovantes'
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id <> 'comprovantes'
    or (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
