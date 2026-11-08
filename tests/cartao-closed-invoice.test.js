const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const runtime = require('../runtime-utils.js');

const source = fs.readFileSync(path.join(__dirname, '../cartao.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const flow = [
  section('  function isFaturaFechada', '  function getMesAnoFromISO'),
  section('if (btnAddPurchase) {', ' // ===========================// PAGAMENTO PARCIAL COMPLETO'),
  section('function popularFaturasLancamento', '  // ===========================// SELECTS AUXILIARES'),
].join('\n');

function setup({ invoices = [], lookupError = null, insertError = null, period = '2026-11', installments = 3 } = {}) {
  const writes = [], messages = [], filters = [];
  const button = { disabled: false, textContent: 'Salvar compra' };
  const description = { value: 'Compra' };
  const select = {
    value: period,
    replaceChildren(...options) { this.options = options; },
    add(option) { this.options.push(option); },
  };
  const state = { user: { id: 'owner' }, cartaoLancamentoAtual: 'card' };
  const ctx = vm.createContext({
    IS_SAVING_PURCHASE: false,
    btnAddPurchase: button,
    selectFaturaInicial: select,
    cartDesc: description,
    cartValor: { value: '100' },
    cartData: { value: '2026-11-08' },
    cartParcelas: { value: installments },
    selectCategoriaLancCartao: { value: 'category' },
    mesFatura: new Date(2026, 10, 1),
    Option: function (label, value) { this.label = label; this.value = value; },
    state,
    crypto: { randomUUID: () => 'id' },
    document: { getElementById: () => ({ classList: { add() {} } }) },
    console: { error() {} },
    showToast: message => messages.push(message),
    loadFaturaForSelected: async () => {},
    window: { ArolixRuntime: { ...runtime, selectAll: async () => ({ data: invoices, error: lookupError }) } },
    supabase: { from(table) {
      if (table === 'cartao_faturas') {
        return { select() { return this; }, eq(...args) { filters.push(args); return this; } };
      }
      assert.equal(table, 'cartao_lancamentos');
      return { async insert(rows) { writes.push(rows); return { error: insertError }; } };
    } },
  });
  vm.runInContext(flow, ctx);
  return { ctx, button, description, select, writes, messages, filters };
}

test('fatura fechada em tela fica desabilitada, sem selecionar outro mês automaticamente', () => {
  const f = setup();
  f.ctx.popularFaturasLancamento(new Set(['2026-11']));
  const option = f.select.options.find(o => o.value === '2026-11');
  assert.equal(option.disabled, true);
  assert.match(option.label, /fechada ou paga/);
  assert.equal(f.select.value, '');
  f.ctx.popularFaturasLancamento(new Set());
  assert.equal(f.select.value, '2026-11');
});

for (const invoice of [
  { ano: 2026, mes: 11, status: 'fechada', pago: false },
  { ano: 2026, mes: 12, status: 'paga', pago: false },
  { ano: 2027, mes: 1, status: 'aberta', pago: true },
]) {
  test(`não grava nenhuma parcela com destino bloqueado em ${invoice.mes}/${invoice.ano}`, async () => {
    const f = setup({ invoices: [invoice] });
    await f.button.onclick();
    assert.equal(f.writes.length, 0);
    assert.match(f.messages[0], /fechada ou paga/);
    assert.equal(f.description.value, 'Compra');
    assert.equal(f.button.disabled, false);
    assert.deepEqual(f.filters, [['user_id', 'owner'], ['cartao_id', 'card']]);
  });
}

test('fatura reaberta aceita a compra e envia todas as parcelas de uma vez, preservando o valor', async () => {
  const f = setup({ invoices: [{ ano: 2026, mes: 11, status: 'aberta', pago: false }] });
  await f.button.onclick();
  assert.equal(f.writes.length, 1);
  assert.deepEqual(Array.from(f.writes[0], p => p.data_fatura), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual(Array.from(f.writes[0], p => p.valor), [33.34, 33.33, 33.33]);
  assert.match(f.messages[0], /sucesso/);
});

test('sem fatura selecionada ou sem confirmação do estado do banco não salva a compra', async () => {
  for (const config of [{ period: '' }, { lookupError: new Error('Sem conexão') }]) {
    const f = setup(config);
    await f.button.onclick();
    assert.equal(f.writes.length, 0);
    assert.equal(f.description.value, 'Compra');
    assert.doesNotMatch(f.messages.join(' '), /sucesso/);
  }
});

test('conflito no banco após a consulta preserva o formulário e não anuncia sucesso', async () => {
  const f = setup({ insertError: { code: 'PT409', message: 'AROLIX_FATURA_BLOQUEADA' } });
  await f.button.onclick();
  assert.equal(f.writes.length, 1);
  assert.equal(f.description.value, 'Compra');
  assert.match(f.messages[0], /Nenhuma parcela foi salva/);
});
