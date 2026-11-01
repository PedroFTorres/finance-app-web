const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('página principal explica a solução, preserva canonical e não exige JavaScript para SEO',()=>{
  const html=read('index.html');
  assert.equal(html,read('vendas.html'));
  assert.match(html,/<title>Arolix \| Aplicativo de controle financeiro pessoal<\/title>/);
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/APLICATIVO DE CONTROLE FINANCEIRO PESSOAL/);
  for(const text of ['receitas e despesas','contas a pagar e a receber','cartão de crédito','por categoria'])assert.ok(html.toLowerCase().includes(text));
  assert.match(html,/<link rel="canonical" href="https:\/\/arolix.com.br\/">/);
  assert.match(html,/<meta name="robots" content="index, follow/);
  assert.doesNotMatch(html,/name="keywords"|noindex|aggregateRating|reviewCount/);
});
test('dados estruturados descrevem somente o aplicativo e a oferta reais',()=>{
  const html=read('index.html');
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data['@context'],'https://schema.org');
  const website=data['@graph'].find(item=>item['@type']==='WebSite');
  assert.equal(website.name,'Arolix');assert.equal(website.url,'https://arolix.com.br/');
  const app=data['@graph'].find(item=>item['@type']==='WebApplication');
  assert.equal(app.applicationCategory,'FinanceApplication');assert.equal(app.offers.price,'19.90');
  assert.equal(app.offers.priceCurrency,'BRL');assert.match(app.offers.description,/30 dias/);
  assert.match(app.offers.description,/Investimentos e consulta CVM não inclusos/);
  assert.ok(html.includes('19,90'));assert.ok(html.includes('5 dias'));
});
test('oferta pública, planos e checkout mantêm o mesmo preço de 19,90',()=>{
  for(const file of ['index.html','vendas.html','controle-cartao-credito.html','como-controlar-compras-parceladas.html','upgrade.html','premium-access-client.js']){
    const source=read(file);
    assert.match(source,/19,90/,file);
    assert.doesNotMatch(source,/(?<!\d)9[,.]90(?!\d)/,file);
  }
  assert.match(read('supabase/functions/asaas-create-checkout/index.ts'),/const PLAN_VALUE = 19\.90;/);
  assert.match(read('supabase/functions/asaas-create-checkout/index.ts'),/const PLAN_DAYS = 30;/);
});
test('sitemap divulga somente páginas canônicas e robots permite ler noindex e recursos',()=>{
  const xml=read('sitemap.xml'),robots=read('robots.txt');
  assert.match(xml,/xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  const urls=Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g),match=>match[1]);
  assert.deepEqual(urls,['https://arolix.com.br/','https://arolix.com.br/controle-cartao-credito.html','https://arolix.com.br/como-controlar-compras-parceladas.html']);
  for(const url of urls){
    const file=new URL(url).pathname==='/'?'index.html':new URL(url).pathname.slice(1);
    assert.ok(fs.existsSync(path.join(root,file)));
    assert.ok(read(file).includes('<link rel="canonical" href="'+url+'">'));
  }
  assert.match(robots,/Sitemap: https:\/\/arolix.com.br\/sitemap.xml/);
  assert.match(robots,/User-agent: \*\nAllow: \//);
  assert.doesNotMatch(robots,/Disallow: \/(?:$|app.html|login.html|vendas.css|vendas.js)/m);
});
test('página de cartão e guia têm conteúdo distinto, links reais e dados estruturados honestos',()=>{
  for(const file of ['controle-cartao-credito.html','como-controlar-compras-parceladas.html']){
    const html=read(file);
    assert.equal((html.match(/<h1>/g)||[]).length,1);
    assert.match(html,/<meta name="robots" content="index, follow/);
    assert.doesNotMatch(html,/aggregateRating|reviewCount|name="keywords"|src="[^"]*supabase/);
    const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(data['@graph'].some(item=>item['@type']==='BreadcrumbList'));
    assert.ok(read('index.html').includes('href="'+file+'"'));
    assert.match(html,/href="login.html"/);
    assert.match(html,/5 dias/);assert.match(html,/19,90/);assert.match(html,/30 dias/);
  }
  assert.match(read('controle-cartao-credito.html'),/href="como-controlar-compras-parceladas.html"/);
  assert.match(read('como-controlar-compras-parceladas.html'),/href="controle-cartao-credito.html"/);
  assert.match(read('como-controlar-compras-parceladas.html'),/https:\/\/www.bcb.gov.br/);
});
test('telas internas e autenticação não disputam a busca com a página pública',()=>{
  for(const file of ['app.html','cartao.html','login.html','offline.html','pagamento-retorno.html','perfil.html','reset.html','upgrade.html','investimentos/index.html','capitalizacao/index.html']){
    const html=read(file);
    assert.equal((html.match(/name="robots"/g)||[]).length,1,file);
    assert.match(html,/<meta name="robots" content="noindex, follow">/,file);
  }
});
