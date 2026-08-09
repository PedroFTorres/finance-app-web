begin;

create or replace function public.arolix_has_premium_access(p_user_id uuid)
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

create or replace function public.arolix_enforce_plan_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid;
  v_receitas_count integer := 0;
  v_despesas_count integer := 0;
begin
  v_user_id := coalesce(new.user_id, (select auth.uid()));

  if v_user_id is null then
    raise exception 'Nao foi possivel identificar o usuario para validar o plano.';
  end if;

  if (select auth.uid()) is not null and v_user_id is distinct from (select auth.uid()) then
    raise exception 'Usuario nao autorizado para este registro.';
  end if;

  if public.arolix_has_premium_access(v_user_id) then
    return new;
  end if;

  if tg_table_name = 'contas_bancarias' then
    if (
      select count(*)
      from public.contas_bancarias c
      where c.user_id = v_user_id
    ) >= 2 then
      raise exception 'Plano Free permite ate 2 contas.';
    end if;

  elsif tg_table_name = 'cartoes_credito' then
    raise exception 'Cartao disponivel apenas no plano PRO.';

  elsif tg_table_name in ('receitas', 'despesas') then
    select count(*) into v_receitas_count
    from public.receitas r
    where r.user_id = v_user_id;

    select count(*) into v_despesas_count
    from public.despesas d
    where d.user_id = v_user_id;

    if (v_receitas_count + v_despesas_count) >= 50 then
      raise exception 'Plano Free permite ate 50 lancamentos.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_plan_limits_contas on public.contas_bancarias;
create trigger enforce_plan_limits_contas
before insert on public.contas_bancarias
for each row
execute function public.arolix_enforce_plan_limits();

drop trigger if exists enforce_plan_limits_receitas on public.receitas;
create trigger enforce_plan_limits_receitas
before insert on public.receitas
for each row
execute function public.arolix_enforce_plan_limits();

drop trigger if exists enforce_plan_limits_despesas on public.despesas;
create trigger enforce_plan_limits_despesas
before insert on public.despesas
for each row
execute function public.arolix_enforce_plan_limits();

drop trigger if exists enforce_plan_limits_cartoes on public.cartoes_credito;
create trigger enforce_plan_limits_cartoes
before insert on public.cartoes_credito
for each row
execute function public.arolix_enforce_plan_limits();

revoke execute on function public.arolix_has_premium_access(uuid) from public, anon;
grant execute on function public.arolix_has_premium_access(uuid) to authenticated, service_role;

revoke execute on function public.arolix_enforce_plan_limits() from public, anon, authenticated;
grant execute on function public.arolix_enforce_plan_limits() to service_role;

commit;
