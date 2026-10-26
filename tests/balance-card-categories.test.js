const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBalance } = require('../reports-rules');
const options = { start:'2026-10-01',end:'2026-10-31' };
const categories=[{id:'gym',nome:'Academia'},{id:'food',nome:'Alimentação'},{id:'card',nome:'Cartão de Crédito'}];
function fixture({closed=false,paid=false,partial=0}={}) {
  const purchases=[{id:'gym-buy',cartao_id:'cc',categoria_id:'gym',descricao:'Mensalidade da academia',valor:240,tipo:'compra',data_fatura:'2026-10-01',data_compra:'2026-09-25'},
    {id:'food-buy',cartao_id:'cc',categoria_id:'food',descricao:'Mercado',valor:60,tipo:'compra',data_fatura:'2026-10-01',data_compra:'2026-09-28'}];
  const expenses=[{id:'cash',categoria_id:'gym',valor:32,baixado:true,data_baixa:'2026-10-02',descricao:'Academia avulsa',conta_id:'bank'}];
  const invoices=closed?[{id:'f',cartao_id:'cc',ano:2026,mes:10,status:paid?'paga':'fechada',pago:paid}]:[];
  if(closed)expenses.push({id:'invoice',cartao_fatura_id:'f',categoria_id:'card',valor:300-partial,baixado:paid,data:'2026-10-20',data_baixa:paid?'2026-10-21':null,descricao:'Fatura outubro',conta_id:'bank'});
  if(partial){
    expenses.push({id:'partial',cartao_pagamento_parcial:true,categoria_id:'card',valor:partial,baixado:true,data_baixa:'2026-10-03',conta_id:'bank',descricao:'Pagamento parcial cartão'});
    purchases.push({id:'marker',cartao_id:'cc',despesa_id:'partial',valor:-partial,tipo:'pagamento',data_fatura:'2026-10-01'});
  }
  return { categories,accounts:[{id:'bank',nome:'Santander'}],cards:[{id:'cc',nome:'Meu cartão',dia_vencimento:20}],expenses,purchases,invoices,movements:[] };
}
const group=(balance,id)=>balance.groups.find(row=>row.id===id);
const cents=value=>Math.round(value*100);
function reconciles(balance){
  for(const field of ['pagos','pagar','recebidos','receber']) {
    assert.equal(balance.groups.reduce((n,r)=>n+cents(r[field]),0),cents(balance[field]));
    assert.equal(balance.months.reduce((n,r)=>n+cents(r[field]),0),cents(balance[field]));
    assert.equal(balance.rows.filter(r=>r.lane===({pagos:'pagos',pagar:'pagar',recebidos:'recebidos',receber:'receber'})[field]).reduce((n,r)=>n+cents(r.value),0),cents(balance[field]));
  }
}
test('academia reúne 32 do lançamento e 240 do cartão com fatura ainda aberta',()=>{
  const b=buildBalance(fixture(),options);
  assert.equal(group(b,'gym').pagos,32);assert.equal(group(b,'gym').pagar,240);assert.equal(group(b,'food').pagar,60);
  assert.equal(group(b,'card'),undefined);assert.equal(b.pagos,32);assert.equal(b.pagar,300);reconciles(b);
  assert.ok(b.rows.some(row=>row.description.includes('Mensalidade da academia')));
});
test('fatura fechada mantém academia em falta pagar, sem repetir os 300 da fatura',()=>{
  const b=buildBalance(fixture({closed:true}),options);
  assert.equal(group(b,'gym').pagar,240);assert.equal(b.pagar,300);assert.equal(b.rows.filter(r=>r.lane==='pagar').length,2);reconciles(b);
});
test('depois de paga, academia tem 272 pagos e nada pendente',()=>{
  const b=buildBalance(fixture({closed:true,paid:true}),options);
  assert.equal(group(b,'gym').pagos,272);assert.equal(group(b,'gym').pagar,0);assert.equal(b.pagos,332);assert.equal(b.pagar,0);reconciles(b);
});
test('filtrar Academia funciona depois da expansão da fatura',()=>{
  const b=buildBalance(fixture({closed:true,paid:true}),{...options,category:'gym'});
  assert.equal(b.groups.length,1);assert.equal(b.pagos,272);assert.equal(b.pagar,0);reconciles(b);
});
for(const closed of [false,true])test(`pagamento parcial tem rateio proporcional e restante exato (fechada=${closed})`,()=>{
  const b=buildBalance(fixture({closed,partial:100}),options);
  assert.equal(group(b,'gym').pagos,112);assert.equal(group(b,'gym').pagar,160);
  assert.equal(group(b,'food').pagos,20);assert.equal(group(b,'food').pagar,40);
  assert.equal(b.pagos,132);assert.equal(b.pagar,200);assert.ok(b.rows.some(r=>r.proportional));reconciles(b);
});
test('fatura com antecipação e quitação final preserva os gastos por categoria',()=>{
  const b=buildBalance(fixture({closed:true,paid:true,partial:100}),options);
  assert.equal(b.pagos,332);assert.equal(b.pagar,0);assert.equal(group(b,'gym').pagos,272);assert.equal(group(b,'food').pagos,60);reconciles(b);
});
test('juros da baixa não são inventados como compra de academia',()=>{
  const data=fixture({closed:true,paid:true});
  data.movements=[{id:'mov',lancamento_id:'invoice',valor:305.30,tipo:'debito',data:'2026-10-21',conta_id:'bank'}];
  const b=buildBalance(data,options);assert.equal(b.pagos,337.30);assert.equal(group(b,'gym').pagos,272);assert.equal(group(b,'card-adjustments').pagos,5.30);reconciles(b);
});
test('desconto e arredondamento preservam o total em centavos',()=>{
  const data=fixture({closed:true,paid:true});data.movements=[{id:'m',lancamento_id:'invoice',valor:299.99,tipo:'debito',data:'2026-10-21',conta_id:'bank'}];
  const b=buildBalance(data,options);assert.equal(b.pagos,331.99);reconciles(b);
});
test('estorno reduz a categoria da compra em vez de virar outra despesa',()=>{
  const data=fixture();data.purchases.push({id:'refund',cartao_id:'cc',categoria_id:'gym',descricao:'Estorno academia',tipo:'estorno',valor:-40,data_fatura:'2026-10-01'});
  const b=buildBalance(data,options);assert.equal(group(b,'gym').pagar,200);assert.equal(b.pagar,260);reconciles(b);
});
test('fatura de ano anterior paga neste período usa compras daquele ano e data da baixa',()=>{
  const data=fixture({closed:true,paid:true});data.invoices[0].ano=2025;data.invoices[0].mes=12;
  data.purchases.forEach(row=>{row.data_fatura='2025-12-01';});
  const b=buildBalance(data,options);assert.equal(group(b,'gym').pagos,272);assert.equal(b.pagos,332);assert.ok(b.rows.filter(r=>r.cardBreakdown).every(r=>r.date==='2026-10-21'));reconciles(b);
});
test('sem detalhes da compra mantém a fatura sem inventar categoria',()=>{
  const data=fixture({closed:true,paid:true});data.purchases=[];
  const b=buildBalance(data,options);assert.equal(group(b,'card').pagos,300);assert.equal(group(b,'gym').pagos,32);reconciles(b);
});
test('filtro bancário não inclui fatura aberta sem conta definida',()=>{
  const b=buildBalance(fixture(),{...options,account:'bank'});assert.equal(b.pagos,32);assert.equal(b.pagar,0);reconciles(b);
  const closed=buildBalance(fixture({closed:true}),{...options,account:'bank'});assert.equal(closed.pagar,300);assert.equal(group(closed,'gym').pagar,240);reconciles(closed);
});
test('compras sem categoria permanecem explícitas e não alteram os dados originais',()=>{
  const data=fixture();delete data.purchases[0].categoria_id;const before=structuredClone(data);
  const b=buildBalance(data,options);assert.equal(group(b,'uncategorized').pagar,240);assert.deepEqual(data,before);reconciles(b);
});

