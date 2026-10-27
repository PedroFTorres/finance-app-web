// Real report frontend; all financial reads use fixtures. No real account access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
const fixture=`(()=>{
 const tables={receitas:[{id:'salary',user_id:'owner',valor:1000,baixado:true,data:'2026-09-30',data_baixa:'2026-10-10',categoria_id:'salary',conta_id:'bank'},
 {id:'future',user_id:'owner',valor:200,baixado:false,data:'2026-10-30',categoria_id:'salary',conta_id:'bank'}],
 despesas:[{id:'cash',user_id:'owner',descricao:'Academia avulsa',valor:32,baixado:true,data_baixa:'2026-10-02',data:'2026-10-02',categoria_id:'gym',conta_id:'bank'},
 {id:'bill',user_id:'owner',descricao:'Fatura',valor:300,baixado:true,data:'2026-10-20',data_baixa:'2026-10-20',categoria_id:'card',cartao_fatura_id:'f',conta_id:'bank'},
 {id:'pending',user_id:'owner',valor:50,baixado:false,data:'2026-10-31',categoria_id:'gym',conta_id:'bank'}],
 movimentacoes:[{id:'m',user_id:'owner',lancamento_id:'bill',valor:305.3,tipo:'debito',data:'2026-10-20',conta_id:'bank'}],
 cartao_lancamentos:[{id:'gym-buy',user_id:'owner',cartao_id:'cc',categoria_id:'gym',descricao:'Academia no cartão',valor:240,tipo:'compra',data_fatura:'2026-10-01',data_compra:'2026-09-26'},
 {id:'food-buy',user_id:'owner',cartao_id:'cc',categoria_id:'food',descricao:'Mercado',valor:60,tipo:'compra',data_fatura:'2026-10-01'}],
 cartao_faturas:[{id:'f',user_id:'owner',cartao_id:'cc',ano:2026,mes:10,status:'paga',pago:true}],cartoes_credito:[{id:'cc',user_id:'owner',nome:'Cartão teste',dia_vencimento:20}]};
 window.STATE={user:{id:'owner'},categorias:[{id:'gym',nome:'Academia'},{id:'food',nome:'Alimentação'},{id:'salary',nome:'Salários'},{id:'card',nome:'Cartão de Crédito'}],contas:[{id:'bank',nome:'Banco teste'}]};
 window.supabase={from(table){let filters=[],range;return {select(){return this},order(){return this},range(a,b){range=[a,b+1];return this},eq(k,v){filters.push(r=>r[k]===v);return this},neq(k,v){filters.push(r=>r[k]!==v);return this},gte(k,v){filters.push(r=>r[k]>=v);return this},lte(k,v){filters.push(r=>r[k]<=v);return this},in(k,v){filters.push(r=>v.includes(r[k]));return this},then(resolve){let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(range)rows=rows.slice(...range);return Promise.resolve({data:structuredClone(rows),error:null}).then(resolve)}}}};
 document.querySelector('[data-screen="relatorios"]').classList.remove('hidden');
 window.ArolixReports.open('balanco');
})();`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='balance.test')return route.abort();
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   let content=fs.readFileSync(file);
   if(url.pathname==='/app.js')content=fixture;
   if(url.pathname==='/app.html')content=content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,tag=>/src="(?:interface|runtime-utils|reports-rules|reports|app)\.js/.test(tag)?tag:'');
   return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/javascript',body:content});
  });
  await page.goto('https://balance.test/app.html');
  await page.locator('#report-month').fill('2026-01');await page.locator('#report-month').dispatchEvent('change');
  await page.locator('#report-previous').click();assert.equal(await page.locator('#report-month').inputValue(),'2025-12');
  await page.locator('#report-next').click();assert.equal(await page.locator('#report-month').inputValue(),'2026-01');
  await page.locator('#report-month').fill('2028-02');await page.locator('#report-month').dispatchEvent('change');
  assert.equal(await page.locator('#report-end').inputValue(),'2028-02-29');
  assert.equal(await page.locator('#report-custom-dates').isVisible(),false);
  await page.locator('#report-period').selectOption('year');await page.locator('#report-year').fill('2026');await page.locator('#report-year').dispatchEvent('change');
  await page.locator('#report-next').click();assert.equal(await page.locator('#report-end').inputValue(),'2027-12-31');
  await page.locator('#report-period').selectOption('future');assert.equal(await page.locator('#report-period-navigation').isVisible(),false);
  assert.equal(await page.locator('#report-future-range').isVisible(),true);
  await page.locator('#report-more-filters summary').click();await page.locator('#report-overdue').check();
  assert.equal(await page.locator('#report-more-count').isVisible(),true);
  await page.locator('#report-clear-filters').click();assert.equal(await page.locator('#report-overdue').isChecked(),false);
  await page.locator('#report-more-filters summary').click();
  await page.locator('#report-period').selectOption('custom');await page.locator('#report-start').fill('2026-10-01');await page.locator('#report-end').fill('2026-10-31');await page.locator('#report-refresh').click();
  await page.waitForFunction(()=>document.getElementById('report-paid').textContent.includes('337,30'));
  const gym=page.locator('#report-content tbody tr').filter({hasText:'Academia'});
  assert.equal(await gym.count(),1);assert.match(await gym.innerText(),/272,00/);assert.match(await gym.innerText(),/50,00/);assert.match(await gym.innerText(),/Lançamentos \+ cartão/);
  assert.equal(await page.locator('#report-content details').count(),0);assert.equal(await page.getByText('Detalhamento · clique na categoria para ver os lançamentos').count(),0);
  assert.equal(await page.locator('#report-content tbody tr').filter({hasText:'Cartão de Crédito'}).count(),0);
  assert.match(await page.locator('#report-realized').innerText(),/662,70/);assert.match(await page.locator('#report-pending-balance').innerText(),/150,00/);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/arolix-balance-clean-'+width+'.png',fullPage:true});}
  await page.locator('#report-category').selectOption('gym');await page.waitForFunction(()=>document.getElementById('report-paid').textContent.includes('272,00'));
  const pending=page.waitForEvent('download');await page.locator('#report-export').click();const file=await pending,stream=await file.createReadStream();let csv='';for await(const chunk of stream)csv+=chunk.toString();assert.ok(csv.includes('Academia no cartão'));assert.ok(csv.includes('Academia avulsa'));
  assert.equal(await page.locator('[data-report-mode]').count(),0);
  assert.equal(await page.locator('#report-heading').innerText(),'Balanço financeiro');
  assert.equal(await page.locator('#report-card-back').isVisible(),false);
  await page.evaluate(()=>window.ArolixReports.open('lancamentos',{start:'2026-10-01',end:'2026-10-31',lane:'pagos',account:'bank'}));
  await page.waitForFunction(()=>document.querySelector('.transaction-report-table'));
  assert.equal(await page.locator('#report-heading').innerText(),'Relatório de lançamentos');
  assert.equal(await page.locator('#transaction-report-kind').inputValue(),'expense');
  assert.equal(await page.locator('#transaction-report-status').inputValue(),'paid');
  assert.equal(await page.locator('#report-account').inputValue(),'bank');
  assert.match(await page.locator('.transaction-report-table').innerText(),/305,30/);
  assert.equal(await page.locator('#report-balance-summary').isVisible(),false);
  await page.locator('#transaction-report-status').selectOption('all');
  await page.locator('#transaction-report-kind').selectOption('all');
  await page.locator('.transaction-report-categories summary').click();
  await page.locator('#transaction-report-categories input[value="gym"]').check();
  await page.locator('#transaction-report-categories input[value="salary"]').check();
  assert.equal(await page.locator('.transaction-report-table tbody tr').count(),4);
  assert.match(await page.locator('.transaction-report-table').innerText(),/1.282,00/);
  const csvWait=page.waitForEvent('download');await page.locator('#report-export').click();const csvFile=await csvWait;
  let transactionCsv='';for await(const chunk of await csvFile.createReadStream())transactionCsv+=chunk.toString();
  assert.match(transactionCsv,/Pagamento \/ recebimento/);assert.match(transactionCsv,/Total da listagem/);
  assert.ok(!transactionCsv.includes('Mercado'));
  await page.locator('.transaction-report-categories summary').click();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/arolix-transaction-report-'+width+'.png'});}
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.transaction-report-table').isVisible(),true);
  assert.equal(await page.locator('#transaction-report-controls').isVisible(),false);
  assert.equal(await page.locator('#report-period-caption').isVisible(),true);
  assert.equal(await page.locator('.reports-filters').isVisible(),false);
  await page.emulateMedia({media:'screen'});
  await page.locator('#report-clear-filters').click();
  assert.equal(await page.locator('#transaction-report-categories input:checked').count(),0);
  await page.evaluate(()=>window.ArolixReports.open('cartao'));await page.locator('#report-content details').first().waitFor();
  assert.equal(await page.locator('#report-heading').innerText(),'Consulta de compras no cartão');
  assert.equal(await page.locator('#report-card-back').getAttribute('href'),'cartao.html');
  assert.equal(await page.locator('#report-card-back').isVisible(),true);
  await page.evaluate(()=>window.ArolixReports.open());
  assert.equal(await page.locator('#report-heading').innerText(),'Balanço financeiro');
  assert.equal(await page.locator('#report-card-back').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('Balanço: categoria única, cartão + lançamentos pagos, juros, previsões, sem detalhamento duplicado, filtros, CSV e mobile OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
