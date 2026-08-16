begin;

alter table public.user_profiles
  add column if not exists trial_started_at timestamptz not null default now();

alter table public.user_profiles
  add column if not exists whatsapp text,
  add column if not exists telefone text,
  add column if not exists cidade text,
  add column if not exists estado text;

update public.user_profiles
set trial_started_at = coalesce(trial_started_at, created_at, now())
where trial_started_at is null;

create or replace function public.arolix_has_paid_access(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = p_user_id
      and lower(coalesce(p.plano, 'free')) in ('pro', 'vip')
      and lower(coalesce(p.subscription_status, 'inactive')) = 'active'
      and (p.subscription_ends_at is null or p.subscription_ends_at > now())
      and (p.plano_expira_em is null or p.plano_expira_em > now())
  );
$$;

create or replace function public.arolix_has_premium_access(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.arolix_has_paid_access(p_user_id);
$$;

create or replace function public.arolix_has_financial_access(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = p_user_id
      and (
        public.arolix_has_paid_access(p_user_id)
        or (
          lower(coalesce(p.plano, 'free')) = 'free'
          and p.trial_started_at is not null
          and p.trial_started_at + interval '5 days' > now()
        )
      )
  );
$$;

create or replace function public.arolix_has_investment_access(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = p_user_id
      and lower(coalesce(p.plano, 'free')) = 'vip'
      and lower(coalesce(p.subscription_status, 'inactive')) = 'active'
      and (p.subscription_ends_at is null or p.subscription_ends_at > now())
      and (p.plano_expira_em is null or p.plano_expira_em > now())
  );
$$;

create or replace function public.arolix_enforce_plan_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := coalesce(new.user_id, (select auth.uid()));
  end if;

  if v_user_id is null then
    raise exception 'Nao foi possivel identificar o usuario para validar o plano.';
  end if;

  if (select auth.uid()) is not null and v_user_id is distinct from (select auth.uid()) then
    raise exception 'Usuario nao autorizado para este registro.';
  end if;

  if tg_table_name in ('investimentos', 'investimento_resgates') then
    if not public.arolix_has_investment_access(v_user_id) then
      raise exception 'Investimentos e CVM estao disponiveis apenas no plano VIP.';
    end if;
  elsif not public.arolix_has_financial_access(v_user_id) then
    raise exception 'Seu periodo gratuito terminou. Assine o plano Pro para continuar usando o Arolix.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'contas_bancarias',
    'categorias',
    'receitas',
    'despesas',
    'movimentacoes',
    'transferencias',
    'cartoes_credito',
    'cartao_faturas',
    'cartao_lancamentos',
    'investimentos',
    'investimento_resgates'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists enforce_plan_limits_%I on public.%I', table_name, table_name);
      execute format(
        'create trigger enforce_plan_limits_%I before insert or update or delete on public.%I for each row execute function public.arolix_enforce_plan_limits()',
        table_name,
        table_name
      );
    end if;
  end loop;
end;
$$;

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
  if jwt_role = 'service_role' then
    return new;
  end if;

  if db_role in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.plano is distinct from old.plano
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_ends_at is distinct from old.subscription_ends_at
    or new.plano_expira_em is distinct from old.plano_expira_em
    or new.trial_started_at is distinct from old.trial_started_at then
    raise exception 'Plan fields can only be changed by the backend or an admin';
  end if;

  return new;
end;
$$;

revoke update on table public.user_profiles from anon, authenticated;
grant update (nome, avatar_url, cpf, whatsapp, telefone, cidade, estado, onboarding_completed, updated_at)
  on table public.user_profiles to authenticated;

revoke execute on function public.arolix_has_paid_access(uuid) from public, anon;
revoke execute on function public.arolix_has_premium_access(uuid) from public, anon;
revoke execute on function public.arolix_has_financial_access(uuid) from public, anon;
revoke execute on function public.arolix_has_investment_access(uuid) from public, anon;
revoke execute on function public.arolix_enforce_plan_limits() from public, anon, authenticated;
revoke execute on function public.prevent_client_plan_changes() from public, anon, authenticated;

grant execute on function public.arolix_has_paid_access(uuid) to authenticated, service_role;
grant execute on function public.arolix_has_premium_access(uuid) to authenticated, service_role;
grant execute on function public.arolix_has_financial_access(uuid) to authenticated, service_role;
grant execute on function public.arolix_has_investment_access(uuid) to authenticated, service_role;
grant execute on function public.arolix_enforce_plan_limits() to service_role;
grant execute on function public.prevent_client_plan_changes() to service_role;

commit;
