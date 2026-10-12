begin;

create policy investimentos_aal2_guard on public.investimentos
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
create policy investimento_resgates_aal2_guard on public.investimento_resgates
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

create or replace function public.arolix_transferir(
  p_id uuid, p_origem uuid, p_destino uuid, p_valor numeric,
  p_data date, p_descricao text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_existing public.transferencias%rowtype;
  v_count integer;
begin
  if v_user is null or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2' then
    raise exception 'Confirme a verificacao em duas etapas.';
  end if;
  if p_id is null or p_origem is null or p_destino is null or p_origem = p_destino
    or p_data is null or p_valor is null or p_valor <= 0
    or p_valor::text in ('NaN', 'Infinity', '-Infinity') or p_valor <> round(p_valor, 2) then
    raise exception 'Dados invalidos para transferencia.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_existing from public.transferencias where id = p_id and user_id = v_user;
  if found then
    if v_existing.conta_origem = p_origem and v_existing.conta_destino = p_destino
      and v_existing.valor = p_valor and v_existing.data = p_data then
      return p_id;
    end if;
    raise exception 'Identificador de transferencia ja utilizado.';
  end if;
  perform id from public.contas_bancarias
    where user_id = v_user and id in (p_origem, p_destino) order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> 2 then raise exception 'Contas de transferencia nao encontradas.'; end if;
  insert into public.transferencias(id,user_id,conta_origem,conta_destino,valor,data,descricao)
    values(p_id,v_user,p_origem,p_destino,p_valor,p_data,p_descricao);
  insert into public.movimentacoes(id,user_id,conta_id,tipo,valor,data,descricao,transferencia_id)
    values
      (gen_random_uuid(),v_user,p_origem,'debito',p_valor,p_data,'Transferência enviada — ' || coalesce(p_descricao,''),p_id),
      (gen_random_uuid(),v_user,p_destino,'credito',p_valor,p_data,'Transferência recebida — ' || coalesce(p_descricao,''),p_id);
  return p_id;
end;
$$;

create or replace function public.arolix_excluir_transferencia(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null or coalesce((select auth.jwt()->>'aal'), '') <> 'aal2' then
    raise exception 'Confirme a verificacao em duas etapas.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  if exists (select 1 from public.investimentos where transferencia_id = p_id and user_id = v_user)
    or exists (select 1 from public.investimento_resgates where transferencia_id = p_id and user_id = v_user) then
    raise exception 'Esta transferencia pertence a um investimento. Use o modulo de investimentos.';
  end if;
  if not exists (select 1 from public.transferencias where id = p_id and user_id = v_user) then
    raise exception 'Transferencia nao encontrada.';
  end if;
  delete from public.movimentacoes where transferencia_id = p_id and user_id = v_user;
  delete from public.transferencias where id = p_id and user_id = v_user;
end;
$$;

-- The event and subscription change commit together. Failed delivery can retry.
create or replace function public.arolix_processar_evento_asaas(
  p_event_id text, p_user_id uuid, p_payload jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_event text := p_payload->>'event';
  v_payment jsonb := coalesce(p_payload->'payment', '{}'::jsonb);
  v_subscription jsonb := coalesce(p_payload->'subscription', '{}'::jsonb);
  v_payment_id text := v_payment->>'id';
  v_profile public.user_profiles%rowtype;
  v_processed timestamptz;
  v_event_row uuid;
  v_started timestamptz;
begin
  if p_event_id is null or p_user_id is null then raise exception 'Evento sem usuario ou identificador.'; end if;
  select * into strict v_profile from public.user_profiles where id = p_user_id for update;
  insert into public.subscription_events(provider,event_id,provider_event_id,event_type,user_id,
    customer_id,payment_id,subscription_id,external_reference,payload,processed_at)
    values('asaas',p_event_id,p_event_id,v_event,p_user_id,
      coalesce(v_payment->>'customer',v_subscription->>'customer'),v_payment_id,
      coalesce(v_payment->>'subscription',v_subscription->>'id'),
      coalesce(v_payment->>'externalReference',v_subscription->>'externalReference'),p_payload,now())
    on conflict (provider,provider_event_id) do nothing returning id into v_event_row;
  if v_event_row is null then
    select processed_at into v_processed from public.subscription_events
      where provider='asaas' and provider_event_id=p_event_id for update;
    if v_processed is not null then return false; end if;
  end if;
  if v_event in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED') then
    if v_payment_id is null then raise exception 'Pagamento sem identificador.'; end if;
    v_started := coalesce(nullif(v_payment->>'paymentDate','')::timestamptz,
      nullif(v_payment->>'confirmedDate','')::timestamptz, now());
    if coalesce(v_profile.plano,'free') <> 'vip'
      and v_profile.asaas_last_payment_id is distinct from v_payment_id
      and (v_profile.subscription_started_at is null or v_started >= v_profile.subscription_started_at) then
      update public.user_profiles set plano='pro', subscription_status='active',
        subscription_provider='asaas', subscription_started_at=v_started,
        subscription_ends_at=v_started + interval '30 days', plano_expira_em=v_started + interval '30 days',
        asaas_last_payment_id=v_payment_id,
        asaas_subscription_id=coalesce(v_payment->>'subscription',v_subscription->>'id'), updated_at=now()
      where id=p_user_id;
    end if;
  elsif v_event in ('PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_REFUND_RECEIVED',
    'PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL') then
    -- A refund/overdue event for an older invoice must not revoke a newer plan.
    update public.user_profiles set subscription_status='past_due', updated_at=now()
      where id=p_user_id and plano='pro' and asaas_last_payment_id=v_payment_id;
  end if;
  update public.subscription_events set processed_at=now()
    where provider='asaas' and provider_event_id=p_event_id;
  return true;
end;
$$;

revoke all on function public.arolix_transferir(uuid,uuid,uuid,numeric,date,text) from public, anon;
revoke all on function public.arolix_excluir_transferencia(uuid) from public, anon;
grant execute on function public.arolix_transferir(uuid,uuid,uuid,numeric,date,text) to authenticated;
grant execute on function public.arolix_excluir_transferencia(uuid) to authenticated;
revoke all on function public.arolix_processar_evento_asaas(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.arolix_processar_evento_asaas(text,uuid,jsonb) to service_role;

commit;
