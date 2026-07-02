begin;

-- Require an MFA-verified session (AAL2) for all financial application data.
-- The profile table intentionally remains outside this guard so a signed-in
-- user can still open perfil.html and enroll MFA before using the app.

drop policy if exists contas_bancarias_aal2_guard on public.contas_bancarias;
create policy contas_bancarias_aal2_guard
  on public.contas_bancarias as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists categorias_aal2_guard on public.categorias;
create policy categorias_aal2_guard
  on public.categorias as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists receitas_aal2_guard on public.receitas;
create policy receitas_aal2_guard
  on public.receitas as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists despesas_aal2_guard on public.despesas;
create policy despesas_aal2_guard
  on public.despesas as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists movimentacoes_aal2_guard on public.movimentacoes;
create policy movimentacoes_aal2_guard
  on public.movimentacoes as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists transferencias_aal2_guard on public.transferencias;
create policy transferencias_aal2_guard
  on public.transferencias as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists cartoes_credito_aal2_guard on public.cartoes_credito;
create policy cartoes_credito_aal2_guard
  on public.cartoes_credito as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists cartao_faturas_aal2_guard on public.cartao_faturas;
create policy cartao_faturas_aal2_guard
  on public.cartao_faturas as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists cartao_lancamentos_aal2_guard on public.cartao_lancamentos;
create policy cartao_lancamentos_aal2_guard
  on public.cartao_lancamentos as restrictive
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

commit;
