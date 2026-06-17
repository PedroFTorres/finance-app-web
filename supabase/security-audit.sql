-- Supabase security audit for Arolix
-- Run this file in Supabase SQL Editor and review every result set.
-- Expected goal: no exposed table without RLS, no broad user-data policies, and no public write access.

-- 1) Public tables and RLS status.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2) Policies currently configured.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Tables exposed in public without RLS. This should return zero rows.
select
  n.nspname as schema_name,
  c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and coalesce(c.relrowsecurity, false) = false
order by c.relname;

-- 4) Broad policies that usually need manual review.
-- Some log/config tables can be exceptions, but user financial data should not appear here.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and (
    qual in ('true', '(true)')
    or with_check in ('true', '(true)')
    or roles::text like '%anon%'
  )
order by tablename, policyname;

-- 5) Policies for common user-owned tables that do not mention auth.uid().
-- Review anything returned here, especially financial data, profiles, and subscription tables.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in (
    'contas_bancarias',
    'receitas',
    'despesas',
    'movimentacoes',
    'movimentos',
    'categorias',
    'cartoes_credito',
    'cartao_faturas',
    'cartao_lancamentos',
    'transferencias',
    'user_profiles',
    'subscription_events'
  )
  and coalesce(qual, '') not ilike '%auth.uid()%'
  and coalesce(with_check, '') not ilike '%auth.uid()%'
order by tablename, policyname;

-- 6) Grants that allow direct public writes. This should return zero rows.
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'public')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, grantee, privilege_type;

-- 7) Plan distribution sanity check.
-- The app expects exactly these plan values: free, pro, vip.
select
  plano,
  subscription_status,
  count(*) as total
from public.user_profiles
group by plano, subscription_status
order by plano, subscription_status;

-- 8) Invalid plan values. This should return zero rows.
select
  id,
  plano,
  subscription_status
from public.user_profiles
where coalesce(plano, '') not in ('free', 'pro', 'vip')
   or (
    plano in ('pro', 'vip')
    and coalesce(subscription_status, '') not in ('active', 'past_due', 'canceled', 'inactive')
   );
