// Public marketing page only: no login and no payment creation.
const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push(request));
  await page.goto('http://127.0.0.1:8766/vendas.html');
  for(const width of [1440,1024,768,390,375,320]){
   await page.setViewportSize({width,height:940});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow em ${width}px`);
   assert.equal(await page.locator('h1').count(),1);
   await page.getByRole('tab',{name:'Cartões',exact:true}).click();
   assert.equal(await page.locator('#preview-title').innerText(),'Cada compra, no seu lugar.');
   await page.keyboard.press('ArrowRight');
   assert.equal(await page.locator('#preview-title').innerText(),'Olhe além do saldo.');
   await page.keyboard.press('Home');
   assert.equal(await page.locator('#preview-title').innerText(),'Tudo o que falta resolver.');
   await page.getByText('O Arolix conecta automaticamente ao meu banco?',{exact:true}).click();
   assert.ok(await page.getByText('Não. Você cadastra suas contas e registra receitas, despesas e compras no Arolix.',{exact:false}).isVisible());
   await page.getByText('O Arolix conecta automaticamente ao meu banco?',{exact:true}).click();
   if(width===1440||width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/private/tmp/arolix-vendas-${width}.png`,fullPage:true});await page.screenshot({path:`/private/tmp/arolix-vendas-hero-${width}.png`});}
  }
  for(const anchor of await page.locator('a[href^="#"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')).filter(href=>href!=='#'))){assert.equal(await page.locator(anchor).count(),1,`Âncora ${anchor}`);}
  assert.equal(await page.getByRole('link',{name:'Já conheço o Arolix. Quero assinar Pro.'}).getAttribute('href'),'upgrade.html');
  assert.equal(await page.getByRole('link',{name:'Experimentar por 5 dias'}).getAttribute('href'),'login.html');
  assert.ok(requests.every(req=>req.method()==='GET'&&new URL(req.url()).hostname==='127.0.0.1'),'Sem rastreamento, chamadas externas ou criação de cobrança');
  assert.deepEqual(errors,[]);
  console.log('Vendas: seis larguras, abas por teclado, FAQ, links de acesso, sem overflow e sem chamadas externas OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
