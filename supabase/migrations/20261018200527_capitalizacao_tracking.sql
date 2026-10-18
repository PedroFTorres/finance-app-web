begin;

-- O legado usa uma PK composta em receitas. O vínculo pelo UUID exige sua
-- unicidade isolada; não altera nenhum valor ou identificador existente.
create unique index if not exists receitas_id_cap_link_idx on public.receitas(id);

-- Acompanhamento somente: nenhuma dessas tabelas movimenta saldo bancário.
create table public.capitalizacao_titulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 160),
  instituicao text not null default 'Santander' check (char_length(instituicao) <= 160),
  numero_titulo text check (char_length(numero_titulo) <= 80),
  numero_proposta text check (char_length(numero_proposta) <= 80),
  numero_sorte text check (char_length(numero_sorte) <= 80),
  processo_susep text check (char_length(processo_susep) <= 80),
  inicio_vigencia date not null,
  fim_vigencia date not null,
  prazo_meses integer not null check (prazo_meses between 1 and 600),
  valor_parcela numeric(14,2) not null check (valor_parcela > 0),
  dia_cobranca integer not null check (dia_cobranca between 1 and 31),
  reajuste text not null default 'nao_informado' check (reajuste in ('igpm_anual','nao_informado')),
  regra_resgate text not null default 'nao_informada' check (regra_resgate in ('nao_informada','raspa48_662222_2024')),
  valor_resgate_banco numeric(14,2) check (valor_resgate_banco >= 0),
  data_consulta_resgate date,
  status text not null default 'ativo' check (status in ('ativo','encerrado')),
  observacoes text check (char_length(observacoes) <= 2000),
  created_at timestamptz not null default now(),
  check (fim_vigencia > inicio_vigencia),
  check ((valor_resgate_banco is null) = (data_consulta_resgate is null)),
  check (regra_resgate <> 'raspa48_662222_2024' or
    (prazo_meses = 48 and processo_susep = '15414.662222/2024-10'))
);
create index capitalizacao_titulos_owner_idx on public.capitalizacao_titulos(user_id);
create unique index capitalizacao_titulos_numero_idx on public.capitalizacao_titulos(user_id, numero_titulo)
  where numero_titulo is not null and btrim(numero_titulo) <> '';

create table public.capitalizacao_pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo_id uuid not null references public.capitalizacao_titulos(id) on delete cascade,
  despesa_id uuid unique references public.despesas(id) on delete cascade,
  cartao_lancamento_id uuid unique references public.cartao_lancamentos(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(despesa_id,cartao_lancamento_id) = 1)
);
create index capitalizacao_pagamentos_owner_idx on public.capitalizacao_pagamentos(user_id);
create index capitalizacao_pagamentos_titulo_idx on public.capitalizacao_pagamentos(titulo_id);

create table public.capitalizacao_recebimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo_id uuid not null references public.capitalizacao_titulos(id) on delete cascade,
  receita_id uuid not null unique references public.receitas(id) on delete cascade,
  tipo text not null check (tipo in ('premio','resgate')),
  created_at timestamptz not null default now()
);
create index capitalizacao_recebimentos_owner_idx on public.capitalizacao_recebimentos(user_id);
create index capitalizacao_recebimentos_titulo_idx on public.capitalizacao_recebimentos(titulo_id);

alter table public.capitalizacao_titulos enable row level security;
alter table public.capitalizacao_pagamentos enable row level security;
alter table public.capitalizacao_recebimentos enable row level security;
revoke all on public.capitalizacao_titulos, public.capitalizacao_pagamentos, public.capitalizacao_recebimentos from public, anon, authenticated;
grant select, insert, update, delete on public.capitalizacao_titulos to authenticated;
grant select, insert, delete on public.capitalizacao_pagamentos, public.capitalizacao_recebimentos to authenticated;

create policy capitalizacao_titulos_owner on public.capitalizacao_titulos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy capitalizacao_pagamentos_select on public.capitalizacao_pagamentos for select to authenticated
  using (user_id = (select auth.uid()));
create policy capitalizacao_pagamentos_delete on public.capitalizacao_pagamentos for delete to authenticated
  using (user_id = (select auth.uid()));
create policy capitalizacao_pagamentos_insert on public.capitalizacao_pagamentos for insert to authenticated
  with check (
    user_id = (select auth.uid()) and
    exists (select 1 from public.capitalizacao_titulos t where t.id = titulo_id and t.user_id = (select auth.uid())) and
    ((despesa_id is not null and exists (select 1 from public.despesas d
       where d.id = despesa_id and d.user_id = (select auth.uid()) and d.cartao_fatura_id is null
         and not coalesce(d.cartao_pagamento_parcial,false) and d.valor > 0)) or
     (cartao_lancamento_id is not null and exists (select 1 from public.cartao_lancamentos c
       where c.id = cartao_lancamento_id and c.user_id = (select auth.uid()) and c.valor > 0
         and coalesce(c.tipo,'compra') = 'compra')))
  );
create policy capitalizacao_recebimentos_select on public.capitalizacao_recebimentos for select to authenticated
  using (user_id = (select auth.uid()));
create policy capitalizacao_recebimentos_delete on public.capitalizacao_recebimentos for delete to authenticated
  using (user_id = (select auth.uid()));
create policy capitalizacao_recebimentos_insert on public.capitalizacao_recebimentos for insert to authenticated
  with check (user_id = (select auth.uid()) and
    exists (select 1 from public.capitalizacao_titulos t where t.id = titulo_id and t.user_id = (select auth.uid())) and
    exists (select 1 from public.receitas r where r.id = receita_id and r.user_id = (select auth.uid()) and r.valor > 0));

-- Guardas restritivas se somam às políticas de propriedade, sem SECURITY DEFINER.
do $policies$
declare tbl text;
begin
  foreach tbl in array array['capitalizacao_titulos','capitalizacao_pagamentos','capitalizacao_recebimentos'] loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated
      using ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select public.arolix_has_financial_access(auth.uid())))
      with check ((select auth.jwt() ->> ''aal'') = ''aal2'' and (select public.arolix_has_financial_access(auth.uid())))',
      tbl || '_access_guard', tbl);
  end loop;
end;
$policies$;
notify pgrst, 'reload schema';
commit;
