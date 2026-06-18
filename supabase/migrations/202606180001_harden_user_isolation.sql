begin;

-- Defense in depth: every authenticated request must own the affected row,
-- even if another permissive policy is accidentally created later.
alter table public.contas_bancarias enable row level security;
alter table public.categorias enable row level security;
alter table public.receitas enable row level security;
alter table public.despesas enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.transferencias enable row level security;
alter table public.cartoes_credito enable row level security;
alter table public.cartao_faturas enable row level security;
alter table public.cartao_lancamentos enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists contas_bancarias_owner_guard on public.contas_bancarias;
create policy contas_bancarias_owner_guard
  on public.contas_bancarias as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists categorias_owner_guard on public.categorias;
create policy categorias_owner_guard
  on public.categorias as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists receitas_owner_guard on public.receitas;
create policy receitas_owner_guard
  on public.receitas as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists despesas_owner_guard on public.despesas;
create policy despesas_owner_guard
  on public.despesas as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists movimentacoes_owner_guard on public.movimentacoes;
create policy movimentacoes_owner_guard
  on public.movimentacoes as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists transferencias_owner_guard on public.transferencias;
create policy transferencias_owner_guard
  on public.transferencias as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartoes_credito_owner_guard on public.cartoes_credito;
create policy cartoes_credito_owner_guard
  on public.cartoes_credito as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartao_faturas_owner_guard on public.cartao_faturas;
create policy cartao_faturas_owner_guard
  on public.cartao_faturas as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartao_lancamentos_owner_guard on public.cartao_lancamentos;
create policy cartao_lancamentos_owner_guard
  on public.cartao_lancamentos as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_profiles_owner_guard on public.user_profiles;
create policy user_profiles_owner_guard
  on public.user_profiles as restrictive
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Profiles are created by the auth trigger. Browser clients may edit only
-- personal presentation/onboarding fields, never subscription entitlements.
revoke insert on table public.user_profiles from anon, authenticated;
revoke update on table public.user_profiles from anon, authenticated;
grant update (nome, avatar_url, cpf, onboarding_completed, updated_at)
  on table public.user_profiles to authenticated;

-- Event payloads and subscription state are backend-only.
revoke all on table public.subscription_events from anon, authenticated;

commit;
