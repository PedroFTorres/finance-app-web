-- Protect plan/subscription fields from client-side updates.
-- Run this in Supabase SQL Editor after confirming your user_profiles table exists.
-- Goal: users can never promote themselves to pro/vip through the browser.

create or replace function public.prevent_client_plan_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
begin
  -- Supabase Edge Functions using SERVICE_ROLE and direct admin SQL may manage plans.
  if jwt_role = 'service_role' then
    return new;
  end if;

  if new.plano is distinct from old.plano
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_ends_at is distinct from old.subscription_ends_at
    or new.plano_expira_em is distinct from old.plano_expira_em then
    raise exception 'Plan fields can only be changed by the backend';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_plan_changes on public.user_profiles;

create trigger prevent_client_plan_changes
before update on public.user_profiles
for each row
execute function public.prevent_client_plan_changes();

-- Optional sanity check after installing:
-- A normal authenticated client should fail if it tries to update plano/subscription_status.
-- The payment webhook/function using SERVICE_ROLE should still be able to activate PRO.
