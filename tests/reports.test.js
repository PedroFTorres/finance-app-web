const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, buildBalance } = require('../reports-rules.js');
const options = { mode: 'pagos', start: '2026-07-01', end: '2026-07-31' };
const data = {
  categories: [{ id: 'food', nome: 'Alimentação' }, { id: 'salary', nome: 'Salário' }, { id: 'card', nome: 'Cartão de crédito' }],
  accounts: [{ id: 'bank', nome: 'Santander' }], cards: [{ id: 'cc', nome: 'Cartão Santander' }],
  income: [{ id: 'income', valor: 2652, descricao: 'Salário', categoria_id: 'salary', conta_id: 'bank', baixado: true, data: '2026-06-30', data_baixa: '2026-07-01' }],
  expenses: [
    { id: 'bill', valor: 100, descricao: 'Boleto', categoria_id: 'food', conta_id: 'bank', baixado: true, data: '2026-06-30', data_baixa: '2026-07-03' },
    { id: 'invoice', valor: 90, descricao: 'Fatura', categoria_id: 'card', cartao_fatura_id: 'closed', conta_id: 'bank', baixado: false, data: '2026-07-20' },
    { id: 'pending', valor: 70, descricao: 'Compra pendente', categoria_id: 'food', conta_id: 'bank', baixado: false, data: '2026-07-22' }
  ],
  movements: [
    { id: 'm1', lancamento_id: 'bill', valor: 105.30, tipo: 'debito', data: '2026-07-03', conta_id: 'bank' },
    { id: 'm2', lancamento_id: 'income', valor: 2652, tipo: 'credito', data: '2026-07-01', conta_id: 'bank' },
    { id: 'transfer', valor: 500, tipo: 'debito', data: '2026-07-01', descricao: 'Aplicação', conta_id: 'bank' }
  ],
  purchases: [
    { id: 'closed-purchase', cartao_id: 'closed-card', valor: 90, tipo: 'compra', categoria_id: 'food', data_fatura: '2026-07-01' },
    { id: 'open-purchase', cartao_id: 'cc', valor: 50, tipo: 'compra', categoria_id: 'food', data_fatura: '2026-07-01', data_compra: '2026-06-25' },
    { id: 'prepayment', cartao_id: 'cc', valor: -10, tipo: 'pagamento', data_fatura: '2026-07-01' }
  ],
  invoices: [{ id: 'closed', cartao_id: 'closed-card', mes: 7, ano: 2026, status: 'fechada', pago: false }]
};

