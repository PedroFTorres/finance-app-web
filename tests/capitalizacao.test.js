const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../capitalizacao/regras.js');
const title = { id:'title',nome:'Raspa DinDin',valor_parcela:100,prazo_meses:48,inicio_vigencia:'2026-09-16',fim_vigencia:'2030-09-16',dia_cobranca:16,status:'ativo',regra_resgate:'raspa48_662222_2024',processo_susep:'15414.662222/2024-10' };
function fixture() {
  return { pagamentos:[{id:'p1',titulo_id:'title',despesa_id:'d1'},{id:'p2',titulo_id:'title',despesa_id:'d2'}, {id:'p3',titulo_id:'title',despesa_id:'d3'}],
    despesas:[{id:'d1',valor:100,baixado:true,data:'2026-09-16',data_baixa:'2026-09-16'},{id:'d2',valor:100,baixado:true,data:'2026-10-16',data_baixa:'2026-10-16'},{id:'d3',valor:100,baixado:false,data:'2026-11-16'}],
    compras:[],faturas:[],recebimentos:[],receitas:[],movimentacoes:[] };
}
test('duas parcelas pagas somam 200 e referência de resgate é 100, não 200', () => {
  const before=fixture(); const copy=structuredClone(before);
  const s=rules.summary(title,before,'2026-10-18');
  assert.equal(s.totalPago,200);assert.equal(s.pagas,2);assert.equal(s.restantes,46);assert.equal(s.estimativa,100);assert.equal(s.percentual,50);assert.equal(s.proximas.length,1);
  assert.deepEqual(before,copy,'Cálculo não pode modificar fontes financeiras');
});
test('tabela mantém os 48 percentuais exatos e não reaplica juros mensais', () => {
  assert.equal(rules.TABELA_48.length,49);assert.equal(rules.TABELA_48[12],51.45);assert.equal(rules.TABELA_48[37],91.96);assert.equal(rules.TABELA_48[48],100.02);
  const data=fixture();data.pagamentos=[];data.despesas=[];
  for(let n=1;n<=48;n++){data.pagamentos.push({titulo_id:'title',despesa_id:`d${n}`});data.despesas.push({id:`d${n}`,valor:100,baixado:true,data:'2026-09-16'});}
  assert.equal(rules.summary(title,data,'2030-09-16').estimativa,4800.96);
});
test('prazo 60 e outro processo SUSEP nunca herdam tabela de 48 meses', () => {
  for(const t of [{...title,prazo_meses:60,regra_resgate:'nao_informada'}, {...title,processo_susep:'outro'}]) {
    const s=rules.summary(t,fixture(),'2026-10-18');assert.equal(s.estimativa,null);assert.equal(s.totalPago,200);
  }
});
test('sem parcelas pagas não inventa saldo resgatável nem pagamento por decurso do tempo', () => {
  const data=fixture();data.despesas.forEach(row=>{row.baixado=false;});
  const s=rules.summary(title,data,'2032-01-01');assert.equal(s.pagas,0);assert.equal(s.totalPago,0);assert.equal(s.estimativa,null);assert.equal(s.vencido,true);
});
test('cancelar a baixa ou editar a contribuição reflete no acompanhamento', () => {
  const data=fixture();data.despesas[1].baixado=false;
  assert.equal(rules.summary(title,data,'2026-10-18').totalPago,100);
  data.despesas[0].valor=105.55;assert.equal(rules.summary(title,data,'2026-10-18').totalPago,105.55);
});
test('pagamento antecipado conta pela data da baixa, mesmo com vencimento futuro', () => {
  const data=fixture();data.despesas[2].baixado=true;data.despesas[2].data_baixa='2026-10-18';
  assert.equal(rules.summary(title,data,'2026-10-18').pagas,3);
});
test('compras vinculadas só contam após fatura paga e não somam o total da fatura', () => {
  const data={pagamentos:[{titulo_id:'title',cartao_lancamento_id:'c1'}],compras:[{id:'c1',valor:100,tipo:'compra',cartao_id:'card',data_compra:'2026-09-16',data_fatura:'2026-10-01'}],
    faturas:[{id:'f',cartao_id:'card',ano:2026,mes:10,pago:false}],despesas:[{id:'invoice',cartao_fatura_id:'f',valor:2000,baixado:false,data_baixa:'2026-10-17'}]};
  assert.equal(rules.summary(title,data,'2026-10-18').totalPago,0);
  data.despesas[0].baixado=true;assert.equal(rules.summary(title,data,'2026-10-18').totalPago,100);
  data.despesas[0].baixado=false;data.faturas[0].pago=true;assert.equal(rules.summary(title,data,'2026-10-18').totalPago,0,'Baixa cancelada é fonte autoritativa');
});
test('pagamentos de outro título, vínculos repetidos e estornos não inflam o total', () => {
  const data=fixture();data.pagamentos.push({...data.pagamentos[0]}, {titulo_id:'other',despesa_id:'other'}, {titulo_id:'title',cartao_lancamento_id:'credit'});
  data.despesas.push({id:'other',valor:99999,baixado:true,data:'2026-09-01'});data.compras.push({id:'credit',valor:100,tipo:'credito'});
  assert.equal(rules.summary(title,data,'2026-10-18').totalPago,200);
});
test('prêmios e resgates usam receitas baixadas reais sem somar ao valor contribuído', () => {
  const data=fixture();data.recebimentos=[{titulo_id:'title',receita_id:'r1',tipo:'premio'},{titulo_id:'title',receita_id:'r2',tipo:'resgate'},{titulo_id:'title',receita_id:'r3',tipo:'premio'}];
  data.receitas=[{id:'r1',valor:50,baixado:true,data_baixa:'2026-10-17'},{id:'r2',valor:100,baixado:true,data_baixa:'2026-10-18'},{id:'r3',valor:9999,baixado:false}];
  data.movimentacoes=[{lancamento_id:'r1',valor:45,tipo:'credito'}];
  const s=rules.summary(title,data,'2026-10-18');assert.equal(s.premios,45);assert.equal(s.resgatado,100);assert.equal(s.totalPago,200);
});
test('validação exige prazo correspondente e consulta de resgate com data', () => {
  assert.doesNotThrow(()=>rules.validateTitle(title));
  for(const patch of [{nome:''},{valor_parcela:0},{prazo_meses:36},{fim_vigencia:'2025-01-01'},{dia_cobranca:32},{valor_resgate_banco:100},{valor_resgate_banco:-1,data_consulta_resgate:'2026-10-18'}]) assert.throws(()=>rules.validateTitle({...title,...patch}));
});
test('módulo não grava despesas, receitas, movimentações ou pagamentos de faturas', () => {
  const source=fs.readFileSync(path.join(__dirname,'../capitalizacao/capitalizacao.js'),'utf8');
  assert.doesNotMatch(source,/\.from\(['"](?:despesas|receitas|movimentacoes|cartao_faturas|cartao_lancamentos)['"]\)\s*\.(?:insert|update|delete|upsert)/);
  assert.doesNotMatch(source,/SECURITY DEFINER|service_role|039\.985/);
});
