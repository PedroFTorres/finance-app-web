-- Protect plan/subscription fields from client-side updates.
-- Run this in Supabase SQL Editor after confirming your user_profiles table exists.
-- Goal: users can never promote themselves to pro/vip through the browser,
-- while backend functions and Supabase admins can still manage plans.

create or replace function public.prevent_client_plan_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
  db_role text := current_user;
begin
  -- Edge Functions with SERVICE_ROLE may activate PRO after payment.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- Supabase dashboard / SQL editor admins may grant VIP manually.
  if db_role in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.plano is distinct from old.plano
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_ends_at is distinct from old.subscription_ends_at
    or new.plano_expira_em is distinct from old.plano_expira_em then
    raise exception 'Plan fields can only be changed by the backend or an admin';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_plan_changes on public.user_profiles;

create trigger prevent_client_plan_changes
before update on public.user_profiles
for each row
execute function public.prevent_client_plan_changes();

-- VIP manual grant example:
-- update public.user_profiles
-- set plano = 'vip', subscription_status = 'active', subscription_ends_at = null, plano_expira_em = null
-- where id = 'USER_ID_HERE';
