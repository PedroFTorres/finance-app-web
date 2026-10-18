const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const helpers = source.slice(source.indexOf('function sanitizeFileName('), source.indexOf('let IS_SAVING_COMPROVANTES'));
const pdf = name => ({ name, type: 'application/pdf', size: 250 });

function setup(options = {}) {
  const row = { id: 'entry', user_id: 'owner', baixado: true, valor: 100, data: '2026-10-01',
    data_baixa: '2026-10-03', conta_id: 'bank', categoria_id: 'category', recorrencia_id: 'series',
    comprovantes: [], ...options.row };
  const uploads = [], removed = [], updates = [], queries = [];
  let sequence = 0;
  const ctx = vm.createContext({
    console, Date, Error, JSON, STATE: { user: { id: 'owner' } },
    COMPROVANTES_BUCKET: 'comprovantes', MAX_COMPROVANTE_BYTES: 10 * 1024 * 1024,
    hasFinancialAccess: () => options.access !== false, uid: () => `uuid-${++sequence}`,
    supabase: {
      storage: { from(bucket) {
        assert.equal(bucket, 'comprovantes');
        return {
          async upload(filePath, file, config) {
            uploads.push({ path: filePath, file, config });
            return { error: uploads.length === options.failUpload ? new Error('Upload falhou') : null };
          },
          async remove(paths) { removed.push(...paths); return { error: null }; }
        };
      } },
      from(table) {
        assert.ok(['receitas', 'despesas'].includes(table), 'Não pode tocar no extrato ou na recorrência');
        const filters = []; let patch;
        return {
          select() { return this; },
          update(value) { patch = value; updates.push(value); return this; },
          eq(key, value) { filters.push([key, value]); return this; },
          is(key, value) { filters.push([key, value]); return this; },
          async maybeSingle() {
            queries.push({ table, filters, patch });
            if (patch && options.conflict) return { data: null, error: null };
            if (patch && options.failSave) return { data: null, error: new Error('Gravação falhou') };
            const matches = filters.every(([key, value]) => key === 'comprovantes'
              ? (value === null ? row[key] == null : JSON.stringify(row[key]) === value)
              : row[key] === value);
            if (!matches) return { data: null, error: null };
            if (patch) Object.assign(row, JSON.parse(JSON.stringify(patch)));
            return { data: JSON.parse(JSON.stringify(row)), error: null };
          }
        };
      }
    }
  });
  vm.runInContext(helpers, ctx);
  return { ctx, row, uploads, removed, updates, queries, append: (tipo, files) => ctx.appendComprovantesLancamento(tipo, 'entry', files) };
}

for (const tipo of ['receita', 'despesa']) {
  test(`anexar após baixa em ${tipo} não altera valores, datas, conta ou recorrência`, async () => {
    const f = setup(); const original = { ...f.row };
    const result = await f.append(tipo, [pdf('comprovante.pdf')]);
    assert.equal(result.length, 1);
    assert.equal(f.row.comprovantes.length, 1);
    for (const key of Object.keys(original).filter(key => key !== 'comprovantes')) assert.equal(f.row[key], original[key]);
    assert.deepEqual(Object.keys(f.updates[0]).sort(), ['comprovante_nome', 'comprovante_path', 'comprovante_uploaded_at', 'comprovantes']);
    assert.ok(f.uploads[0].path.startsWith(`owner/${tipo}/entry/`));
    assert.equal(f.uploads[0].config.upsert, false);
    assert.ok(f.queries.every(query => query.filters.some(([key, value]) => key === 'user_id' && value === 'owner')));
  });
}

test('mantém comprovantes anteriores e compatibilidade com anexo legado', async () => {
  for (const row of [{ comprovantes: [{ path: 'old.pdf', nome: 'Anterior.pdf' }] },
    { comprovante_path: 'old.pdf', comprovante_nome: 'Anterior.pdf' }]) {
    const f = setup({ row });
    await f.append('despesa', [pdf('novo.pdf')]);
    assert.equal(f.row.comprovantes.length, 2);
    assert.equal(f.row.comprovante_path, 'old.pdf');
    assert.equal(f.row.comprovantes[0].nome, 'Anterior.pdf');
    assert.deepEqual(f.removed, []);
  }
});

test('falha no segundo upload remove somente o arquivo novo já enviado', async () => {
  const f = setup({ failUpload: 2 });
  await assert.rejects(f.append('despesa', [pdf('a.pdf'), pdf('b.pdf')]), /Upload falhou/);
  assert.deepEqual(f.removed, [f.uploads[0].path]);
  assert.equal(f.updates.length, 0);
});

for (const option of ['failSave', 'conflict']) {
  test(`${option}: preserva os anexos anteriores e limpa novos uploads não vinculados`, async () => {
    const f = setup({ [option]: true, row: { comprovantes: [{ path: 'old.pdf', nome: 'Anterior' }] } });
    await assert.rejects(f.append('despesa', [pdf('novo.pdf')]));
    assert.deepEqual(f.removed, [f.uploads[0].path]);
    assert.equal(f.row.comprovantes.length, 1);
    assert.equal(f.row.comprovantes[0].path, 'old.pdf');
  });
}

test('valida todos os arquivos antes de enviar: tipo, tamanho e seleção vazia', async () => {
  for (const files of [[], [pdf('ok.pdf'), { name: 'bad.exe', type: 'application/octet-stream', size: 20 }],
    [{ ...pdf('grande.pdf'), size: 10485761 }]]) {
    const f = setup();
    await assert.rejects(f.append('despesa', files));
    assert.equal(f.uploads.length, 0);
    assert.equal(f.updates.length, 0);
  }
});

test('bloqueia acesso sem plano, lançamento de outro dono ou baixa cancelada', async () => {
  for (const option of [{ access: false }, { row: { user_id: 'other' } }, { row: { baixado: false } }]) {
    const f = setup(option);
    await assert.rejects(f.append('despesa', [pdf('novo.pdf')]));
    assert.equal(f.uploads.length, 0);
    assert.equal(f.updates.length, 0);
  }
});

test('arquivos com o mesmo nome recebem caminhos únicos', async () => {
  const f = setup();
  await f.append('despesa', [pdf('recibo.pdf'), pdf('recibo.pdf')]);
  assert.notEqual(f.uploads[0].path, f.uploads[1].path);
  assert.equal(f.row.comprovantes.length, 2);
});
