const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = require('../runtime-utils');
const { buildBalance } = require('../reports-rules');
const source=fs.readFileSync(path.join(__dirname,'../reports.js'),'utf8');
const flow=source.slice(source.indexOf('  async function fetchData('),source.indexOf('  function renderTable('));
const options={start:'2026-10-01',end:'2026-10-31',overdue:false};
function setup(partial=false){
  const tables={receitas:[],despesas:[{id:'paid',user_id:'owner',categoria_id:'card',cartao_fatura_id:partial?null:'old',cartao_pagamento_parcial:partial,valor:partial?100:300,baixado:true,data:'2025-12-20',data_baixa:'2026-10-10',conta_id:'bank'}],
    movimentacoes:[{id:'mov',user_id:'owner',lancamento_id:'paid',tipo:'debito',valor:partial?100:300,data:'2026-10-10',conta_id:'bank'}],
    cartao_faturas:[{id:'old',user_id:'owner',ano:2025,mes:12,cartao_id:'cc',status:'paga',pago:true}],cartoes_credito:[{id:'cc',user_id:'owner',dia_vencimento:20}],
    cartao_lancamentos:[{id:'gym',user_id:'owner',cartao_id:'cc',categoria_id:'gym',valor:240,data_fatura:'2025-12-01',tipo:'compra'},
      {id:'food',user_id:'owner',cartao_id:'cc',categoria_id:'food',valor:60,data_fatura:'2025-12-01',tipo:'compra'},
      {id:'foreign',user_id:'other',cartao_id:'cc',categoria_id:'gym',valor:999999,data_fatura:'2025-12-01',tipo:'compra'}]};
  if(partial)tables.cartao_lancamentos.push({id:'marker',user_id:'owner',cartao_id:'cc',despesa_id:'paid',tipo:'pagamento',valor:-100,data_fatura:'2025-12-01'});
  const queries=[];
  const client={from(table){const filters=[],scope={table,conditions:[]};return {
    select(){return this;},order(){return this;},range(){return this;},eq(k,v){filters.push(r=>r[k]===v);scope.conditions.push([k,v]);return this;},
    neq(k,v){filters.push(r=>r[k]!==v);return this;},gte(k,v){filters.push(r=>r[k]>=v);return this;},lte(k,v){filters.push(r=>r[k]<=v);return this;},in(k,v){filters.push(r=>v.includes(r[k]));return this;},
    then(resolve){queries.push(scope);return Promise.resolve({data:(tables[table]||[]).filter(r=>filters.every(f=>f(r))),error:null}).then(resolve);}
  };}};
  const ctx=vm.createContext({Date,Number,String,Map,Set,Array,window:{supabase:client,ArolixRuntime:runtime,STATE:{user:{id:'owner'},categorias:[{id:'gym',nome:'Academia'},{id:'food',nome:'Alimentação'},{id:'card',nome:'Cartão de Crédito'}],contas:[{id:'bank',nome:'Banco'}]}}});
  vm.runInContext(flow,ctx);return {ctx,queries};
}
test('consulta resolve a fatura de outro ano e busca suas compras antes do rateio',async()=>{
  const f=setup();const data=await f.ctx.fetchData(options);
  assert.equal(data.invoices.length,1);assert.equal(data.purchases.length,2);
  const b=buildBalance(data,options);assert.equal(b.pagos,300);assert.equal(b.groups.find(g=>g.id==='gym').pagos,240);
  assert.ok(f.queries.every(q=>q.conditions.some(([k,v])=>k==='user_id'&&v==='owner')));
});
test('consulta resolve parcial pela despesa_id sem adivinhar qual cartão foi pago',async()=>{
  const f=setup(true);const data=await f.ctx.fetchData(options);
  assert.equal(data.purchases.length,3);const b=buildBalance(data,options);
  assert.equal(b.pagos,100);assert.equal(b.groups.find(g=>g.id==='gym').pagos,80);assert.equal(b.groups.find(g=>g.id==='food').pagos,20);
});
