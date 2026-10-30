const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const actions=require('../payment-actions');
test('cancelamento parcial envia a identidade do movimento, sem buscar pelo lancamento_id nulo',async()=>{
  let call;
  const client={rpc:async(name,args)=>{call={name,args};return {data:{restante:633.33},error:null};}};
  assert.deepEqual(await actions.change(client,{tipo:'despesa',item:{id:'mov',baixa_parcial:true},action:'cancelar'}),{restante:633.33});
  assert.deepEqual(call,{name:'arolix_corrigir_baixa',args:{p_tipo:'despesa',p_id:'mov',p_parcial:true,p_acao:'cancelar',p_patch:{}}});
});
test('edicao de baixa total usa uma unica chamada e propaga erros, sem sucesso falso',async()=>{
  const error={message:'Operacao nao autorizada'};
  await assert.rejects(actions.change({rpc:async()=>({error})},{tipo:'receita',item:{id:'income'},action:'editar',patch:{valor:100}}),e=>e===error);
  const result=await actions.context({rpc:async(name,args)=>({data:{name,args}})},'movement');
  assert.equal(result.name,'arolix_contexto_baixa_parcial');
  assert.equal(result.args.p_movimento_id,'movement');
});
test('migration usa isolamento por usuario, MFA e operacoes atomicas sem reescrever historico na instalacao',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261030233543_payment_corrections_atomic.sql'),'utf8');
  assert.doesNotMatch(sql,/security definer/i);
  assert.match(sql,/security invoker/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/aal2/);
  assert.match(sql,/for update/);
  assert.match(sql,/user_id=v_user/);
  assert.match(sql,/jsonb_array_length\(v_candidates\),0\) <> 1/);
  assert.match(sql,/from public,anon/);
  assert.match(sql,/v_mov\.valor - v_mov\.baixa_parcial_ajuste/);
});
