const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
test('páginas públicas declaram imagem de compartilhamento absoluta, nítida e com texto alternativo', () => {
  for (const file of ['index.html','vendas.html']) {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    const meta = key => {const tag = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)"`)); assert.ok(tag,`${file}: ${key}`); return tag[1];};
    assert.equal(meta('og:type'),'website');
    assert.equal(meta('og:url'),'https://arolix.com.br/');
    assert.equal(meta('og:site_name'),'Arolix');
    assert.ok(meta('og:title').includes('Arolix'));
    assert.ok(meta('og:description').length > 30);
    assert.equal(meta('twitter:card'),'summary_large_image');
    const url = new URL(meta('og:image'));
    assert.equal(url.origin,'https://arolix.com.br');
    assert.equal(meta('twitter:image'),url.href);
    assert.equal(meta('og:image:secure_url'),url.href);
    assert.ok(meta('og:image:alt').includes('Arolix'));
    const png = fs.readFileSync(path.join(root,url.pathname));
    assert.equal(png.readUInt32BE(16),Number(meta('og:image:width')));
    assert.equal(png.readUInt32BE(20),Number(meta('og:image:height')));
    assert.ok(png.length < 300000,'Imagem leve para compartilhar');
  }
});
