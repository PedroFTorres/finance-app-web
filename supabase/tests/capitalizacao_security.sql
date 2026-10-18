-- Integração sem persistência: somente registros temporários do novo módulo.
begin;
select set_config('request.jwt.claims', json_build_object('sub', p.id, 'role', 'authenticated', 'aal', 'aal2')::text, true)
from public.user_profiles p where public.arolix_has_financial_access(p.id) limit 1;
set local role authenticated;
do $test$
declare tid uuid := gen_random_uuid(); owner_id uuid := auth.uid(); expense_id uuid; rid uuid;
begin
  if owner_id is null then raise exception 'Fixture exige um perfil com acesso financeiro ativo'; end if;
  insert into public.capitalizacao_titulos(id,user_id,nome,inicio_vigencia,fim_vigencia,prazo_meses,valor_parcela,dia_cobranca)
    values(tid,owner_id,'Teste transacional',current_date,current_date + interval '4 years',48,100,16);
  if (select count(*) from public.capitalizacao_titulos where id=tid) <> 1 then raise exception 'Dono não conseguiu ler'; end if;
  update public.capitalizacao_titulos set nome='Teste editado' where id=tid;
  if (select nome from public.capitalizacao_titulos where id=tid) <> 'Teste editado' then raise exception 'Dono não conseguiu editar'; end if;
  select d.id into expense_id from public.despesas d where d.user_id=owner_id and d.cartao_fatura_id is null and not coalesce(d.cartao_pagamento_parcial,false) and d.valor>0
    and not exists(select 1 from public.capitalizacao_pagamentos p where p.despesa_id=d.id) limit 1;
  if expense_id is not null then
    insert into public.capitalizacao_pagamentos(user_id,titulo_id,despesa_id) values(owner_id,tid,expense_id);
    begin
      insert into public.capitalizacao_pagamentos(user_id,titulo_id,despesa_id) values(owner_id,tid,expense_id);
      raise exception 'Permitiu contar uma parcela duas vezes';
    exception when unique_violation then null; end;
  end if;
  select r.id into rid from public.receitas r where r.user_id=owner_id and r.valor>0
    and not exists(select 1 from public.capitalizacao_recebimentos p where p.receita_id=r.id) limit 1;
  if rid is not null then
    insert into public.capitalizacao_recebimentos(user_id,titulo_id,receita_id,tipo) values(owner_id,tid,rid,'premio');
  end if;
  begin
    insert into public.capitalizacao_pagamentos(user_id,titulo_id,despesa_id) values(owner_id,tid,gen_random_uuid());
    raise exception 'Permitiu vincular fonte não pertencente ao dono';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.capitalizacao_titulos(user_id,nome,inicio_vigencia,fim_vigencia,prazo_meses,valor_parcela,dia_cobranca)
      values(gen_random_uuid(),'Dono forjado',current_date,current_date + interval '1 year',12,100,16);
    raise exception 'Permitiu forjar proprietário';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated','aal','aal1')::text,true);
  if exists(select 1 from public.capitalizacao_titulos where id=tid) then raise exception 'AAL1 conseguiu ler'; end if;
  begin
    insert into public.capitalizacao_titulos(user_id,nome,inicio_vigencia,fim_vigencia,prazo_meses,valor_parcela,dia_cobranca)
      values(owner_id,'Sem MFA',current_date,current_date + interval '1 year',12,100,16);
    raise exception 'AAL1 conseguiu inserir';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated','aal','aal2')::text,true);
  if exists(select 1 from public.capitalizacao_titulos where id=tid) or exists(select 1 from public.capitalizacao_pagamentos where titulo_id=tid)
    or exists(select 1 from public.capitalizacao_recebimentos where titulo_id=tid) then raise exception 'Outro usuário conseguiu ler'; end if;
  update public.capitalizacao_titulos set nome='Ataque' where id=tid;
  if found then raise exception 'Outro usuário conseguiu editar'; end if;
  delete from public.capitalizacao_titulos where id=tid;
  if found then raise exception 'Outro usuário conseguiu excluir'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated','aal','aal2')::text,true);
  delete from public.capitalizacao_titulos where id=tid;
  if not found then raise exception 'Dono não conseguiu excluir'; end if;
  if exists(select 1 from public.capitalizacao_pagamentos where titulo_id=tid) or exists(select 1 from public.capitalizacao_recebimentos where titulo_id=tid) then raise exception 'Vínculos não foram removidos em cascata'; end if;
  if expense_id is not null and not exists(select 1 from public.despesas where id=expense_id) then raise exception 'Exclusão apagou despesa original'; end if;
  if rid is not null and not exists(select 1 from public.receitas where id=rid) then raise exception 'Exclusão apagou receita original'; end if;
end;
$test$;
reset role;
set local role anon;
do $test$
begin
  begin
    perform 1 from public.capitalizacao_titulos;
    raise exception 'Anônimo conseguiu ler';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
select 'Capitalização: RLS, MFA, propriedade, duplicidade e cascata aprovados' as resultado;
rollback;
