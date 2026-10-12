const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const runtime = require('../runtime-utils.js');

const source = fs.readFileSync(path.join(__dirname, '../cartao.js'), 'utf8');
const flow = source.slice(source.indexOf('  let IS_ANTICIPATING_PARCEL'), source.indexOf('  // ===========================// POPULAR SELECTS PARA EDIÇÃO'));

function setup({ blocked = '', failure = false, current = false } = {}) {
  const now = new Date();
  const target = runtime.localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const future = runtime.localISODate(new Date(now.getFullYear(), now.getMonth() + 2, 1));
  const row = { id: 'parcel', user_id: 'owner', cartao_id: 'card', tipo: 'compra', valor: 120,
    data_compra: '2025-12-10', data_fatura: current ? target : future,
    categoria_id: 'category', parcelas: 10, parcela_atual: 4, descricao: 'Compra (4/10)' };
  const messages = [], queries = [], validations = [];
  const ctx = vm.createContext({
    Date, Number, Error, console: { error() {} },
    window: { ArolixRuntime: runtime },
    state: { user: { id: 'owner' }, editingPurchaseParcels: [{ ...row }] },
    mesFatura: now, confirm: () => true, formatReal: value => String(value),
    showToast: message => messages.push(message), renderParcelasEdicao() {},
    popularMesFatura() {}, atualizarEstadoBotoesMes() {}, loadFaturaForSelected: async () => {},
    podeEditarLancamentoCartao: async item => {
      validations.push(item.data_fatura);
      return item.data_fatura !== (blocked === 'source' ? future : blocked === 'target' ? target : '');
    },
    supabase: { from(table) {
      assert.equal(table, 'cartao_lancamentos');
      let patch = null;
      const filters = {};
      return {
        select() { return this; }, eq(key, value) { filters[key] = value; return this; },
        update(value) { patch = value; return this; },
        async maybeSingle() {
          queries.push({ patch, filters });
          if (!patch) return { data: { ...row }, error: null };
          if (failure) return { data: null, error: new Error('Falha ao salvar') };
          Object.assign(row, patch);
          return { data: { id: row.id }, error: null };
        },
        insert() { throw new Error('Antecipação não deve criar crédito ou duplicar parcela'); }
      };
    } }
  });
  vm.runInContext(flow, ctx);
  return { ctx, row, target, future, messages, queries, validations };
}

test('antecipação move o débito original para o mês atual sem criar crédito', async () => {
  const f = setup();
  const original = { ...f.row };
  await f.ctx.anteciparParcela('parcel');
  assert.equal(f.row.data_fatura, f.target);
  for (const key of Object.keys(original).filter(key => key !== 'data_fatura')) {
    assert.equal(f.row[key], original[key], key);
  }
  assert.equal(f.row.valor, 120);
  assert.equal(f.row.tipo, 'compra');
  assert.deepEqual(f.validations, [f.future, f.target]);
  assert.equal(f.queries[1].filters.user_id, 'owner');
  assert.equal(f.queries[1].filters.data_fatura, f.future);
  // Repeating the action cannot debit the invoice twice.
  await f.ctx.anteciparParcela('parcel');
  assert.equal(f.queries.filter(q => q.patch).length, 1);
});

for (const blocked of ['source', 'target']) {
  test(`antecipação bloqueia fatura fechada na ${blocked === 'source' ? 'origem' : 'destino'}`, async () => {
    const f = setup({ blocked });
    await f.ctx.anteciparParcela('parcel');
    assert.equal(f.row.data_fatura, f.future);
    assert.equal(f.queries.filter(q => q.patch).length, 0);
  });
}

test('falha ao salvar não anuncia sucesso nem altera a parcela local', async () => {
  const f = setup({ failure: true });
  await f.ctx.anteciparParcela('parcel');
  assert.equal(f.row.data_fatura, f.future);
  assert.equal(f.ctx.state.editingPurchaseParcels[0].data_fatura, f.future);
  assert.equal(f.messages[0], 'Falha ao salvar');
});

test('parcela já no mês atual não pode ser antecipada outra vez', async () => {
  const f = setup({ current: true });
  await f.ctx.anteciparParcela('parcel');
  assert.equal(f.queries.filter(q => q.patch).length, 0);
});
