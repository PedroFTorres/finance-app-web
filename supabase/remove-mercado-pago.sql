-- Remove legacy Mercado Pago database objects.
-- Run this only after confirming the app no longer uses Mercado Pago.

-- Old payment event log table used by the removed Mercado Pago webhook.
drop table if exists public.mercadopago_payment_events cascade;

-- Verification: this should return zero rows.
select
  schemaname,
  tablename
from pg_tables
where schemaname = 'public'
  and tablename ilike '%mercado%';
