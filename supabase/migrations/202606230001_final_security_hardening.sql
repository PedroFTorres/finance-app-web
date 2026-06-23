begin;

-- Stop public Storage API listing for the public avatars bucket.
-- Public object URLs continue to work for already-known file paths, but
-- anonymous clients should not be able to enumerate every avatar object.
drop policy if exists "POLICY 2 — SELECT 1oj01fe_0" on storage.objects;

drop policy if exists avatars_read_own on storage.objects;
create policy avatars_read_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Internal SECURITY DEFINER trigger functions must not be exposed through RPC.
-- Triggers can still execute them; browser roles cannot call them directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_client_plan_changes() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.prevent_client_plan_changes() to service_role;

-- No browser client should delete profiles directly.
revoke delete on table public.user_profiles from authenticated;

-- Legacy/unused table access should stay closed unless the app needs it again.
revoke insert, update, delete on table public.movimentos from authenticated;

commit;
