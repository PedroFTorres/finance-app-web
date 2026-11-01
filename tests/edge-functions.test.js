const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function loadFunction(name, fetch) {
  let handler;
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions', name, 'index.ts'), 'utf8');
  const js = stripTypeScriptTypes(source.replace(/^import .*;\s*$/mg, ''));
  const env = { SUPABASE_URL:'https://database.test', SUPABASE_ANON_KEY:'public-key', SUPABASE_SERVICE_ROLE_KEY:'server-key', ASAAS_WEBHOOK_TOKEN:'test-webhook', ASAAS_API_KEY:'test-only-key', ASAAS_ENV:'sandbox' };
  const context = vm.createContext({
    Deno: { env: {get: key => env[key]}, serve: fn => {handler=fn;} },
    fetch, Response, Request, Date, TextDecoder, Uint8Array, atob, crypto:require('node:crypto').webcrypto,
    console: {log(){},warn(){},error(){}}
  });
  vm.runInContext(js,context);
  return {handler,context};
}

test('novo checkout cobra 19,90 por 30 dias no servidor e ignora preço enviado pelo navegador', async () => {
  const calls=[];
  const {handler}=loadFunction('asaas-create-checkout',async(url,init={})=>{
    const body=init.body ? JSON.parse(init.body) : null;
    calls.push({url,body,method:init.method||'GET'});
    if(url==='https://database.test/auth/v1/user')return Response.json({id:'user-test',email:'test@example.test'});
    if(url.startsWith('https://database.test/rest/v1/user_profiles?'))return Response.json([{id:'user-test',asaas_customer_id:'customer-test'}]);
    if(url==='https://api-sandbox.asaas.com/v3/payments')return Response.json({id:'payment-test',invoiceUrl:'https://checkout.example.test',value:body.value});
    if(url==='https://database.test/rest/v1/subscription_events')return Response.json([]);
    throw new Error('Unexpected request: '+url);
  });
  const response=await handler(new Request('https://test/checkout',{
    method:'POST',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},
    body:JSON.stringify({value:0.01,days:365})
  }));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.value,19.90);assert.equal(result.days,30);
  const payments=calls.filter(call=>call.url==='https://api-sandbox.asaas.com/v3/payments');
  assert.equal(payments.length,1);assert.equal(payments[0].body.value,19.90);
  assert.equal(payments[0].method,'POST');
  assert.ok(!calls.some(call=>['PATCH','PUT','DELETE'].includes(call.method)),'Não altera cobranças ou acessos existentes');
});

test('webhook rejeita token errado antes de consultar o banco', async () => {
  const {handler}=loadFunction('asaas-webhook',()=>{throw new Error('unexpected fetch');});
  const response=await handler(new Request('https://test/webhook',{method:'POST',body:'{}'}));
  assert.equal(response.status,401);
});

test('webhook processa com RPC atômica e reconhece duplicidade', async () => {
  const calls=[];
  const {handler}=loadFunction('asaas-webhook',async(url,init)=>{
    calls.push({url,body:JSON.parse(init.body)});
    return Response.json(false);
  });
  const payload={id:'event-1',event:'PAYMENT_CONFIRMED',payment:{id:'payment-1',externalReference:'arolix:user:11111111-1111-4111-8111-111111111111'}};
  const response=await handler(new Request('https://test/webhook',{
    method:'POST',headers:{'asaas-access-token':'test-webhook'},body:JSON.stringify(payload)
  }));
  assert.equal(response.status,200);
  assert.equal((await response.json()).duplicate,true);
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/rpc\/arolix_processar_evento_asaas$/);
  assert.equal(calls[0].body.p_event_id,'PAYMENT_CONFIRMED:event-1');
});

test('webhook permite nova entrega se o banco falhar', async () => {
  const {handler}=loadFunction('asaas-webhook',async()=>Response.json({message:'database failure'},{status:500}));
  const response=await handler(new Request('https://test/webhook',{
    method:'POST',headers:{'asaas-access-token':'test-webhook'},
    body:JSON.stringify({id:'evt',event:'PAYMENT_RECEIVED',payment:{externalReference:'arolix:user:11111111-1111-4111-8111-111111111111'}})
  }));
  assert.equal(response.status,500);
});

test('CVM bloqueia consulta sem login sem baixar arquivos', async () => {
  const {handler}=loadFunction('cvm-cotas',()=>{throw new Error('unexpected fetch');});
  const response=await handler(new Request('https://test/cvm',{method:'POST',body:'{}'}));
  assert.equal(response.status,403);
});

test('leitura CSV aceita CNPJ formatado e sem pontuação, inclusive último chunk', () => {
  const {context}=loadFunction('cvm-cotas',()=>{throw new Error('unexpected fetch');});
  const result=vm.runInContext(`
    const scanner=createCsvQuotaScanner('54603259000156','2026-07-10');
    scanCsvChunk(scanner,'CNPJ_FUNDO;DT_COMPTC;VL_QUOTA\\n54.603.259/0001-56;2026-07-08;10.5\\n54603259000156;2026-07-09;',false);
    scanCsvChunk(scanner,'11.5',true);
    scanner.selected;
  `,context);
  assert.equal(result.date,'2026-07-09');
  assert.equal(result.quota,11.5);
});

test('status do pagamento não libera assinatura VIP expirada', () => {
  const {context}=loadFunction('asaas-payment-status',()=>{});
  assert.equal(vm.runInContext(`isActiveFinancialAccess({plano:'vip',subscription_status:'active',subscription_ends_at:'2020-01-01'})`,context),false);
  assert.equal(vm.runInContext(`isActiveFinancialAccess({plano:'pro',subscription_status:'active',subscription_ends_at:'2099-01-01',plano_expira_em:'2020-01-01'})`,context),false);
});
