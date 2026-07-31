begin;

alter table public.investimentos
  add column if not exists cota_inicial numeric(18,8),
  add column if not exists cota_atual numeric(18,8);

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
  'Valor da cota do fundo na data do aporte.';

comment on column public.investimentos.cota_atual is
  'Ultima cota informada para calcular fundos em cotas.';

commit;
