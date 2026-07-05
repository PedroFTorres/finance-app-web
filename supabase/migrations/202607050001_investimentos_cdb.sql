begin;

-- Tipo da conta: corrente para uso diário, investimento para separar patrimônio aplicado.
alter table public.contas_bancarias
  add column if not exists tipo_conta text not null default 'corrente';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contas_bancarias_tipo_conta_check'
  ) then
    alter table public.contas_bancarias
      add constraint contas_bancarias_tipo_conta_check
      check (tipo_conta in ('corrente', 'investimento'));
  end if;
end $$;

create table if not exists public.investimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null default 'cdb',
  indexador text not null default 'cdi',
  nome text not null,
  instituicao text,
  cnpj_emissor text,
  valor_aplicado numeric(14,2) not null check (valor_aplicado > 0),
  data_aplicacao date not null,
  data_vencimento date,
  percentual_cdi numeric(8,4) not null default 100,
  cdi_anual_referencia numeric(8,4) not null default 0,
  liquidez text not null default 'diaria',
  conta_origem_id uuid references public.contas_bancarias(id) on delete set null,
  conta_investimento_id uuid references public.contas_bancarias(id) on delete set null,
  transferencia_id uuid references public.transferencias(id) on delete set null,
  observacoes text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investimentos_tipo_check check (tipo in ('cdb')),
  constraint investimentos_indexador_check check (indexador in ('cdi')),
  constraint investimentos_liquidez_check check (liquidez in ('diaria', 'vencimento', 'carencia')),
  constraint investimentos_status_check check (status in ('ativo', 'resgatado', 'cancelado'))
);

create index if not exists investimentos_user_id_idx
  on public.investimentos(user_id);

create index if not exists investimentos_user_status_idx
  on public.investimentos(user_id, status);

create index if not exists investimentos_data_aplicacao_idx
  on public.investimentos(user_id, data_aplicacao);

alter table public.investimentos enable row level security;

drop policy if exists investimentos_owner_all on public.investimentos;
create policy investimentos_owner_all
  on public.investimentos
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete
  on table public.investimentos to authenticated;

commit;
