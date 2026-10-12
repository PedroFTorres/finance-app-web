const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const eslintRequire = createRequire(fs.realpathSync(require.resolve('eslint/package.json')));
const espree = eslintRequire('espree');
const root = path.join(__dirname, '..');
const files = [...fs.readdirSync(root).filter(f=>f.endsWith('.html')),
  'investimentos/index.html'];

for (const file of files) {
  test(`HTML íntegro e scripts válidos: ${file}`, () => {
    const html = fs.readFileSync(path.join(root,file),'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,'IDs duplicados na página');
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g)) {
      const resource = match[1].split('?')[0];
      if (/^(?:https?:|\/\/|data:|#)/.test(resource)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(root,file)),resource)),`Recurso inexistente: ${resource}`);
    }
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (match[1].includes('src=')) continue;
      espree.parse(match[2], {ecmaVersion:'latest',sourceType:match[1].includes('module')?'module':'script'});
    }
  });
}
