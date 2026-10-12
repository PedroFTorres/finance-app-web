-- Integration assertions. Every synthetic record is rolled back.
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id from public.user_profiles where plano='vip' and subscription_status='active' limit 1),
  'role', 'authenticated', 'aal', 'aal2'
)::text, true);
-- Temporarily give the selected test profile an unexpired date inside this
-- rollback-only transaction, so production subscription dates do not affect it.
update public.user_profiles set subscription_ends_at=now()+interval '1 day',
  plano_expira_em=now()+interval '1 day' where id=(current_setting('request.jwt.claims')::jsonb->>'sub')::uuid;
set local role authenticated;
do $$
declare
  origin_id uuid := gen_random_uuid();
  destination_id uuid := gen_random_uuid();
  transfer_id uuid := gen_random_uuid();
  failed boolean := false;
  count_rows integer;
begin
  if auth.uid() is null then raise exception 'A VIP test user is required.'; end if;
  insert into public.contas_bancarias(id,user_id,nome,saldo_inicial,saldo_atual,data_saldo,tipo_conta)
    values(origin_id,auth.uid(),'AUDIT_ORIGIN',0,0,current_date,'corrente'),
      (destination_id,auth.uid(),'AUDIT_DESTINATION',0,0,current_date,'corrente');
  perform public.arolix_transferir(transfer_id,origin_id,destination_id,30,current_date,'AUDIT_TEST');
  perform public.arolix_transferir(transfer_id,origin_id,destination_id,30,current_date,'AUDIT_TEST');
  select count(*) into count_rows from public.movimentacoes where transferencia_id=transfer_id;
  if count_rows <> 2 then raise exception 'Retry created duplicate movements.'; end if;
  if (select sum(case when tipo='credito' then valor else -valor end)
    from public.movimentacoes where transferencia_id=transfer_id) <> 0 then
    raise exception 'Transfer balance is not zero.';
  end if;
  begin
    perform public.arolix_transferir(gen_random_uuid(),origin_id,gen_random_uuid(),30,current_date,'INVALID_ACCOUNT');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'Invalid account was accepted.'; end if;
  if (select count(*) from public.transferencias where conta_origem=origin_id) <> 1 then
    raise exception 'Failed transfer left a partial record.';
  end if;
  perform public.arolix_excluir_transferencia(transfer_id);
  if exists(select 1 from public.movimentacoes where transferencia_id=transfer_id)
    or exists(select 1 from public.transferencias where id=transfer_id) then
    raise exception 'Transfer removal left orphan records.';
  end if;
end;
$$;
select set_config('request.jwt.claims', jsonb_set(current_setting('request.jwt.claims')::jsonb, '{aal}', '"aal1"')::text, true);
do $$
begin
  if exists(select 1 from public.investimentos) or exists(select 1 from public.investimento_resgates) then
    raise exception 'Investment data was exposed without MFA.';
  end if;
end;
$$;
reset role;
do $$
declare
  test_user uuid := (current_setting('request.jwt.claims')::jsonb->>'sub')::uuid;
  event_key text := 'AUDIT_EVENT_' || gen_random_uuid()::text;
  payload jsonb;
  failed boolean := false;
begin
  update public.user_profiles set plano='free',subscription_status='inactive',
    subscription_started_at=null,asaas_last_payment_id=null where id=test_user;
  payload := jsonb_build_object('event','PAYMENT_CONFIRMED','payment',jsonb_build_object(
    'id','AUDIT_PAYMENT','paymentDate',current_date::text));
  if not public.arolix_processar_evento_asaas(event_key,test_user,payload) then raise exception 'First event did not process.'; end if;
  if public.arolix_processar_evento_asaas(event_key,test_user,payload) then raise exception 'Duplicate event reprocessed.'; end if;
  if not exists(select 1 from public.user_profiles where id=test_user and plano='pro' and subscription_status='active') then
    raise exception 'Paid event did not activate Pro.';
  end if;
  begin
    perform public.arolix_processar_evento_asaas(event_key || '_INVALID',test_user,
      jsonb_set(payload,'{payment,paymentDate}','"invalid"'));
  exception when others then failed:=true;
  end;
  if not failed then raise exception 'Invalid event was accepted.'; end if;
  if exists(select 1 from public.subscription_events where provider_event_id=event_key || '_INVALID') then
    raise exception 'Failed event was incorrectly saved as processed.';
  end if;
end;
$$;
rollback;
