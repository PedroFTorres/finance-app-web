-- Partial settlements keep their own movement identity, separate from final settlement.
-- No historical amount, date, category or balance is rewritten by this migration.
alter table public.movimentacoes
  add column if not exists baixa_parcial_lancamento_id uuid,
  add column if not exists baixa_parcial_ajuste numeric not null default 0;
create index if not exists movimentacoes_partial_origin_idx
  on public.movimentacoes(user_id,baixa_parcial_lancamento_id)
  where baixa_parcial_lancamento_id is not null;
comment on column public.movimentacoes.baixa_parcial_lancamento_id is
  'Owned receita/despesa ID; tipo credito/debito determines its table. Not the final-settlement lancamento_id.';

create or replace function public.arolix_contexto_baixa_parcial(p_movimento_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  v_user uuid := (select auth.uid()); v_mov public.movimentacoes%rowtype;
  v_table text; v_original jsonb; v_candidates jsonb; v_description text;
begin
  if v_user is null or coalesce((select auth.jwt()->>'aal'),'') <> 'aal2' then
    raise exception 'Confirme a verificacao em duas etapas.';
  end if;
  select * into v_mov from public.movimentacoes where id=p_movimento_id and user_id=v_user;
  if not found or v_mov.lancamento_id is not null or v_mov.transferencia_id is not null
    or (v_mov.baixa_parcial_lancamento_id is null and v_mov.descricao not ilike '%(Baixa parcial,%') then
    raise exception 'Pagamento parcial nao encontrado.';
  end if;
  v_table := case when v_mov.tipo='credito' then 'receitas' else 'despesas' end;
  if v_mov.baixa_parcial_lancamento_id is not null then
    execute format('select to_jsonb(l) from public.%I l where id=$1 and user_id=$2',v_table)
      into v_original using v_mov.baixa_parcial_lancamento_id,v_user;
  else
    -- Legacy records: only an exact, unique description is accepted. Never guess by amount.
    v_description := btrim(split_part(v_mov.descricao,' (Baixa parcial,',1));
    execute format('select jsonb_agg(to_jsonb(l)) from public.%I l where user_id=$1 and descricao=$2',v_table)
      into v_candidates using v_user,v_description;
    if coalesce(jsonb_array_length(v_candidates),0) <> 1 then
      raise exception 'Nao foi possivel identificar com seguranca o lancamento original desta baixa parcial. Nenhum valor foi alterado.';
    end if;
    v_original := v_candidates->0;
  end if;
  if v_original is null then raise exception 'Lancamento original nao encontrado. Nenhum valor foi alterado.'; end if;
  return jsonb_build_object('movimento',to_jsonb(v_mov),'lancamento',v_original,
    'tipo',case when v_mov.tipo='credito' then 'receita' else 'despesa' end);
end;
$$;

create or replace function public.arolix_corrigir_baixa(
  p_tipo text,p_id uuid,p_parcial boolean,p_acao text,p_patch jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_user uuid := (select auth.uid()); v_table text; v_id uuid; v_context jsonb; v_original jsonb;
  v_mov public.movimentacoes%rowtype; v_count integer; v_amount numeric; v_remaining numeric;
  v_principal numeric; v_account uuid; v_category uuid; v_date date; v_description text;
begin
  if v_user is null or coalesce((select auth.jwt()->>'aal'),'') <> 'aal2' then
    raise exception 'Confirme a verificacao em duas etapas.';
  end if;
  if p_tipo is null or p_tipo not in ('receita','despesa') or p_acao is null
    or p_acao not in ('editar','cancelar') or p_parcial is null then raise exception 'Operacao invalida.'; end if;
  v_table := case when p_tipo='receita' then 'receitas' else 'despesas' end;
  -- Serialize repeated requests, including double clicks on different payment rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,913));
  if p_parcial then
    select * into v_mov from public.movimentacoes where id=p_id and user_id=v_user for update;
    if not found then raise exception 'Esta baixa parcial ja foi cancelada ou nao existe mais.'; end if;
    v_context := public.arolix_contexto_baixa_parcial(p_id);
    if v_context->>'tipo' <> p_tipo then raise exception 'Tipo do pagamento incorreto.'; end if;
    v_id := (v_context->'lancamento'->>'id')::uuid;
  else
    v_id := p_id;
    select count(*) into v_count from public.movimentacoes where lancamento_id=v_id and user_id=v_user;
    if v_count <> 1 then raise exception 'O pagamento precisa ter uma unica movimentacao vinculada para corrigir com seguranca. Nenhum valor foi alterado.'; end if;
    select * into v_mov from public.movimentacoes where lancamento_id=v_id and user_id=v_user for update;
    if v_mov.tipo <> (case when p_tipo='receita' then 'credito' else 'debito' end) then raise exception 'Tipo do pagamento incorreto.'; end if;
  end if;
  execute format('select to_jsonb(l) from public.%I l where id=$1 and user_id=$2 for update',v_table)
    into v_original using v_id,v_user;
  if v_original is null then raise exception 'Lancamento original nao encontrado.'; end if;
  if p_parcial and coalesce((v_original->>'baixado')::boolean,false) then
    raise exception 'O restante ja foi quitado. Cancele primeiro a baixa final antes de alterar este pagamento parcial.';
  end if;
  if p_parcial and v_mov.baixa_parcial_lancamento_id is null and (v_mov.descricao like '%(+Juros%' or v_mov.descricao like '%(-Desc%') then
    raise exception 'Baixa parcial antiga com juros ou desconto precisa de revisao antes de alterar. Nenhum valor foi alterado.';
  end if;
  if not p_parcial and coalesce((v_original->>'cartao_pagamento_parcial')::boolean,false) then
    raise exception 'Altere o pagamento parcial da fatura pelo modulo de cartoes.';
  end if;
  if not p_parcial and not coalesce((v_original->>'baixado')::boolean,false) then raise exception 'Este lancamento nao esta baixado.'; end if;
  if p_acao='cancelar' then
    if p_parcial then
      v_remaining := round((v_original->>'valor')::numeric + v_mov.valor - v_mov.baixa_parcial_ajuste,2);
      if v_remaining<=0 then raise exception 'Saldo restante inconsistente. Nenhum valor foi alterado.'; end if;
      execute format('update public.%I set valor=$1 where id=$2 and user_id=$3',v_table)
        using v_remaining,v_id,v_user;
    else
      execute format('update public.%I set baixado=false,data_baixa=null,comprovantes=''[]''::jsonb,comprovante_path=null,comprovante_nome=null,comprovante_uploaded_at=null where id=$1 and user_id=$2',v_table)
        using v_id,v_user;
      if p_tipo='despesa' and v_original->>'cartao_fatura_id' is not null then
        update public.cartao_faturas set pago=false,status='fechada' where id=(v_original->>'cartao_fatura_id')::uuid and user_id=v_user;
      end if;
    end if;
    delete from public.movimentacoes where id=v_mov.id and user_id=v_user;
    return jsonb_build_object('original_id',v_id,'acao','cancelar','restante',v_remaining);
  end if;
  if v_original->>'cartao_fatura_id' is not null or coalesce((v_original->>'cartao_pagamento_parcial')::boolean,false) then
    raise exception 'Edite esta fatura pelo modulo de cartoes.';
  end if;
  v_amount := round((p_patch->>'valor')::numeric,2); v_account := (p_patch->>'conta_id')::uuid;
  v_category := nullif(p_patch->>'categoria_id','')::uuid; v_date := (p_patch->>'data')::date;
  v_description := btrim(p_patch->>'descricao');
  if v_amount is null or v_amount<=0 or v_amount::text in ('NaN','Infinity','-Infinity') or v_date is null or v_description is null or length(v_description)=0 then raise exception 'Informe descricao, data e valor positivo.'; end if;
  if not exists(select 1 from public.contas_bancarias where id=v_account and user_id=v_user and coalesce(tipo_conta,'corrente')<>'investimento') then raise exception 'Escolha uma conta de pagamento sua, que nao seja investimento.'; end if;
  if v_category is not null and not exists(select 1 from public.categorias where id=v_category and user_id=v_user) then raise exception 'Categoria invalida.'; end if;
  if p_parcial then
    v_remaining := round((v_original->>'valor')::numeric + v_mov.valor - v_amount,2);
    if v_remaining<=0 then raise exception 'O pagamento parcial precisa deixar saldo em aberto. Para quitar, use Baixar no lancamento restante.'; end if;
    execute format('update public.%I set valor=$1,descricao=$2,categoria_id=$3 where id=$4 and user_id=$5',v_table)
      using v_remaining,v_description,v_category,v_id,v_user;
    update public.movimentacoes set valor=v_amount,conta_id=v_account,data=v_date,
      descricao=v_description||' (Baixa parcial, restante '||v_remaining::text||')',baixa_parcial_lancamento_id=v_id
      where id=v_mov.id and user_id=v_user;
  else
    -- Preserve recorded interest/discount: the form edits the amount actually paid.
    v_principal := round(v_amount-(v_mov.valor-(v_original->>'valor')::numeric),2);
    if v_principal<=0 then raise exception 'Valor incompatível com os juros ou descontos registrados.'; end if;
    execute format('update public.%I set valor=$1,descricao=$2,categoria_id=$3,conta_id=$4,data_baixa=$5 where id=$6 and user_id=$7',v_table)
      using v_principal,v_description,v_category,v_account,v_date,v_id,v_user;
    update public.movimentacoes set valor=v_amount,conta_id=v_account,data=v_date,descricao=v_description where id=v_mov.id and user_id=v_user;
  end if;
  return jsonb_build_object('original_id',v_id,'acao','editar','restante',v_remaining);
end;
$$;
revoke all on function public.arolix_contexto_baixa_parcial(uuid) from public,anon;
revoke all on function public.arolix_corrigir_baixa(text,uuid,boolean,text,jsonb) from public,anon;
grant execute on function public.arolix_contexto_baixa_parcial(uuid) to authenticated;
grant execute on function public.arolix_corrigir_baixa(text,uuid,boolean,text,jsonb) to authenticated;
