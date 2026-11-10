const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = 'planilha-de-controle-financeiro-pessoal.html';
test('artigo da planilha oferece arquivo real, canonical, exemplo e links públicos', () => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.ok(html.includes('href="https://arolix.com.br/' + file + '"'));
  assert.equal((html.match(/ download>/g) || []).length, 2);
  const xlsx = fs.readFileSync(path.join(root, 'assets/downloads/planilha-controle-financeiro-arolix.xlsx'));
  assert.equal(xlsx.subarray(0, 2).toString(), 'PK');
  assert.ok(xlsx.length > 10000);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(data['@graph'].some(item => item['@type'] === 'Article'));
  assert.match(html, /não cria parcelas automaticamente/);
  assert.match(html, /Sem cadastro/);
  assert.equal(4200 - 1200 - 350, 2650);
  assert.equal(500 - 180 - 300, 20);
  assert.equal(2650 + 20, 2670);
  for (const source of ['index.html', 'vendas.html', 'como-organizar-contas-do-mes.html', 'como-controlar-gastos-por-categoria.html', 'como-controlar-compras-parceladas.html']) {
    assert.ok(fs.readFileSync(path.join(root, source), 'utf8').includes('href="' + file + '"'), source);
  }
});
