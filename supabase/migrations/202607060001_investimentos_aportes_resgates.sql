begin;

alter table public.investimentos
  add column if not exists produto_grupo_id uuid;

update public.investimentos
set produto_grupo_id = id
where produto_grupo_id is null;

create index if not exists investimentos_produto_grupo_idx
  on public.investimentos(user_id, produto_grupo_id);

comment on column public.investimentos.produto_grupo_id is
  'Identificador usado para agrupar vários aportes dentro do mesmo produto CDB.';

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

alter table public.investimento_resgates enable row level security;

drop policy if exists investimento_resgates_owner_all on public.investimento_resgates;
create policy investimento_resgates_owner_all
  on public.investimento_resgates
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete
  on table public.investimento_resgates to authenticated;

commit;