test('relatório pago inclui juros e usa a data do pagamento sem investimentos', () => {
  const report = buildReport(data, options);
  assert.equal(report.total, 105.30);
  assert.equal(report.groups[0].name, 'Alimentação');
  assert.equal(report.rows[0].date, '2026-07-03');
});
test('recebidos não usa vencimento nem soma contas pendentes', () => {
  assert.equal(buildReport(data, { ...options, mode: 'recebidos' }).total, 2652);
});
test('a pagar inclui fatura aberta líquida e fatura fechada apenas uma vez', () => {
  const report = buildReport(data, { ...options, mode: 'pagar' });
  assert.equal(report.total, 200); // 90 + 70 + (50 - 10)
  assert.equal(report.rows.length, 3);
});
test('visão de cartão detalha compras por categoria sem incluir pagamentos de fatura', () => {
  const report = buildReport(data, { ...options, mode: 'cartao', card: 'cc' });
  assert.equal(report.total, 50);
  assert.equal(report.rows[0].purchaseDate, '2026-06-25');
});
test('filtros de conta e categoria não misturam faturas sem conta definida', () => {
  assert.equal(buildReport(data, { ...options, mode: 'pagar', account: 'bank' }).total, 160);
  assert.equal(buildReport(data, { ...options, mode: 'pagar', category: 'food' }).total, 70);
});
test('período anual agrupa por mês e respeita as duas datas limite', () => {
  const sample = { expenses: [
    { id: 'first', valor: 20, baixado: true, data_baixa: '2026-01-01' },
    { id: 'last', valor: 30, baixado: true, data_baixa: '2026-12-31' },
    { id: 'out', valor: 80, baixado: true, data_baixa: '2027-01-01' }
  ] };
  const report = buildReport(sample, { mode: 'pagos', start: '2026-01-01', end: '2026-12-31' });
  assert.equal(report.total, 50);
  assert.deepEqual(report.months, [{ month: '2026-01', total: 20 }, { month: '2026-12', total: 30 }]);
});
test('pendências futuras excluem baixados e incluem atrasados somente quando solicitado', () => {
  const sample = { income: [
    { id: 'future', valor: 20, baixado: false, data: '2026-07-25' },
    { id: 'past', valor: 30, baixado: false, data: '2026-06-20' },
    { id: 'paid', valor: 10, baixado: true, data: '2026-07-20' }
  ] };
  assert.equal(buildReport(sample, { ...options, mode: 'receber' }).total, 20);
  assert.equal(buildReport(sample, { ...options, mode: 'receber', overdue: true }).total, 50);
});
test('baixa parcial não inventa categoria e não duplica a baixa final', () => {
  const sample = { expenses: [{ id: 'e', valor: 40, baixado: true, data_baixa: '2026-07-30' }],
    movements: [
      { id: 'partial', valor: 60, descricao: 'Boleto (Baixa parcial, restante 40)', tipo: 'debito', data: '2026-07-05' },
      { id: 'final', lancamento_id: 'e', valor: 40, tipo: 'debito', data: '2026-07-30' }
    ] };
  const report = buildReport(sample, options);
  assert.equal(report.total, 100);
  assert.equal(report.rows.length, 2);
  assert.ok(report.groups.some(group => group.id === 'partial'));
});
test('relatório de cartão permite estorno e categorias com nomes especiais', () => {
  const sample = { categories: [{ id: 'a', nome: '__proto__' }], purchases: [
    { id: 'a', valor: 100, categoria_id: 'a', tipo: 'compra', data_fatura: '2026-07-01' },
    { id: 'b', valor: -20, categoria_id: 'a', tipo: 'estorno', data_fatura: '2026-07-01' }
  ] };
  assert.equal(buildReport(sample, { ...options, mode: 'cartao' }).groups[0].total, 80);
});

test('previsão de fatura usa vencimento do cartão, mesmo quando o período começa no meio do mês', () => {
  const sample = { cards: [{ id: 'cc', nome: 'Cartão', dia_vencimento: 20 }],
    purchases: [{ id: 'a', cartao_id: 'cc', valor: 100, tipo: 'compra', data_fatura: '2026-07-01' }] };
  const report = buildReport(sample, { mode: 'pagar', start: '2026-07-12', end: '2026-07-31' });
  assert.equal(report.total, 100);
  assert.equal(report.rows[0].date, '2026-07-20');
  assert.equal(buildReport(sample, { mode: 'pagar', start: '2026-07-12', end: '2026-07-19' }).total, 0);
});

test('balanço reúne realizado e previsto sem repetir valores pagos nas pendências', () => {
  const balance = buildBalance(data, options);
  assert.equal(balance.recebidos, 2652);
  assert.equal(balance.pagos, 105.30);
  assert.equal(balance.receber, 0);
  assert.equal(balance.pagar, 200);
  assert.equal(balance.realized, 2546.70);
  assert.equal(balance.projected, 2346.70);
  assert.equal(balance.months[0].projected, balance.projected);
  assert.equal(balance.groups.reduce((sum, group) => sum + group.projected, 0), balance.projected);
});

