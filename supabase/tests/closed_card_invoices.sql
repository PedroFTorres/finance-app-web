-- Run in an empty, disposable PostgreSQL database (not the live project).
\set ON_ERROR_STOP on
create role anon;
create role authenticated;

create table public.cartao_faturas (
  user_id text not null, cartao_id text not null, ano integer not null,
  mes integer not null, status text not null, pago boolean not null,
  valor_total numeric(12,2) not null,
  primary key (user_id, cartao_id, ano, mes)
);
create table public.cartao_lancamentos (
  user_id text not null, cartao_id text not null, data_fatura date not null,
  tipo text, valor numeric(12,2) not null, despesa_id text
);
grant select, insert, update on public.cartao_faturas, public.cartao_lancamentos to authenticated;
alter table public.cartao_faturas enable row level security;
alter table public.cartao_lancamentos enable row level security;
create policy own_invoices on public.cartao_faturas to authenticated using (user_id = 'owner');
create policy own_purchases on public.cartao_lancamentos to authenticated using (user_id = 'owner');

insert into public.cartao_faturas values
  ('owner', 'card', 2026, 11, 'fechada', false, 100),
  ('owner', 'card', 2026, 12, 'paga', true, 100),
  ('other', 'other-card', 2026, 11, 'fechada', false, 100);

\ir ../migrations/20261108204425_guard_closed_card_invoices.sql

set role authenticated;
do $test$
begin
  begin
    insert into public.cartao_lancamentos values ('owner','card','2026-11-19','compra',10,null);
    raise exception 'closed invoice accepted purchase';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'AROLIX_FATURA_BLOQUEADA' then raise; end if;
  end;

  begin
    insert into public.cartao_lancamentos values
      ('owner','card','2027-01-01','compra',10,null),
      ('owner','card','2026-12-01','compra',10,null);
    raise exception 'paid invoice accepted purchase';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'AROLIX_FATURA_BLOQUEADA' then raise; end if;
  end;
  if exists (select 1 from public.cartao_lancamentos) then
    raise exception 'part of the rejected batch was inserted';
  end if;

  insert into public.cartao_lancamentos values ('owner','card','2026-11-01','pagamento',-10,'payment');
  update public.cartao_faturas set valor_total = 90, status = 'fechada' where mes = 11;
  update public.cartao_faturas set status = 'aberta' where mes = 11;
  insert into public.cartao_lancamentos values ('owner','card','2026-11-01','compra',100,null);
  insert into public.cartao_lancamentos values ('owner','another-card','2026-12-01','compra',25,null);

  begin
    update public.cartao_lancamentos set data_fatura = '2026-12-01'
    where cartao_id = 'card' and tipo = 'compra';
    raise exception 'paid invoice accepted moved purchase';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'AROLIX_FATURA_BLOQUEADA' then raise; end if;
  end;

  begin
    update public.cartao_faturas set status = 'fechada', valor_total = 80 where mes = 11;
    raise exception 'stale total accepted at closing';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'AROLIX_TOTAL_FATURA_ALTERADO' then raise; end if;
  end;

  update public.cartao_faturas set status = 'fechada', valor_total = 90 where mes = 11;
  insert into public.cartao_faturas values ('owner','another-card',2026,12,'fechada',false,25);
  if (select count(*) from public.cartao_lancamentos) <> 3 then
    raise exception 'unexpected number of persisted rows';
  end if;
end;
$test$;
reset role;
