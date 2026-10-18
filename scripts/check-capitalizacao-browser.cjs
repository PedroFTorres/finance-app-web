// Smoke test isolado: frontend real e dados fictícios. Não acessa o Supabase real.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtimeRoot = process.env.AROLIX_BROWSER_RUNTIME || '/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = createRequire(path.join(runtimeRoot, 'playwright/package.json'))('playwright');
const root = path.resolve(__dirname, '..');
const mock = `(() => {
const user={id:'11111111-1111-4111-8111-111111111111',email:'teste@example.test'};
const tables={user_profiles:[{id:user.id,plano:'vip',subscription_status:'active'}],
capitalizacao_titulos:[{id:'t48',user_id:user.id,nome:'DinDin 48 teste',instituicao:'Santander',numero_titulo:'ICE-teste',prazo_meses:48,valor_parcela:100,inicio_vigencia:'2026-09-16',fim_vigencia:'2030-09-16',dia_cobranca:16,reajuste:'igpm_anual',regra_resgate:'raspa48_662222_2024',processo_susep:'15414.662222/2024-10',status:'ativo'}],
capitalizacao_pagamentos:[],capitalizacao_recebimentos:[],
despesas:[{id:'d1',user_id:user.id,descricao:'DinDin ICE-teste (1/48)',valor:100,data:'2026-09-16',data_baixa:'2026-09-16',baixado:true,recorrencia_id:'series'},
{id:'d2',user_id:user.id,descricao:'DinDin ICE-teste (2/48)',valor:100,data:'2026-10-16',data_baixa:'2026-10-16',baixado:true,recorrencia_id:'series'},
{id:'d3',user_id:user.id,descricao:'DinDin ICE-teste (3/48)',valor:100,data:'2026-11-16',baixado:false,recorrencia_id:'series'}],
receitas:[{id:'prize',user_id:user.id,descricao:'Prêmio DinDin',valor:50,data:'2026-10-16',data_baixa:'2026-10-16',baixado:true}],
cartao_lancamentos:[],cartao_faturas:[],movimentacoes:[{user_id:user.id,lancamento_id:'prize',tipo:'credito',valor:50}]};
window.__tables=tables;window.__writes=[];
function query(table){let filters=[],single=false,patch=null,added=null,del=false,range;
const q={select(){return this;},eq(k,v){filters.push(r=>r[k]===v);return this;},in(k,v){filters.push(r=>v.includes(r[k]));return this;},order(){return this;},range(a,b){range=[a,b+1];return this;},maybeSingle(){single=true;return this;},
insert(values){added=Array.isArray(values)?values:[values];return this;},update(value){patch=value;return this;},delete(){del=true;return this;},
then(resolve){let rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(added){rows=added.map(r=>({id:crypto.randomUUID(),...r}));(tables[table]??=[]).push(...rows);window.__writes.push(table);}
if(patch){rows.forEach(r=>Object.assign(r,patch));window.__writes.push(table);}if(del){tables[table]=tables[table].filter(r=>!rows.includes(r));window.__writes.push(table);}if(range)rows=rows.slice(...range);
return Promise.resolve({data:single?(rows[0]||null):structuredClone(rows),error:null}).then(resolve);}};return q;}
window.supabase={from:query,auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),signOut:async()=>({error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2',nextLevel:'aal2'}}),listFactors:async()=>({data:{all:[{status:'verified'}]}})}}};
})();`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='cap.test')return route.fulfill({status:404,body:''});
  if(url.pathname==='/supabase.js')return route.fulfill({contentType:'application/javascript',body:mock});
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'missing'});
  const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml'};
  return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('https://cap.test/capitalizacao/index.html');
 await page.locator('#novo-titulo:enabled').waitFor();
 const card=page.locator('.cap-title-card').filter({hasText:'DinDin 48 teste'});
 await card.getByRole('button',{name:'Vincular parcelas'}).click();
 await page.locator('#link-options input').first().check();await page.locator('#link-mode').selectOption('series');
 await page.locator('#save-links').click();await page.locator('#links-dialog').waitFor({state:'hidden'});
 await card.getByText('2 de 48 parcelas pagas').waitFor();assert.match(await page.locator('#cap-pago').innerText(),/R\$\s200,00/);
 assert.match(await card.innerText(),/R\$\s100,00/);
 await page.locator('#novo-titulo').click();await page.locator('#modelo').selectOption('raspa60');
 await page.locator('#nome').fill('DinDin 60 teste');await page.locator('#parcela').fill('100,00');await page.locator('#inicio').fill('2026-09-16');await page.locator('#inicio').dispatchEvent('change');
 await page.locator('#salvar-titulo').click();await page.locator('#title-dialog').waitFor({state:'hidden'});
 const second=page.locator('.cap-title-card').filter({hasText:'DinDin 60 teste'});await second.waitFor();assert.ok((await second.innerText()).includes('Não calculado'));
 await card.getByRole('button',{name:'Prêmios e resgates'}).click();await page.locator('#event-source').selectOption('prize');await page.locator('#save-event').click();await page.locator('#events-dialog').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.getElementById('cap-premios').textContent.includes('50,00'));
 assert.match(await page.locator('#cap-premios').innerText(),/R\$\s50,00/);
 await card.getByRole('button',{name:'Editar dados'}).click();await page.locator('#title-dialog summary').click();await page.locator('#cotacao').fill('0,00');await page.locator('#data-cotacao').fill('2026-10-18');await page.locator('#salvar-titulo').click();await page.locator('#title-dialog').waitFor({state:'hidden'});
 await card.getByText('Resgate informado pelo banco').waitFor();
 const snapshots=await page.evaluate(()=>({writes:window.__writes,despesas:window.__tables.despesas,receitas:window.__tables.receitas}));
 assert.ok(snapshots.writes.every(t=>t.startsWith('capitalizacao_')));assert.equal(snapshots.despesas.length,3);assert.equal(snapshots.receitas.length,1);assert.equal(snapshots.despesas[2].baixado,false);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow da página');
  await page.waitForTimeout(300);
  await page.screenshot({path:'/private/tmp/capitalizacao-'+width+'.png',fullPage:true});
  if(width===390)await page.screenshot({path:'/private/tmp/capitalizacao-mobile-viewport.png'});
 }
 await card.getByRole('button',{name:'Vincular parcelas'}).click();assert.ok(await page.evaluate(()=>document.querySelector('#links-dialog').getBoundingClientRect().right<=innerWidth));await page.keyboard.press('Escape');
 await page.locator('.shell-more').click();assert.ok(await page.locator('[data-shell-page="capitalizacao"]').isVisible());
 assert.deepEqual(errors,[]);await browser.close();console.log('Capitalização: cadastro, série, 60 sem estimativa, prêmio, consulta zero, desktop e celular OK.');
})().catch(error=>{console.error(error);process.exit(1);});
