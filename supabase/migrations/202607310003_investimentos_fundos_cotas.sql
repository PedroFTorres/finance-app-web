begin;

alter table public.investimentos
  add column if not exists cota_inicial numeric(20,10),
  add column if not exists cota_atual numeric(20,10);

alter table public.investimentos
  drop constraint if exists investimentos_cota_inicial_check;

alter table public.investimentos
  add constraint investimentos_cota_inicial_check
  check (cota_inicial is null or cota_inicial > 0);

alter table public.investimentos
  drop constraint if exists investimentos_cota_atual_check;

alter table public.investimentos
  add constraint investimentos_cota_atual_check
  check (cota_atual is null or cota_atual > 0);

comment on column public.investimentos.cota_inicial is
  'Valor da cota do fundo na data da aplicacao, consultado na CVM ou informado manualmente.';

comment on column public.investimentos.cota_atual is
  'Ultimo valor de cota do fundo usado para estimar rentabilidade.';

commit;
