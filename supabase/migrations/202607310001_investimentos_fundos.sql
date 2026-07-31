alter table public.investimentos
  add column if not exists classe_fundo text,
  add column if not exists administrador text;

alter table public.investimentos
  drop constraint if exists investimentos_tipo_check;

alter table public.investimentos
  add constraint investimentos_tipo_check
  check (tipo in ('cdb', 'fundo_investimento'));

alter table public.investimentos
  drop constraint if exists investimentos_indexador_check;

alter table public.investimentos
  add constraint investimentos_indexador_check
  check (indexador in ('cdi', 'manual'));

comment on column public.investimentos.classe_fundo is
  'Classe informada para fundos de investimento, como Renda Fixa Simples.';

comment on column public.investimentos.administrador is
  'Administrador, gestor ou instituição responsável informada no cadastro do fundo.';
