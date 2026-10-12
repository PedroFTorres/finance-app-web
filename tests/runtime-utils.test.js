const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = require('../runtime-utils');

test('calendário mantém fim do mês e ano bissexto', () => {
  assert.equal(runtime.addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(runtime.addMonthsClamped('2026-01-31', 2), '2026-03-31');
  assert.equal(runtime.addMonthsClamped('2024-02-29', 12), '2025-02-28');
  assert.equal(runtime.localISODate(new Date(2026, 9, 12, 23, 30)), '2026-10-12');
});

test('dias úteis não perdem a segunda-feira após aplicação no fim de semana', () => {
  assert.equal(runtime.businessDaysBetween('2026-07-04', '2026-07-06'), 1);
  assert.equal(runtime.businessDaysBetween('2026-07-03', '2026-07-06'), 1);
  assert.equal(runtime.businessDaysBetween('2026-07-06', '2026-07-13'), 5);
  assert.equal(runtime.businessDaysBetween('2026-07-06', '2026-07-06'), 0);
});

test('valores aceitam vírgula, centavos com ponto e formato brasileiro', () => {
  for (const [input, expected] of [['300,00',300], ['300.00',300], ['1.234,56',1234.56], ['R$ 1.234,56',1234.56], ['1.234',1234], ['10,65',10.65], ['abc',0], [Infinity,0]]) {
    assert.equal(runtime.parseMoney(input), expected, String(input));
  }
});

test('saldo usa o campo inicial uma vez, inclusive quando negativo', () => {
  const conta = { saldo_inicial: 100, data_saldo: '2026-07-01' };
  assert.equal(runtime.computeContaBalance(conta, [
    { tipo:'credito', valor:100, descricao:'Saldo inicial', data:'2026-07-01' },
    { tipo:'debito', valor:5.30, data:'2026-07-02' }
  ]), 94.70);
  assert.equal(runtime.computeContaBalance({saldo_inicial:-20}, [
    {tipo:'credito',valor:-20,descricao:'Saldo inicial'}, {tipo:'credito',valor:50}
  ]), 30);
  assert.equal(runtime.computeContaBalance({saldo_inicial:0}, [
    {tipo:'credito',valor:0.1}, {tipo:'credito',valor:0.2}
  ]), 0.30);
  assert.throws(() => runtime.computeContaBalance(conta,[{tipo:'unknown',valor:20}]), /Tipo inválido/);
});

test('consultas buscam todo o histórico acima de mil registros', async () => {
  const expected = Array.from({length:1250}, (_, id) => ({id}));
  const ranges = [];
  const query = { order(){ return this; }, range(start,end){
    ranges.push([start,end]); return Promise.resolve({data:expected.slice(start,end+1),error:null});
  }};
  const result = await runtime.selectAll(query);
  assert.deepEqual(result.data, expected);
  assert.deepEqual(ranges, [[0,499],[500,999],[1000,1499]]);
});

test('falha numa página descarta o resultado incompleto', async () => {
  const error = {message:'falha de rede'};
  const query = {order(){return this;},range(start){
    return Promise.resolve(start ? {data:null,error} : {data:Array(500).fill({id:1}),error:null});
  }};
  assert.deepEqual(await runtime.selectAll(query), {data:null,error});
});

test('consultas por IDs usam lotes pequenos e removem IDs repetidos', async () => {
  const batches=[];
  const values=Array.from({length:230},(_,i)=>String(i));
  const result=await runtime.selectIn(ids=>{
    batches.push(ids);
    return {order(){return this;},range(){return Promise.resolve({data:ids.map(id=>({id})),error:null});}};
  },[...values,'1','2']);
  assert.deepEqual(batches.map(batch=>batch.length),[100,100,30]);
  assert.deepEqual(result.data.map(item=>item.id),values);
});

test('banco é detectado por palavra, sem confundir Nu com Nanquim', () => {
  const catalog = [
    {code:'nu',aliases:['nu','nubank']}, {code:'inter',aliases:['inter']},
    {code:'bb',aliases:['bb','banco do brasil']}, {code:'wallet',aliases:['carteira']}
  ];
  const fallback={code:'other'};
  assert.equal(runtime.detectBank('Fatura Nanquim',catalog,fallback), fallback);
  assert.equal(runtime.detectBank('Conta internacional',catalog,fallback), fallback);
  assert.equal(runtime.detectBank('Investimentos Banco do Brasil',catalog,fallback).code,'bb');
});

test('transferência usa uma chamada atômica e propaga falhas', async () => {
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_id,error:null};}};
  const input={id:'t1',origem:'a',destino:'b',valor:300,data:'2026-10-12',descricao:'Aporte'};
  assert.equal(await runtime.transfer(client,input),'t1');
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,'arolix_transferir');
  await assert.rejects(runtime.transfer(client,{...input,destino:'a'}),/contas diferentes/);
  await assert.rejects(runtime.transfer(client,{...input,valor:NaN}),/valor válido/);
  await assert.rejects(runtime.transfer({rpc:async()=>({error:new Error('rollback')})},input),/rollback/);
});

test('acesso real do frontend bloqueia VIP expirado e respeita ambas as datas', () => {
  const window={addEventListener(){}};
  const context=vm.createContext({window,Date,setTimeout,console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../premium-access-client.js'),'utf8'),context);
  const profile={plano:'vip',subscription_status:'active'};
  assert.equal(window.ArolixAccess.hasInvestmentAccess(profile),true);
  assert.equal(window.ArolixAccess.hasInvestmentAccess({...profile,subscription_ends_at:'2020-01-01'}),false);
  assert.equal(window.ArolixAccess.isPro({...profile,plano:'pro',subscription_ends_at:'2099-01-01',plano_expira_em:'2020-01-01'}),false);
  assert.equal(window.ArolixAccess.isPro({...profile,plano:'pro',subscription_ends_at:'invalid'}),false);
});

test('nomes de categoria especiais não colidem com propriedades de Object', () => {
  const {agruparItensPorCategoriaRegra} = require('../finance-rules');
  const groups=agruparItensPorCategoriaRegra([{categoria_nome:'__proto__',valor:100},{categoria_nome:'toString',valor:5}]);
  assert.equal(groups.__proto__.total,100);
  assert.equal(groups.toString.total,5);
});

test('resgate de fundo em perda preserva perda e impede resgate anterior ao aporte', () => {
  const document={addEventListener(){}};
  const window={ArolixRuntime:runtime};
  const context=vm.createContext({window,document,console,Date,crypto:require('node:crypto').webcrypto});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../investimentos/investimentos.js'),'utf8'),context);
  const result=vm.runInContext(`
    state.investimentos=[{id:'i1',produto_grupo_id:'g1',tipo:'fundo_investimento',nome:'Fundo',valor_aplicado:100,data_aplicacao:'2026-07-01',cota_inicial:10,cota_atual:9,liquidez:'diaria'}];
    ({resgate:buildResgatePreview('g1',100,'2026-07-10'),antes:buildResgatePreview('g1',100,'2026-06-30')});
  `,context);
  assert.equal(result.resgate.totals.liquido,90);
  assert.equal(result.resgate.totals.rendimento,-10);
  assert.equal(result.antes.ok,false);
});
