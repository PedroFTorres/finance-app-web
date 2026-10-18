const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

test('manifest inicia no app existente e ícones PNG têm as dimensões declaradas', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest')));
  assert.equal(manifest.start_url, './app.html');
  assert.equal(manifest.display, 'standalone');
  for (const icon of [...manifest.icons, { src:'assets/pwa/apple-touch-icon.png', sizes:'180x180' }]) {
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
test('páginas principais e autenticação usam a mesma instalação e viewport móvel', () => {
  for (const file of ['app.html','cartao.html','investimentos/index.html','capitalizacao/index.html','index.html','login.html','perfil.html','reset.html','upgrade.html','pagamento-retorno.html']) {
    const html = fs.readFileSync(path.join(root, file),'utf8');
    assert.match(html, /viewport-fit=cover/, file);
    assert.match(html, /rel="manifest"/, file);
    assert.match(html, /apple-touch-icon/, file);
    assert.match(html, /mobile.css\?/, file);
    assert.match(html, /pwa.js\?[^" ]*" defer/, file);
    assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/, file);
  }
});
function worker(fetch) {
  const handlers = {}, added = [], deleted = [];
  const cached = new Response('<h1>Sem conexão</h1>');
  const cache = {add:async url=>added.push(url),match:async()=>cached};
  const context = { URL, Response, fetch,
    self:{registration:{scope:'https://arolix.test/'},location:{origin:'https://arolix.test'},addEventListener:(name, fn)=>{handlers[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
    caches:{open:async()=>cache,keys:async()=>['arolix-offline-v0','other-app'],delete:async key=>deleted.push(key)}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root,'service-worker.js'),'utf8'), context);
  return {handlers, added, deleted, cached};
}
test('service worker guarda somente o aviso público, preservando caches de outros apps', async () => {
  const w = worker(); let pending;
  w.handlers.install({waitUntil:p=>{pending=p;}}); await pending;
  assert.deepEqual(w.added, ['https://arolix.test/offline.html']);
  w.handlers.activate({waitUntil:p=>{pending=p;}}); await pending;
  assert.deepEqual(w.deleted, ['arolix-offline-v0']);
});
test('API, comprovantes, POST e recursos de outros domínios não são interceptados', () => {
  const w = worker(()=>{throw Error('Não deve buscar');});
  for (const request of [
    {url:'https://arolix.test/app.html',method:'POST',mode:'navigate'},
    {url:'https://project.supabase.co/rest/v1/despesas',method:'GET',mode:'cors'},
    {url:'https://arolix.test/private/receipt.pdf',method:'GET',mode:'same-origin'},
    {url:'https://external.test/',method:'GET',mode:'navigate'}
  ]) w.handlers.fetch({request, respondWith:()=>assert.fail('Interceptou pedido privado ou fora do escopo')});
});
test('navegação usa sempre a rede e só retorna aviso quando não há conexão', async () => {
  const online = new Response('atualizado'); let result;
  const request = {url:'https://arolix.test/app.html',method:'GET',mode:'navigate'};
  worker(async()=>online).handlers.fetch({request,respondWith:p=>{result=p;}});
  assert.equal(await result,online);
  const offline = worker(async()=>{throw Error('offline');});
  offline.handlers.fetch({request,respondWith:p=>{result=p;}});
  assert.equal(await result,offline.cached);
});
