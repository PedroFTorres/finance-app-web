// Real card frontend, fake backend, no real credentials or financial writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
const mock=`(()=>{
 const user={id:'owner',email:'teste@example.test'};
 const now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const tables={user_profiles:[{id:'owner',plano:'vip',subscription_status:'active'}],
 cartoes_credito:Array.from({length:7},(_,i)=>({id:'c'+i,user_id:'owner',nome:['Itaú teste','Santander teste','Elo teste'][i]||'Cartão '+i,limite:15000,dia_fechamento:1,dia_vencimento:10})),
 categorias:[{id:'gym',user_id:'owner',nome:'Academia'},{id:'food',user_id:'owner',nome:'Alimentação'}],cartao_faturas:[],
 cartao_lancamentos:Array.from({length:55},(_,i)=>({id:'p'+i,user_id:'owner',cartao_id:'c0',categoria_id:i%2?'food':'gym',descricao:i===0?'Academia mensal':'Compra '+i,valor:10,data_compra:ym+'-02',data_fatura:ym+'-01',tipo:'compra',parcelas:1,parcela_atual:1})),contas_bancarias:[],movimentacoes:[],despesas:[]};
 window.__tables=tables;window.__queries=[];window.__fail=false;
 function from(table){let filters=[],range=null,single=false;const q={
 select(){return this},order(){return this},eq(k,v){filters.push(r=>r[k]===v);return this},gte(k,v){filters.push(r=>r[k]>=v);return this},lte(k,v){filters.push(r=>r[k]<=v);return this},in(k,v){filters.push(r=>v.includes(r[k]));return this},range(a,b){range=[a,b+1];return this},maybeSingle(){single=true;return this},
 insert(){throw Error('Unexpected write')},update(){throw Error('Unexpected write')},delete(){throw Error('Unexpected write')},
 then(resolve){window.__queries.push(table);if(window.__fail&&table==='cartao_lancamentos')return Promise.resolve({data:null,error:{message:'Simulated network error'}}).then(resolve);let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(range)rows=rows.slice(...range);return Promise.resolve({data:single?(rows[0]||null):structuredClone(rows),error:null}).then(resolve)}};return q}
 window.supabase={from,auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),signOut:async()=>({error:null})}};
})();`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{for(const width of [1440,390,375]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='cards.test')return route.abort();
   if(url.pathname==='/supabase.js')return route.fulfill({contentType:'application/javascript',body:mock});
   if(url.pathname==='/security.js')return route.fulfill({contentType:'application/javascript',body:'window.ArolixSecurity={requireMfaForProtectedPage:async()=>true};'});
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/javascript',body:fs.readFileSync(file)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://cards.test/cartao.html');await page.locator('.card-tile').nth(6).waitFor();
  assert.equal(await page.locator('#card-invoice').isVisible(),false);
  assert.ok(await page.locator('#cards-list').evaluate(el=>getComputedStyle(el).flexDirection==='row'&&el.scrollWidth>el.clientWidth),'Carteira deve ser horizontal, não uma pilha vertical');
  assert.ok(await page.locator('#cards-list').evaluate(el=>el.getBoundingClientRect().height<260),'Carteira não deve crescer com a quantidade de cartões');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/private/tmp/arolix-wallet-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Ver fatura de Itaú teste',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('card-invoice').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#card-wallet').isVisible(),false);
  assert.equal(await page.locator('.fatura-row:not(.invoice-row-hidden)').count(),20);
  assert.match(await page.locator('#fatura-total').innerText(),/550,00/);
  await page.locator('#invoice-load-more').click();assert.equal(await page.locator('.fatura-row:not(.invoice-row-hidden)').count(),40);
  await page.locator('#invoice-category').selectOption('gym');assert.match(await page.locator('#invoice-list-count').innerText(),/20 de 28/);
  await page.locator('#invoice-search').fill('academia mensal');assert.equal(await page.locator('.fatura-row:not(.invoice-row-hidden)').count(),1);
  assert.match(await page.locator('#fatura-total').innerText(),/550,00/);
  await page.locator('#invoice-search').fill('nada encontrado');assert.ok(await page.locator('#invoice-no-results').isVisible());
  await page.locator('#invoice-search').fill('');await page.locator('#invoice-category').selectOption('');
  await page.locator('#btn-lancar-compra').click();await page.locator('#modal-lancamento').waitFor({state:'visible'});
  await page.locator('#btn-cancel-purchase').click();
  await page.screenshot({path:'/private/tmp/arolix-invoice-'+width+'.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#fat-next').click();await page.locator('.fatura-empty').waitFor();
  const month=await page.locator('#fat-display').innerText();
  await page.locator('#invoice-back').click();await page.locator('#card-wallet').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Ver fatura de Santander teste',exact:true}).click();await page.waitForFunction(()=>document.getElementById('card-invoice').getAttribute('aria-busy')==='false');
  await page.locator('#invoice-back').click();await page.locator('#card-wallet').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Ver fatura de Itaú teste',exact:true}).click();await page.waitForFunction(()=>document.getElementById('card-invoice').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#fat-display').innerText(),month);
  await page.goBack();await page.locator('#card-wallet').waitFor({state:'visible'});
  await page.goForward();await page.locator('#card-invoice').waitFor({state:'visible'});
  await page.locator('#invoice-back').click();await page.locator('#card-wallet').waitFor({state:'visible'});
  await page.evaluate(()=>{window.__fail=true;});
  await page.getByRole('button',{name:'Ver fatura de Santander teste',exact:true}).click();
  await page.getByText('Não foi possível carregar esta fatura. Volte aos cartões e tente novamente.',{exact:true}).waitFor();
  assert.equal(await page.locator('#invoice-workspace').isVisible(),false,'Não exibir a fatura anterior em falha de rede');
  await page.locator('#invoice-back').click();await page.locator('#card-wallet').waitFor({state:'visible'});
  await page.evaluate(()=>{window.__fail=false;});
  await page.evaluate(()=>{const now=new Date();window.__tables.cartao_faturas.push({id:'closed-test',user_id:'owner',cartao_id:'c1',ano:now.getFullYear(),mes:now.getMonth()+1,status:'fechada',pago:false});});
  await page.getByRole('button',{name:'Ver fatura de Santander teste',exact:true}).click();
  await page.locator('#btn-reabrir-fatura').waitFor({state:'visible'});
  assert.equal(await page.locator('#btn-fechar-fatura').isDisabled(),true);
  assert.equal(await page.locator('#btn-gerar-despesa').isEnabled(),true);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Cartões: 7 cartões, 55 compras, paginação, filtros, total estável, nova compra, mês preservado, voltar e desktop/mobile OK.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
