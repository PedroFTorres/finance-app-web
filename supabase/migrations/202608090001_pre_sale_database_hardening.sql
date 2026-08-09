begin;

-- Pre-sale hardening: keep browser roles on the smallest useful surface.
-- RLS still owns row-level access; these grants remove broad table powers that
-- client roles do not need, such as TRUNCATE, TRIGGER and REFERENCES.
revoke all on table
  public.contas_bancarias,
  public.categorias,
  public.receitas,
  public.despesas,
  public.movimentacoes,
  public.transferencias,
  public.cartoes_credito,
  public.cartao_faturas,
  public.cartao_lancamentos,
  public.investimentos,
  public.investimento_resgates,
  public.movimentos,
  public.user_profiles,
  public.subscription_events
from anon;

revoke truncate, trigger, references on table
  public.contas_bancarias,
  public.categorias,
  public.receitas,
  public.despesas,
  public.movimentacoes,
  public.transferencias,
  public.cartoes_credito,
  public.cartao_faturas,
  public.cartao_lancamentos,
  public.investimentos,
  public.investimento_resgates,
  public.movimentos,
  public.user_profiles
from authenticated;

grant select, insert, update, delete on table
  public.contas_bancarias,
  public.categorias,
  public.receitas,
  public.despesas,
  public.movimentacoes,
  public.transferencias,
  public.cartoes_credito,
  public.cartao_faturas,
  public.cartao_lancamentos,
  public.investimentos,
  public.investimento_resgates
to authenticated;

revoke all on table public.subscription_events from authenticated;
grant select on table public.user_profiles to authenticated;
revoke insert, update, delete on table public.user_profiles from authenticated;
grant update (nome, avatar_url, cpf, onboarding_completed, updated_at)
  on table public.user_profiles to authenticated;

-- The legacy movimentos table is empty and not used by the app, but keep it
-- locked if it remains in the schema.
alter table public.movimentos enable row level security;
drop policy if exists movimentos_no_client_access on public.movimentos;
create policy movimentos_no_client_access
  on public.movimentos as restrictive
  for all to authenticated
  using (false)
  with check (false);

-- Replace older permissive policies that called auth.uid() directly. The
-- restrictive owner guards stay in place as defense in depth.
drop policy if exists contas_bancarias_owner_all on public.contas_bancarias;
create policy contas_bancarias_owner_all
  on public.contas_bancarias
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists categorias_owner_all on public.categorias;
create policy categorias_owner_all
  on public.categorias
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists receitas_owner_all on public.receitas;
create policy receitas_owner_all
  on public.receitas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists despesas_owner_all on public.despesas;
create policy despesas_owner_all
  on public.despesas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists movimentacoes_owner_all on public.movimentacoes;
create policy movimentacoes_owner_all
  on public.movimentacoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists transferencias_owner_all on public.transferencias;
create policy transferencias_owner_all
  on public.transferencias
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartoes_credito_owner_all on public.cartoes_credito;
create policy cartoes_credito_owner_all
  on public.cartoes_credito
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartao_faturas_owner_all on public.cartao_faturas;
create policy cartao_faturas_owner_all
  on public.cartao_faturas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists cartao_lancamentos_owner_all on public.cartao_lancamentos;
create policy cartao_lancamentos_owner_all
  on public.cartao_lancamentos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
  on public.user_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
  on public.user_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Optimize MFA restrictive policies to avoid per-row auth.jwt() calls.
drop policy if exists contas_bancarias_aal2_guard on public.contas_bancarias;
create policy contas_bancarias_aal2_guard
  on public.contas_bancarias as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists categorias_aal2_guard on public.categorias;
create policy categorias_aal2_guard
  on public.categorias as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists receitas_aal2_guard on public.receitas;
create policy receitas_aal2_guard
  on public.receitas as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists despesas_aal2_guard on public.despesas;
create policy despesas_aal2_guard
  on public.despesas as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists movimentacoes_aal2_guard on public.movimentacoes;
create policy movimentacoes_aal2_guard
  on public.movimentacoes as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists transferencias_aal2_guard on public.transferencias;
create policy transferencias_aal2_guard
  on public.transferencias as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists cartoes_credito_aal2_guard on public.cartoes_credito;
create policy cartoes_credito_aal2_guard
  on public.cartoes_credito as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists cartao_faturas_aal2_guard on public.cartao_faturas;
create policy cartao_faturas_aal2_guard
  on public.cartao_faturas as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

drop policy if exists cartao_lancamentos_aal2_guard on public.cartao_lancamentos;
create policy cartao_lancamentos_aal2_guard
  on public.cartao_lancamentos as restrictive
  for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

-- Foreign-key indexes recommended before adding more users.
create index if not exists idx_cartao_faturas_cartao_id on public.cartao_faturas(cartao_id);
create index if not exists idx_cartao_faturas_user_id on public.cartao_faturas(user_id);
create index if not exists idx_cartao_lancamentos_cartao_id on public.cartao_lancamentos(cartao_id);
create index if not exists idx_cartao_lancamentos_user_id on public.cartao_lancamentos(user_id);
create index if not exists idx_cartoes_credito_user_id on public.cartoes_credito(user_id);
create index if not exists idx_categorias_user_id on public.categorias(user_id);
create index if not exists idx_contas_bancarias_user_id on public.contas_bancarias(user_id);
create index if not exists idx_despesas_cartao_fatura_id on public.despesas(cartao_fatura_id);
create index if not exists idx_despesas_categoria_id on public.despesas(categoria_id);
create index if not exists idx_despesas_conta_id on public.despesas(conta_id);
create index if not exists idx_despesas_user_id on public.despesas(user_id);
create index if not exists idx_investimento_resgates_conta_destino_id on public.investimento_resgates(conta_destino_id);
create index if not exists idx_investimento_resgates_investimento_id on public.investimento_resgates(investimento_id);
create index if not exists idx_investimento_resgates_transferencia_id on public.investimento_resgates(transferencia_id);
create index if not exists idx_investimento_resgates_user_id on public.investimento_resgates(user_id);
create index if not exists idx_investimentos_conta_investimento_id on public.investimentos(conta_investimento_id);
create index if not exists idx_investimentos_conta_origem_id on public.investimentos(conta_origem_id);
create index if not exists idx_investimentos_transferencia_id on public.investimentos(transferencia_id);
create index if not exists idx_investimentos_user_id on public.investimentos(user_id);
create index if not exists idx_movimentacoes_conta_id on public.movimentacoes(conta_id);
create index if not exists idx_movimentacoes_user_id on public.movimentacoes(user_id);
create index if not exists idx_receitas_categoria_id on public.receitas(categoria_id);
create index if not exists idx_receitas_conta_id on public.receitas(conta_id);
create index if not exists idx_receitas_user_id on public.receitas(user_id);
create index if not exists idx_transferencias_conta_destino on public.transferencias(conta_destino);
create index if not exists idx_transferencias_conta_origem on public.transferencias(conta_origem);
create index if not exists idx_transferencias_user_id on public.transferencias(user_id);

commit;
