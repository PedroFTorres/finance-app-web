// Public pages only. No session, database access, tracking or payment creation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8766';
const cents=text=>Math.round(Number(text.replace(/[^\d,]/g,'').replace(',','.'))*100);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[],requests=[],bad=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request));
  page.on('response',response=>{if(response.status()>=400)bad.push(response.url());});
  for(const file of ['controle-cartao-credito.html','como-controlar-compras-parceladas.html','como-organizar-contas-do-mes.html']){
   await page.goto(origin+'/'+file);
   assert.equal(await page.locator('h1').count(),1);assert.match(await page.title(),/Arolix/);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://arolix.com.br/'+file);
   JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
   for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+': overflow '+width);
    assert.equal(await page.getByRole('link',{name:'Entrar',exact:true}).getAttribute('href'),'login.html');
    if(width===1440||width===390){
     await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/private/tmp/arolix-'+file.replace('.html','')+'-'+width+'-top.png'});
     const section=file.startsWith('como-')?'#exemplo':'#como-funciona';
     await page.locator(section).scrollIntoViewIfNeeded();
     await page.screenshot({path:'/private/tmp/arolix-'+file.replace('.html','')+'-'+width+'-detail.png'});
    }
   }
   for(const href of await page.locator('a[href]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))){
    const url=new URL(href,page.url());if(url.origin!==origin)continue;
    const target=url.pathname==='/'?'index.html':url.pathname.slice(1);
    assert.ok(fs.existsSync(path.join(root,target)),file+': missing '+href);
    if(target===file&&url.hash)assert.equal(await page.locator(url.hash).count(),1,'Missing anchor '+href);
   }
   if(file==='como-organizar-contas-do-mes.html'){
    const rows=await page.locator('#monthly-example tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.cells,cell=>cell.textContent)));
    const total=status=>rows.filter(row=>row[3]===status).reduce((sum,row)=>sum+cents(row[4]),0);
    assert.equal(total('Recebido'),320000);assert.equal(total('Pago'),180000);
    assert.equal(total('A receber'),80000);assert.equal(total('A pagar'),125000);
    const realized=total('Recebido')-total('Pago'),pending=total('A receber')-total('A pagar');
    assert.equal(realized,140000);assert.equal(pending,-45000);assert.equal(realized+pending,95000);
    assert.equal(20000+realized,160000);assert.equal(20000+realized+pending,115000);
    const summary=await page.locator('#monthly-summary tbody td').allTextContents();
    assert.deepEqual(summary.map(value=>cents(value)*(/−/.test(value)?-1:1)),[320000,180000,140000,80000,125000,-45000]);
    assert.equal(cents(await page.locator('#monthly-summary tfoot td').innerText()),realized+pending);
   }else if(file.startsWith('como-')){
    const purchaseRows=await page.locator('#example-purchases tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.cells,cell=>cell.textContent)));
    let total=0;for(const row of purchaseRows){const value=cents(row[1]);assert.equal(value,Number(row[2].match(/\d+/)[0])*cents(row[3]));total+=value;}
    assert.equal(total,210000);
    const months=await page.locator('#example-months tbody tr td:last-child').allTextContents();
    assert.deepEqual(months.map(cents),[50000,50000,50000,20000,20000,20000]);
    assert.equal(months.reduce((sum,value)=>sum+cents(value),0),total);
   }else{
    assert.match(await page.locator('.invoice-demo-total strong').innerText(),/500,00/);
    await page.getByText('O aplicativo importa as compras do banco?',{exact:true}).click();
    assert.equal(await page.getByText('Não automaticamente.',{exact:false}).isVisible(),true);
   }
  }
  const noJS=await browser.newPage({javaScriptEnabled:false});
  for(const file of ['controle-cartao-credito.html','como-controlar-compras-parceladas.html','como-organizar-contas-do-mes.html']){
   await noJS.goto(origin+'/'+file);assert.equal(await noJS.locator('h1').isVisible(),true);
   assert.equal(await noJS.locator('a[href="login.html"]').count()>0,true);
  }
  await noJS.close();
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  assert.ok(requests.every(request=>request.method()==='GET'&&new URL(request.url()).origin===origin));
  console.log('Public SEO pages: metadata, static content, links, FAQ, five widths, example arithmetic and no external requests OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
