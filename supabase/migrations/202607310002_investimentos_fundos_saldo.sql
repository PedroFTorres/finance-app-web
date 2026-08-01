begin;

alter table public.investimentos
  add column if not exists saldo_atual_informado numeric(14,2);

alter table public.investimentos
  drop constraint if exists investimentos_saldo_atual_informado_check;

alter table public.investimentos
  add constraint investimentos_saldo_atual_informado_check
  check (saldo_atual_informado is null or saldo_atual_informado >= 0);

comment on column public.investimentos.saldo_atual_informado is
  'Saldo atual do fundo informado pelo usuario para estimar rendimento.';

commit;
