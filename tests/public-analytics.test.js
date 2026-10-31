const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('medição está presente somente nas quatro páginas públicas autorizadas', () => {
  const allowed = ['index.html', 'vendas.html', 'controle-cartao-credito.html', 'como-controlar-compras-parceladas.html'];
  const files = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  files.push('investimentos/index.html', 'capitalizacao/index.html');
  for (const file of files) {
    const html = read(file);
    assert.equal(html.includes('src="public-analytics.js?'), allowed.includes(file), file);
    assert.doesNotMatch(html, /<script[^>]+src="https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com/);
  }
  assert.equal(read('index.html'), read('vendas.html'));
});
test('aviso acessível sem JavaScript e medições não se apresentam como conversões concluídas', () => {
  for (const file of ['index.html', 'vendas.html', 'controle-cartao-credito.html', 'como-controlar-compras-parceladas.html']) {
    assert.match(read(file), /href="privacidade-estatisticas.html"/);
  }
  const source = read('public-analytics.js');
  assert.match(source, /G-YCEFKJH08Z/);
  assert.match(source, /send_page_view: false/);
  assert.match(source, /allow_google_signals: false/);
  assert.match(source, /ad_user_data: 'denied'/);
  assert.match(source, /script.referrerPolicy = 'no-referrer'/);
  assert.doesNotMatch(source, /'purchase'|'sign_up'|user_id|link_text/);
  assert.match(read('privacidade-estatisticas.html'), /não é uma política completa/);
});
