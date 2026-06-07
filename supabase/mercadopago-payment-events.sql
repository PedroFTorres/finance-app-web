create table if not exists public.mercadopago_payment_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payment_id text,
  event_type text not null,
  status text,
  external_reference uuid,
  amount numeric,
  expected_amount numeric,
  raw_payload jsonb,
  error_message text
);

alter table public.mercadopago_payment_events enable row level security;

drop policy if exists "service role can manage mercado pago payment events"
  on public.mercadopago_payment_events;

create policy "service role can manage mercado pago payment events"
  on public.mercadopago_payment_events
  for all
  to service_role
  using (true)
  with check (true);
