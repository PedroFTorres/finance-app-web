// Real app functions and DOM, with bootstrap replaced by isolated fixtures.
// Never connects to Supabase, creates a session or changes a real payment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
const fixture=`
  window.alerts=[];window.alert=message=>window.alerts.push(message);window.confirm=()=>true;
  window.ArolixAccess={hasFinancialAccess:()=>true};
  STATE.user={id:'owner'};STATE.contas=[{id:'bank',nome:'Banco teste',tipo_conta:'corrente'}];
  STATE.categorias=[{id:'gym',nome:'Academia'},{id:'other',nome:'Outra categoria'}];
  window.calls=[];window.refreshes=0;window.failPayment=false;
  window.supabase={rpc:async(name,args)=>{window.calls.push({name,args});await new Promise(r=>setTimeout(r,30));return window.failPayment?{error:{message:'Falha de teste: nada alterado'}}:{data:{original_id:'original',restante:233.33},error:null};}};
  ContasService.load=async()=>STATE.contas;
  App.refreshLancamentos=async()=>{window.refreshes++;};App.renderExtrato=async()=>{};
  window.testUI=UI;
  document.getElementById('modal-save-lanc').onclick=()=>UI.handleSaveModal();
  window.partialItem={id:'movement',descricao:'Exemplo (Baixa parcial, restante R$ 122,60)',descricao_original:'Exemplo',valor:510.73,
    data:'2026-10-30',data_baixa:'2026-10-30',baixado:true,baixa_parcial:true,baixa_parcial_lancamento_id:'original',conta_id:'bank',categoria_id:'gym'};
  window.fullItem={id:'original-full',descricao:'Parcela (2/6)',valor:105.30,data:'2026-10-01',data_baixa:'2026-10-20',baixado:true,recorrencia_id:'series',conta_id:'bank',categoria_id:'gym'};
  document.querySelectorAll('[data-screen]').forEach(el=>el.classList.toggle('hidden',el.dataset.screen!=='lanc'));
  document.getElementById('list-pendencias').replaceChildren(UI._createLancItem(window.partialItem,'despesa'));
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='payments.test')return route.abort();
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   let content=fs.readFileSync(file);
   if(url.pathname==='/app.html')content=content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,tag=>/src="(?:interface|runtime-utils|payment-actions|app)\.js/.test(tag)?tag:'');
   if(url.pathname==='/app.js'){
    content=content.toString();const start=content.indexOf('(async function bootstrap()');const end=content.indexOf('// ================================ // EXTRATO',start);
    assert.ok(start>0&&end>start);content=content.slice(0,start)+fixture+'\n'+content.slice(end);
   }
   return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/javascript',body:content});
  });
  await page.goto('https://payments.test/app.html');
  await page.locator('#list-pendencias').getByRole('button',{name:'Editar',exact:true}).click();
  assert.equal(await page.locator('#modal-desc').inputValue(),'Exemplo');
  assert.equal(await page.locator('#modal-categoria').inputValue(),'gym');
  assert.equal(await page.locator('#modal-data').inputValue(),'2026-10-30');
  assert.equal(await page.locator('#modal-tipo').isDisabled(),true);
  assert.equal(await page.locator('#modal-recorrencia').isDisabled(),true);
  assert.equal(await page.locator('#btn-excluir-lancamento').isVisible(),false);
  assert.match(await page.locator('#payment-edit-note').innerText(),/restante em aberto/);
  await page.locator('#modal-valor').fill('400');await page.locator('#modal-data').fill('2026-10-31');await page.locator('#modal-categoria').selectOption('other');
  await page.evaluate(()=>{window.failPayment=true;});
  await page.locator('#modal-save-lanc').click();await page.waitForFunction(()=>window.alerts.length>0);
  assert.equal(await page.locator('#modal-loading').isVisible(),false);
  assert.equal(await page.locator('#modal-save-lanc').isEnabled(),true);
  assert.equal(await page.locator('#modal-add-lanc').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.refreshes),0);
  await page.evaluate(async()=>{window.failPayment=false;await Promise.all([window.testUI.handleSaveModal(),window.testUI.handleSaveModal()]);});
  assert.equal(await page.evaluate(()=>window.calls.length),2);
  const saved=await page.evaluate(()=>window.calls.at(-1).args);
  assert.equal(saved.p_id,'movement');assert.equal(saved.p_parcial,true);assert.equal(saved.p_patch.valor,400);assert.equal(saved.p_patch.categoria_id,'other');
  assert.equal(saved.p_patch.data,'2026-10-31');assert.equal(await page.locator('#modal-add-lanc').isVisible(),false);
  await page.locator('#list-pendencias').getByRole('button',{name:'Cancelar Baixa'}).click();
  await page.waitForFunction(()=>window.calls.length===3&&window.refreshes===2);
  assert.equal(await page.evaluate(()=>window.calls.at(-1).args.p_id),'movement');
  assert.equal(await page.evaluate(()=>window.calls.at(-1).args.p_acao),'cancelar');
  await page.evaluate(()=>window.testUI.openModalEdit(window.fullItem,'despesa'));
  assert.equal(await page.locator('#modal-data').inputValue(),'2026-10-20');
  assert.equal(await page.locator('#modal-desc').inputValue(),'Parcela (2/6)');
  assert.equal(await page.locator('#modal-edit-scope').count(),0);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/arolix-payment-editor-'+width+'.png'});}
  await page.locator('#modal-save-lanc').click();await page.waitForFunction(()=>window.calls.length===4&&window.refreshes===3);
  assert.equal(await page.evaluate(()=>window.calls.at(-1).args.p_parcial),false);
  await page.evaluate(()=>window.testUI.openAddModal());
  assert.equal(await page.locator('#modal-tipo').isEnabled(),true);
  assert.equal(await page.locator('#modal-recorrencia').isEnabled(),true);
  assert.equal(await page.locator('#payment-edit-note').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Payment editor: actual app handlers, partial/full editing, cancel by movement ID, error recovery, double click, labels and mobile OK. Only mocked backend.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
