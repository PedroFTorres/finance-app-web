begin;

alter table public.user_profiles
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_last_payment_id text,
  add column if not exists subscription_provider text,
  add column if not exists subscription_started_at timestamptz;

create unique index if not exists user_profiles_asaas_customer_id_uidx
  on public.user_profiles (asaas_customer_id)
  where asaas_customer_id is not null;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  event_id text,
  provider_event_id text not null,
  event_type text not null,
  user_id uuid references public.user_profiles(id) on delete set null,
  customer_id text,
  payment_id text,
  subscription_id text,
  external_reference text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscription_events
  add column if not exists provider text not null default 'asaas',
  add column if not exists event_id text,
  add column if not exists provider_event_id text,
  add column if not exists event_type text,
  add column if not exists user_id uuid references public.user_profiles(id) on delete set null,
  add column if not exists customer_id text,
  add column if not exists payment_id text,
  add column if not exists subscription_id text,
  add column if not exists external_reference text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists processed_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists subscription_events_provider_event_uidx
  on public.subscription_events (provider, provider_event_id);

create index if not exists subscription_events_user_id_idx
  on public.subscription_events (user_id);

create index if not exists subscription_events_payment_id_idx
  on public.subscription_events (payment_id)
  where payment_id is not null;

alter table public.subscription_events enable row level security;
revoke all on table public.subscription_events from anon, authenticated;
grant all on table public.subscription_events to service_role;

revoke update on table public.user_profiles from anon, authenticated;
grant update (nome, avatar_url, cpf, whatsapp, telefone, cidade, estado, onboarding_completed, updated_at)
  on table public.user_profiles to authenticated;

commit;
