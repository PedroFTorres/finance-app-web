const test = require('node:test');
const assert = require('node:assert/strict');
const {buildTransactions,buildBalance} = require('../reports-rules');
const options = {start:'2026-10-01',end:'2026-10-31',kind:'expense',status:'paid',categories:['jewels']};
const fixture = () => ({
  categories:[{id:'jewels',nome:'Joias e Relógios'},{id:'salary',nome:'Salário'}],
  accounts:[{id:'bank',nome:'Santander'}],
  expenses:[
    {id:'earlier',descricao:'Fabio Furtado (2/4)',categoria_id:'jewels',conta_id:'bank',valor:633.33,baixado:true,data:'2026-10-01',data_baixa:'2026-10-01'},
    {id:'bracelet',descricao:'Compra Pulseira',categoria_id:'jewels',conta_id:'bank',valor:122.60,baixado:true,data:'2026-11-01',data_baixa:'2026-10-31'}
  ],
  movements:[
    {id:'partial',baixa_parcial_lancamento_id:'bracelet',lancamento_id:null,descricao:'Compra Pulseira (Baixa parcial, restante R$ 122,60)',conta_id:'bank',valor:510.73,tipo:'debito',data:'2026-10-30'},
    {id:'final',lancamento_id:'bracelet',descricao:'Compra Pulseira',conta_id:'bank',valor:122.60,tipo:'debito',data:'2026-10-31'}
  ]
});
test('caso do print: categoria inclui 633,33 + 510,73 + 122,60 em ordem, sem duplicar quitação',()=>{
  const report = buildTransactions(fixture(),options);
  assert.equal(report.total,1266.66);
  assert.equal(report.totals.pagos,1266.66);
  assert.deepEqual(report.rows.map(row=>[row.id,row.paymentDate]),[['earlier','2026-10-01'],['partial','2026-10-30'],['final','2026-10-31']]);
  const partial = report.rows[1];
  assert.equal(partial.dueDate,'2026-11-01');
  assert.equal(partial.categoryId,'jewels');
  assert.equal(partial.value,510.73);
  assert.match(partial.description,/Baixa parcial/);
});
test('o balanço e o relatório incluem a mesma baixa na categoria original',()=>{
  const report = buildBalance(fixture(),{...options,category:'jewels'});
  assert.equal(report.pagos,1266.66);assert.equal(report.pagar,0);
});
test('pagamento parcial não representa a baixa final de fallback sem movimentação',()=>{
  const data=fixture();data.movements=data.movements.filter(row=>row.id==='partial');
  const report=buildTransactions(data,options);
  assert.equal(report.total,1266.66);assert.equal(report.rows.length,3);
});
test('baixas em meses diferentes ficam na data real e não repetem o valor original',()=>{
  const data=fixture();data.expenses[1].data_baixa='2026-11-05';data.movements[1].data='2026-11-05';
  const october=buildTransactions(data,options);
  assert.equal(october.total,1144.06);assert.equal(october.rows.length,2);
  const november=buildTransactions(data,{...options,start:'2026-11-01',end:'2026-11-30'});
  assert.equal(november.total,122.60);assert.equal(november.rows.length,1);
});
test('recebimentos parciais com origem futura herdam categoria e respeitam conta e período',()=>{
  const data={categories:[{id:'salary',nome:'Salário'}],income:[{id:'salary',descricao:'Salário',valor:300,baixado:false,data:'2027-01-01',categoria_id:'salary'}],movements:[
    {id:'received',baixa_parcial_lancamento_id:'salary',descricao:'Adiantamento',tipo:'credito',conta_id:'bank',data:'2026-10-30',valor:200}
  ]};
  const incomeOptions={...options,kind:'income',categories:['salary']};
  const result=buildTransactions(data,incomeOptions);
  assert.equal(result.totals.recebidos,200);assert.equal(result.rows[0].dueDate,'2027-01-01');
  assert.equal(buildTransactions(data,{...incomeOptions,account:'another'}).total,0);
  assert.equal(buildTransactions(data,{...incomeOptions,start:'2026-10-31'}).total,0);
});
test('múltiplas baixas, saldo pendente e quitação usam apenas cada valor efetivo',()=>{
  const data=fixture();data.expenses=data.expenses.slice(1);data.expenses[0].baixado=false;data.expenses[0].data='2026-10-31';delete data.expenses[0].data_baixa;
  data.movements=[{...data.movements[0],valor:300,data:'2026-10-20'},{...data.movements[0],id:'second',valor:210.73}];
  const result=buildTransactions(data,{...options,status:'all'});
  assert.equal(result.totals.pagos,510.73);assert.equal(result.totals.pagar,122.60);assert.equal(result.total,633.33);
});
test('vínculo ausente ou ambíguo não adivinha categoria pelo nome; transferência fica fora',()=>{
  const data=fixture();delete data.movements[0].baixa_parcial_lancamento_id;
  data.movements.push({...data.movements[0],id:'transfer',transferencia_id:'transfer-id',valor:999});
  const all=buildTransactions(data,{...options,categories:[]});
  assert.equal(all.total,1266.66);assert.equal(all.rows.find(row=>row.id==='partial').categoryId,'partial');
  assert.equal(buildTransactions(data,options).total,755.93);
});
