begin;

-- Keep the existing RLS policies in effect; neither trigger needs elevated access.
create or replace function public.arolix_guard_card_purchase_invoice()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.cartao_id is null or new.data_fatura is null then
    return new;
  end if;

  -- Use the same transaction lock as invoice closing, including months
  -- for which there is not yet a cartao_faturas row to lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('arolix:cartao-fatura:' || new.cartao_id::text, 0)
  );

  -- An actual payment/abatement is not a new purchase. Keep the existing
  -- partial-payment workflow available on a closed, unpaid invoice.
  if new.tipo = 'pagamento' and new.valor < 0 and new.despesa_id is not null then
    return new;
  end if;

  if exists (
    select 1 from public.cartao_faturas f
    where f.user_id = new.user_id
      and f.cartao_id = new.cartao_id
      and f.ano = extract(year from new.data_fatura)
      and f.mes = extract(month from new.data_fatura)
      and (f.pago is true or pg_catalog.lower(pg_catalog.btrim(f.status::text)) in ('fechada', 'paga'))
  ) then
    raise sqlstate 'PT409' using message = 'AROLIX_FATURA_BLOQUEADA';
  end if;

  return new;
end;
$$;

create or replace function public.arolix_check_invoice_total_on_close()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inicio date;
  total_atual numeric;
begin
  if new.status::text is distinct from 'fechada' or new.pago is true then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- Do not interfere with payment adjustments or reopening/cancelling a payment.
    if old.pago is true or pg_catalog.lower(pg_catalog.btrim(old.status::text)) in ('fechada', 'paga') then
      return new;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('arolix:cartao-fatura:' || new.cartao_id::text, 0)
  );
  inicio := pg_catalog.make_date(new.ano, new.mes, 1);
  select coalesce(sum(l.valor), 0) into total_atual
  from public.cartao_lancamentos l
  where l.user_id = new.user_id
    and l.cartao_id = new.cartao_id
    and l.data_fatura >= inicio
    and l.data_fatura < inicio + interval '1 month';

  -- The browser reads the total before sending the close. If a purchase
  -- won the lock and committed meanwhile, reject the stale total.
  if pg_catalog.round(total_atual, 2) is distinct from pg_catalog.round(new.valor_total::numeric, 2) then
    raise sqlstate 'PT409' using message = 'AROLIX_TOTAL_FATURA_ALTERADO';
  end if;

  return new;
end;
$$;

revoke execute on function public.arolix_guard_card_purchase_invoice() from public, anon, authenticated;
revoke execute on function public.arolix_check_invoice_total_on_close() from public, anon, authenticated;

create trigger arolix_guard_card_purchase_invoice
  before insert or update of cartao_id, data_fatura, tipo, valor on public.cartao_lancamentos
  for each row execute function public.arolix_guard_card_purchase_invoice();

create trigger arolix_check_invoice_total_on_close
  before insert or update of status on public.cartao_faturas
  for each row execute function public.arolix_check_invoice_total_on_close();

commit;
