begin;

alter table public.investimentos
  add column if not exists data_carencia date,
  add column if not exists dias_carencia integer;

alter table public.investimentos
  drop constraint if exists investimentos_dias_carencia_check;

alter table public.investimentos
  add constraint investimentos_dias_carencia_check
  check (dias_carencia is null or dias_carencia >= 0);

comment on column public.investimentos.data_carencia is
  'Data a partir da qual o CDB com carência pode ser resgatado.';

comment on column public.investimentos.dias_carencia is
  'Quantidade de dias de carência informada no cadastro do CDB.';

commit;
