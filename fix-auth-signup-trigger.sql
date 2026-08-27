-- Fix para erro 500 no cadastro do Supabase Auth quando a causa for trigger/perfil.
-- Rode este arquivo no Supabase SQL Editor apenas se o log de Auth mostrar
-- "Database error saving new user" ou erro em trigger/função ao criar usuário.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    onboarding_completed,
    created_at,
    nome,
    avatar_url,
    cpf,
    plano,
    updated_at,
    plano_expira_em,
    subscription_status,
    subscription_ends_at
  )
  values (
    new.id,
    false,
    now(),
    coalesce(new.raw_user_meta_data->>'nome', ''),
    null,
    null,
    'free',
    now(),
    null,
    'inactive',
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