test('balanço futuro mostra previsão e déficit, sem supor recebimentos ou pagamentos', () => {
  const sample = { income: [{ id: 'r', valor: 10100, data: '2026-09-15', baixado: false }],
    expenses: [{ id: 'd', valor: 10373.11, data: '2026-09-20', baixado: false }] };
  const balance = buildBalance(sample, { start: '2026-08-01', end: '2026-10-31' });
  assert.equal(balance.recebidos, 0);
  assert.equal(balance.pagos, 0);
  assert.equal(balance.projected, -273.11);
  assert.equal(balance.months.length, 3);
  assert.equal(balance.months[0].projected, 0);
  assert.equal(balance.months[1].projected, -273.11);
  assert.equal(balance.months[2].projected, 0);
});

test('balanço por categoria reúne todas as situações com os mesmos filtros', () => {
  const balance = buildBalance(data, { ...options, category: 'food' });
  assert.equal(balance.groups.length, 1);
  assert.equal(balance.pagos, 105.30);
  assert.equal(balance.pagar, 70);
  assert.equal(balance.projected, -175.30);
  assert.equal(balance.rows.length, 2);
});

test('balanço anual soma meses sem incluir investimentos como receita', () => {
  const balance = buildBalance(data, { start: '2026-01-01', end: '2026-12-31' });
  assert.equal(balance.months.length, 12);
  assert.equal(balance.recebidos, 2652);
  assert.equal(balance.months.reduce((sum, item) => sum + item.projected, 0), balance.projected);
});

test('balanço separa vencidos anteriores e conta cada pendência uma única vez', () => {
  const sample = { income: [{ id: 'a', valor: 100, baixado: false, data: '2026-06-20' }],
    expenses: [{ id: 'b', valor: 50, baixado: false, data: '2026-07-20' }] };
  const balance = buildBalance(sample, { ...options, overdue: true });
  assert.equal(balance.projected, 50);
  assert.equal(balance.months[0].month, 'overdue');
  assert.equal(balance.months[0].projected, 100);
  assert.equal(balance.months[1].projected, -50);
});

test('categoria de cartão reúne faturas abertas e fechadas inclusive com filtro de categoria', () => {
  const report = buildReport(data, { ...options, mode: 'pagar', category: 'card' });
  assert.equal(report.total, 130); // Fatura fechada 90 + aberta 50 - adiantamento 10.
  assert.equal(report.groups.length, 1);
  assert.equal(report.groups[0].id, 'card');
  assert.equal(report.rows.filter(row => row.provisional).length, 1);
});

test('abrir ou fechar a fatura mantém o valor da categoria de cartão sem duplicar compras', () => {
  const open = { categories: data.categories, cards: data.cards,
    purchases: [{ id: 'p', cartao_id: 'cc', valor: 120, tipo: 'compra', data_fatura: '2026-07-01' }] };
  const closed = { ...open,
    invoices: [{ id: 'f', cartao_id: 'cc', mes: 7, ano: 2026, status: 'fechada', pago: false }],
    expenses: [{ id: 'd', cartao_fatura_id: 'f', categoria_id: 'card', valor: 120, baixado: false, data: '2026-07-20' }] };
  const filter = { ...options, category: 'card' };
  assert.equal(buildBalance(open, filter).pagar, 120);
  assert.equal(buildBalance(closed, filter).pagar, 120);
  assert.equal(buildBalance(closed, filter).rows.length, 1);
});

test('pagamento parcial do cartão entra em pago e reduz apenas o restante previsto', () => {
  const sample = { categories: data.categories, cards: data.cards,
    expenses: [{ id: 'paid', categoria_id: 'card', valor: 30, baixado: true, data_baixa: '2026-07-03', cartao_pagamento_parcial: true }],
    purchases: [
      { id: 'purchase', cartao_id: 'cc', valor: 100, tipo: 'compra', data_fatura: '2026-07-01' },
      { id: 'payment', cartao_id: 'cc', valor: -30, tipo: 'pagamento', data_fatura: '2026-07-01' }
    ] };
  const balance = buildBalance(sample, { ...options, category: 'card' });
  assert.equal(balance.pagos, 30);
  assert.equal(balance.pagar, 70);
  assert.equal(balance.projected, -100);
});
