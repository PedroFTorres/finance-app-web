-- Integration checks: only synthetic rows, all discarded by ROLLBACK.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated','aal','aal2')::text,true)
from auth.users where email='pedrofernandot@gmail.com';
set local role authenticated;
do $$
declare
  u uuid:=auth.uid(); a uuid; c uuid; d uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
  d2 uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid(); result jsonb; n numeric; flag boolean;
  label text:='__AROLIX_ROLLBACK_PAYMENT_TEST__'||gen_random_uuid()::text;
begin
  if u is null then raise exception 'Test user unavailable'; end if;
  select id into a from public.contas_bancarias where user_id=u and coalesce(tipo_conta,'corrente')<>'investimento' limit 1;
  select id into c from public.categorias where user_id=u limit 1;
  if a is null or c is null then raise exception 'Test account/category unavailable'; end if;
  insert into public.despesas(id,user_id,descricao,valor,data,conta_id,categoria_id,baixado)
    values(d,u,label,122.60,'2026-11-01',a,c,false);
  insert into public.movimentacoes(id,user_id,descricao,valor,data,conta_id,tipo)
    values(m,u,label||' (Baixa parcial, restante R$ 122,60)',510.73,'2026-10-30',a,'debito');
  result:=public.arolix_contexto_baixa_parcial(m);
  if (result->'lancamento'->>'id')::uuid<>d then raise exception 'Legacy unique origin not resolved'; end if;
  perform public.arolix_corrigir_baixa('despesa',m,true,'editar',jsonb_build_object('descricao',label,'valor',500,'data','2026-10-29','conta_id',a,'categoria_id',c));
  select valor into n from public.despesas where id=d;
  if n<>133.33 then raise exception 'Partial edit remaining: %',n; end if;
  select to_jsonb(x) into result from public.movimentacoes x where id=m;
  if (result->>'valor')::numeric<>500 or (result->>'baixa_parcial_lancamento_id')::uuid<>d or result->>'data'<>'2026-10-29' then raise exception 'Partial movement not updated'; end if;
  flag:=false;
  begin
    perform public.arolix_corrigir_baixa('despesa',m,true,'editar',jsonb_build_object('descricao',label,'valor',700,'data','2026-10-29','conta_id',a,'categoria_id',c));
  exception when others then flag:=true; end;
  if not flag or (select valor from public.despesas where id=d)<>133.33 then raise exception 'Invalid edit was not rolled back'; end if;
  perform public.arolix_corrigir_baixa('despesa',m,true,'cancelar');
  if (select valor from public.despesas where id=d)<>633.33 or exists(select 1 from public.movimentacoes where id=m) then raise exception 'Partial cancellation failed'; end if;
  flag:=false;
  begin perform public.arolix_corrigir_baixa('despesa',m,true,'cancelar'); exception when others then flag:=true; end;
  if not flag or (select valor from public.despesas where id=d)<>633.33 then raise exception 'Repeated cancellation changed value'; end if;

  -- Explicit partial linkage and interest adjustment are restored correctly.
  update public.despesas set valor=80 where id=d;
  insert into public.movimentacoes(id,user_id,descricao,valor,data,conta_id,tipo,baixa_parcial_lancamento_id,baixa_parcial_ajuste)
    values(m,u,label||' (Baixa parcial, restante 80)',30,'2026-10-30',a,'debito',d,10);
  perform public.arolix_corrigir_baixa('despesa',m,true,'cancelar');
  if (select valor from public.despesas where id=d)<>100 then raise exception 'Partial interest restored incorrectly'; end if;

  insert into public.receitas(id,user_id,descricao,valor,data,conta_id,categoria_id,baixado)
    values(d2,u,label,70,'2026-11-01',a,c,false);
  insert into public.movimentacoes(id,user_id,descricao,valor,data,conta_id,tipo,baixa_parcial_lancamento_id)
    values(m2,u,label||' (Baixa parcial, restante 70)',30,'2026-10-30',a,'credito',d2);
  perform public.arolix_corrigir_baixa('receita',m2,true,'editar',jsonb_build_object('descricao',label,'valor',10,'data','2026-10-30','conta_id',a,'categoria_id',c));
  if (select valor from public.receitas where id=d2)<>90 then raise exception 'Partial income edit failed'; end if;
  perform public.arolix_corrigir_baixa('receita',m2,true,'cancelar');
  if (select valor from public.receitas where id=d2)<>100 then raise exception 'Partial income cancellation failed'; end if;

  update public.despesas set valor=100,baixado=true,data_baixa='2026-10-02' where id=d;
  insert into public.movimentacoes(id,user_id,descricao,valor,data,conta_id,tipo,lancamento_id)
    values(m,u,label,105.30,'2026-10-02',a,'debito',d);
  perform public.arolix_corrigir_baixa('despesa',d,false,'editar',jsonb_build_object('descricao',label,'valor',110.30,'data','2026-10-03','conta_id',a,'categoria_id',c));
  if (select valor from public.despesas where id=d)<>105 or (select data from public.despesas where id=d)<>'2026-11-01'::date
    or (select data_baixa from public.despesas where id=d)<>'2026-10-03'::date or (select valor from public.movimentacoes where id=m)<>110.30 then raise exception 'Full edit failed to preserve due date/interest'; end if;
  perform public.arolix_corrigir_baixa('despesa',d,false,'cancelar');
  if (select baixado from public.despesas where id=d) or exists(select 1 from public.movimentacoes where id=m) then raise exception 'Full cancellation failed'; end if;

  -- Ambiguous legacy descriptions never select an arbitrary original.
  insert into public.despesas(id,user_id,descricao,valor,data,conta_id,categoria_id,baixado)
    values(gen_random_uuid(),u,label,30,'2026-11-01',a,c,false);
  insert into public.movimentacoes(id,user_id,descricao,valor,data,conta_id,tipo)
    values(m,u,label||' (Baixa parcial, restante 30)',20,'2026-10-30',a,'debito');
  flag:=false;
  begin perform public.arolix_contexto_baixa_parcial(m); exception when others then flag:=true; end;
  if not flag then raise exception 'Ambiguous legacy origin accepted'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1')::text,true);
  flag:=false;
  begin perform public.arolix_contexto_baixa_parcial(m); exception when others then flag:=true; end;
  if not flag then raise exception 'MFA check bypassed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','aal','aal2')::text,true);
  flag:=false;
  begin perform public.arolix_corrigir_baixa('despesa',m,true,'cancelar'); exception when others then flag:=true; end;
  if not flag then raise exception 'Owner isolation bypassed'; end if;
end;
$$;
reset role;
select 'PASS: partial expense/income, legacy lookup, explicit link, adjustments, full payment, repeated cancellation, invalid edit, ambiguity, MFA, owner isolation. All rows rolled back.' as result;
rollback;
