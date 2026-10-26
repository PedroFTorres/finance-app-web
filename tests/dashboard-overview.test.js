const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {agenda}=require('../dashboard-overview.js');
const options={today:'2026-10-26',categoryName:id=>id==='gym'?'Academia':''};
test('agenda usa pendências existentes, ordena por data e limita a cinco sem alterar dados',()=>{
 const data={pendentesReceita:[{id:'r',data:'2026-10-31',valor:4200,descricao:'Salário'}],
 pendentesDespesa:Array.from({length:6},(_,i)=>({id:'d'+i,data:`2026-10-${String(28-i).padStart(2,'0')}`,valor:100,descricao:'Despesa '+i}))};
 const before=JSON.stringify(data);const result=agenda(data,options);
 assert.equal(result.count,7);assert.equal(result.items.length,5);
 assert.equal(result.items[0].date,'2026-10-23');assert.equal(result.items[0].status,'Vencido');
 assert.equal(JSON.stringify(data),before);
});
test('pagos, recebidos, créditos e valores inválidos não viram próximos compromissos',()=>{
 const result=agenda({pendentesDespesa:[{id:'paid',baixado:true,valor:10},{id:'zero',valor:0},{id:'credit',valor:-10},{id:'bad',valor:'inválido'}],previsoesCartao:[{id:'settled',pago:true,valor:20}]},options);
 assert.equal(result.count,0);
});
test('fatura aberta mostra mês de referência sem inventar vencimento no dia primeiro',()=>{
 const result=agenda({previsoesCartao:[{id:'open',data:'2026-10-01',valor:702,descricao:'Fatura aberta Santander',provisorio_cartao:true}]},options);
 const item=result.items[0];assert.equal(item.day,'OUT');assert.equal(item.month,'FATURA');
 assert.equal(item.status,'Fatura aberta');assert.equal(item.overdue,false);
 assert.equal(item.dateLabel,'Mês de referência: 10/2026');assert.equal(item.value,702);
});
test('faturas transportadas repetidas não aparecem duas vezes; receita e despesa de mesmo ID permanecem distintas',()=>{
 const card={id:'invoice',data:'2026-09-01',valor:100};
 const result=agenda({previsoesCartao:[card],cartoesTransportados:[card],pendentesReceita:[{id:'same',valor:50}],pendentesDespesa:[{id:'same',valor:10}]},options);
 assert.equal(result.count,3);
});
test('categorias, descrições e situação são preservadas e datas sem valor ficam por último',()=>{
 const result=agenda({pendentesDespesa:[{id:'missing',valor:10},{id:'today',valor:32,data:'2026-10-26',categoria_id:'gym',descricao:'<img src=x>'}],pendentesReceita:[{id:'income',data:'2026-10-27',valor:240,categoria_nome:'Salários'}]},options);
 assert.equal(result.items[0].category,'Academia');assert.equal(result.items[0].status,'A pagar');assert.equal(result.items[0].title,'<img src=x>');
 assert.equal(result.items[1].status,'A receber');assert.equal(result.items[2].dateLabel,'Data não informada');
});
test('integração usa o mesmo resultado do dashboard e não consulta nem grava no backend',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','dashboard-overview.js'),'utf8');
 assert.doesNotMatch(source,/supabase|fetch\(|\.insert\(|\.update\(/);
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(app,/ArolixOverview\?\.render\(dadosDashboard/);
 assert.match(app,/mesLancAtual = new Date\(mesDashboardAtual.getFullYear\(\), mesDashboardAtual.getMonth\(\), 1\)/);
});
