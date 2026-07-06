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
  produto_grupo_id uuid,
  nome text not null,
  instituicao text,
  cnpj_emissor text,
  valor_aplicado numeric(14,2) not null check (valor_aplicado > 0),
  data_aplicacao date not null,
  data_vencimento date,
  percentual_cdi numeric(8,4) not null default 100,
  cdi_anual_referencia numeric(8,4) not null default 0,
  liquidez text not null default 'diaria',
  data_carencia date,
  dias_carencia integer,
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
  constraint investimentos_dias_carencia_check check (dias_carencia is null or dias_carencia >= 0),
  constraint investimentos_status_check check (status in ('ativo', 'resgatado', 'cancelado'))
);

create index if not exists investimentos_user_id_idx
  on public.investimentos(user_id);

create index if not exists investimentos_user_status_idx
  on public.investimentos(user_id, status);

create index if not exists investimentos_data_aplicacao_idx
  on public.investimentos(user_id, data_aplicacao);

create index if not exists investimentos_produto_grupo_idx
  on public.investimentos(user_id, produto_grupo_id);

create table if not exists public.investimento_resgates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investimento_id uuid not null references public.investimentos(id) on delete cascade,
  produto_grupo_id uuid not null,
  data_resgate date not null,
  valor_bruto_solicitado numeric(14,2) not null check (valor_bruto_solicitado > 0),
  valor_principal_resgatado numeric(14,2) not null check (valor_principal_resgatado > 0),
  rendimento_bruto numeric(14,2) not null default 0,
  iof numeric(14,2) not null default 0,
  ir numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) not null check (valor_liquido >= 0),
  conta_destino_id uuid references public.contas_bancarias(id) on delete set null,
  transferencia_id uuid references public.transferencias(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists investimento_resgates_user_idx
  on public.investimento_resgates(user_id);

create index if not exists investimento_resgates_investimento_idx
  on public.investimento_resgates(user_id, investimento_id);

create index if not exists investimento_resgates_produto_grupo_idx
  on public.investimento_resgates(user_id, produto_grupo_id);

alter table public.investimentos enable row level security;
alter table public.investimento_resgates enable row level security;

drop policy if exists investimentos_owner_all on public.investimentos;
create policy investimentos_owner_all
  on public.investimentos
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists investimento_resgates_owner_all on public.investimento_resgates;
create policy investimento_resgates_owner_all
  on public.investimento_resgates
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete
  on table public.investimentos to authenticated;

grant select, insert, update, delete
  on table public.investimento_resgates to authenticated;

commit;
