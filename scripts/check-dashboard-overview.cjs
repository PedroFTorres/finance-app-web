// Real markup, styles, overview renderer and dashboard hook. Backend replaced with fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const runtime=process.env.AROLIX_BROWSER_RUNTIME||'/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=createRequire(path.join(runtime,'playwright/package.json'))('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const hook=source.slice(source.indexOf('async function atualizarDashboardPorMes()'),source.indexOf('function atualizarValorFinalBaixa()'));
const fixture=`
 const STATE={},IDS={selectContas:'select-contas-lanc'};
 let dashboardRequest=0,mesDashboardAtual=new Date(2026,10,1),modoPeriodoLanc='custom',mesLancAtual=new Date(2026,0,1),LANC_INIT=false,FILTRO_LANCAMENTOS='pagos';
 const $=id=>document.getElementById(id),categoriaNome=id=>id==='gym'?'Academia':'Moradia';
 window.__data={pendentesReceita:[{id:'r1',descricao:'Salário',data:'2026-11-30',valor:4200,categoria_nome:'Salários'}],pendentesDespesa:[{id:'d1',descricao:'Condomínio',data:'2026-11-04',valor:450},{id:'d2',descricao:'Academia',data:'2026-11-10',valor:240,categoria_id:'gym'},{id:'d3',descricao:'Internet',data:'2026-11-12',valor:99.90},{id:'d4',descricao:'Energia',data:'2026-11-15',valor:150},{id:'d5',descricao:'Conta já paga',data:'2026-11-03',valor:30,baixado:true}],previsoesCartao:[{id:'cc1',descricao:'Fatura aberta — Cartão teste',data:'2026-11-01',valor:820,provisorio_cartao:true}]};
 async function carregarDadosDashboard(){return window.__data;}
 function drawResumo(){document.getElementById('dash-receber').textContent='R$ 4.200,00';document.getElementById('dash-pagar').textContent='R$ 1.759,90';document.getElementById('dash-saldo-atual').textContent='R$ 500,00';document.getElementById('dash-saldo-previsto').textContent='R$ 2.440,10';}
 function drawReceitasPorCategoria(){}function drawDespesasPorCategoria(){}function drawInvestimentosDashboard(){}function renderMesDashboard(){document.getElementById('dash-mes-label').textContent='Novembro 2026';}function showDataError(error){throw error;}
 const App={showScreen(name){window.__opened={name,mode:modoPeriodoLanc,date:[mesLancAtual.getFullYear(),mesLancAtual.getMonth()],tab:FILTRO_LANCAMENTOS,init:LANC_INIT};}};
 ${hook}
 document.querySelector('[data-screen="dashboard"]').classList.remove('hidden');
 atualizarDashboardPorMes();
 window.__refreshOverview=atualizarDashboardPorMes;
`;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='overview.test')return route.abort();
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   let content=fs.readFileSync(file);
   if(url.pathname==='/app.js')content=fixture;
   if(url.pathname==='/app.html')content=content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,tag=>/src="(?:interface|runtime-utils|dashboard-overview|app)\.js/.test(tag)?tag:'');
   return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/javascript',body:content});
  });
  for(const width of [1440,1024,768,390,375,320]){
   await page.setViewportSize({width,height:1000});await page.goto('https://overview.test/app.html');
   await page.locator('.overview-agenda-row').first().waitFor();
   assert.equal(await page.locator('.overview-agenda-row').count(),5);
   assert.match(await page.locator('#dashboard-agenda-count').innerText(),/5 de 6/);
   assert.equal(await page.locator('.overview-agenda-row').filter({hasText:'Conta já paga'}).count(),0);
   assert.match(await page.locator('.overview-cartao .overview-date').getAttribute('aria-label'),/referência: 11\/2026/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow em ${width}`);
   if(width===1440||width===390)await page.screenshot({path:'/private/tmp/arolix-overview-'+width+'.png'});
   await page.locator('#dashboard-agenda-all').click();
   assert.deepEqual(await page.evaluate(()=>window.__opened),{name:'lanc',mode:'mes',date:[2026,10],tab:'pendencias',init:true});
  }
  await page.evaluate(async()=>{window.__data={pendentesDespesa:[{id:'x',descricao:'<img src=x onerror=alert(1)>',valor:20,data:'2026-11-01'}]};await window.__refreshOverview();});
  assert.equal(await page.locator('#dashboard-agenda-list img').count(),0);
  await page.evaluate(async()=>{window.__data={};await window.__refreshOverview();});
  assert.ok(await page.getByText('Nenhuma pendência neste período.',{exact:true}).isVisible());
  assert.deepEqual(errors,[]);
  console.log('Visão geral: seis larguras, cinco compromissos, fatura por referência, pagos excluídos, Ver todos no mesmo mês, texto seguro e vazio OK.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
