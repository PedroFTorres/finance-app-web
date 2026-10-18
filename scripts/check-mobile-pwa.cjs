// Isolated local smoke test. App scripts/data services are blocked; no real account is accessed.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtime = process.env.AROLIX_BROWSER_RUNTIME || '/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root = path.resolve(__dirname,'..');
const mime = {'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  let content = fs.readFileSync(file);
  if(file.endsWith('.html')&&!file.endsWith('offline.html')){
    // Keep only installation and interface code; real financial/auth scripts never run.
    content = content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, tag=> /src="(?:\.\.\/)?(?:pwa|interface)\.js/.test(tag)?tag:'');
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(content);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const context = await browser.newContext();
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page = await context.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    for(const width of [375,390,430,1440]) {
      await page.setViewportSize({width,height:844});
      for(const file of ['app.html','cartao.html','investimentos/index.html','capitalizacao/index.html','login.html','perfil.html']) {
        await page.goto(`${origin}/${file}`);
        if(file==='app.html') {
          for(const screen of ['dashboard','contas','lanc','relatorios']) {
            await page.evaluate(name=>document.querySelectorAll('[data-screen]').forEach(el=>el.classList.toggle('hidden',el.dataset.screen!==name)),screen);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${file} ${screen} ${width}: overflow`);
          }
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${file} ${width}: overflow`);
        if(width<720) assert.ok(await page.locator('input:not([type=checkbox]):not([type=radio])').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height).every(n=>parseFloat(getComputedStyle(n).fontSize)>=16)),'Inputs causam zoom no iOS');
      }
    }
    await page.setViewportSize({width:390,height:844});await page.goto(`${origin}/app.html`);
    await page.evaluate(()=>{
      document.querySelectorAll('[data-screen]').forEach(el=>el.classList.toggle('hidden',el.dataset.screen!=='lanc'));
      document.getElementById('list-pendencias').innerHTML='<li class="lanc-item"><div class="lanc-item-main"><span class="lanc-date">18/10/2026</span><div><div class="lanc-title">Academia — mensalidade e acompanhamento</div><div class="lanc-meta"><span class="lanc-chip">Academia</span><span class="lanc-chip">A pagar</span></div></div></div><strong class="lanc-value lanc-value-expense">R$ 1.240,00</strong><div class="lanc-actions"><button>Editar</button><button>Baixar</button></div></li>';
    });
    await page.screenshot({path:'/private/tmp/arolix-lanc-mobile.png',fullPage:true});
    await page.evaluate(()=>document.getElementById('modal-add-lanc').classList.remove('hidden'));
    assert.ok(await page.locator('#modal-add-lanc .modal-card').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'Modal sai da tela');
    await page.locator('#modal-desc').fill('Compra de teste');
    await page.locator('#modal-save-lanc').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#modal-save-lanc').isVisible());
    await page.evaluate(()=>document.getElementById('modal-add-lanc').classList.add('hidden'));
    await page.locator('.shell-more').click();await page.getByRole('button',{name:'Instalar Arolix'}).click();
    await page.getByRole('dialog').waitFor({state:'visible'});
    assert.ok(await page.getByRole('dialog').getByText('No iPhone',{exact:true}).isVisible());
    await page.screenshot({path:'/private/tmp/arolix-install-mobile.png'});
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),false);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);
    assert.deepEqual(await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>(await (await caches.open(key)).keys()).map(req=>new URL(req.url).pathname)))).flat();}),['/offline.html']);
    await context.setOffline(true);await page.goto(`${origin}/cartao.html`);
    assert.ok(await page.getByText('Vamos reconectar?').isVisible());
    await context.setOffline(false);await page.getByRole('button',{name:'Tentar novamente'}).click();
    await page.locator('.shell-brand').waitFor();
    assert.deepEqual(errors,[]);
    console.log('Mobile: 375/390/430/1440px, seis páginas, instalação, SW sem dados privados e reconexão OK.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