test('uma única categoria consolida dinheiro e cartão pago, sem grupo paralelo por origem',()=>{
  const b=buildBalance(fixture({closed:true,paid:true}),options);
  const gym=group(b,'gym');
  assert.equal(b.groups.filter(g=>g.id==='gym').length,1);
  assert.equal(gym.pagos,272);
  assert.deepEqual(new Set(gym.sources),new Set(['lancamento','cartao']));
  assert.equal(group(b,'card'),undefined);reconciles(b);
});
test('renegociação lançada diretamente em Cartão de Crédito mantém sua categoria sem inventar compras',()=>{
  const data=fixture({closed:true,paid:true});
  data.expenses.push({id:'debt',descricao:'Renegociação',categoria_id:'card',valor:133.39,baixado:true,data_baixa:'2026-10-19'});
  const b=buildBalance(data,options);
  assert.equal(group(b,'card').pagos,133.39);assert.equal(group(b,'gym').pagos,272);
  assert.deepEqual(group(b,'card').sources,['lancamento']);reconciles(b);
});
test('resultado realizado usa baixa, não data da compra, e não se mistura à previsão pendente',()=>{
  const data=fixture({closed:true,paid:true});
  data.income=[{id:'salary',valor:1000,baixado:true,data:'2026-09-01',data_baixa:'2026-10-10',categoria_id:'gym'},
    {id:'future',valor:200,baixado:false,data:'2026-10-30',categoria_id:'gym'}];
  data.expenses.push({id:'pending',valor:50,baixado:false,data:'2026-10-31',categoria_id:'gym'});
  data.movements.push({id:'transfer',valor:9999,tipo:'credito',data:'2026-10-20',transferencia_id:'t'},
    {id:'investment',valor:800,tipo:'debito',data:'2026-10-20',descricao:'Aplicação CDB'});
  const b=buildBalance(data,options);
  assert.equal(b.recebidos,1000);assert.equal(b.pagos,332);assert.equal(b.realized,668);
  assert.equal(b.receber,200);assert.equal(b.pagar,50);assert.equal(b.pendingBalance,150);
  assert.equal(group(b,'gym').recebidos,1000);assert.equal(group(b,'gym').pagos,272);reconciles(b);
});
