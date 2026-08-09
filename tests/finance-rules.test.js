const assert = require("node:assert/strict");
const test = require("node:test");

const {
  auditarTransportadas,
  aplicarPagamentoParcialEmFaturaFechada,
  auditarCartoesFaturas,
  calcularResumoFinanceiroRegra,
  calcularSaldoConta,
  detectarPagamentoParcialDuplicado,
  validarBaixaLancamento,
  validarPagamentoParcialCartao
} = require("../finance-rules");

test("dashboard soma realizados, pendencias, investimentos e saldo previsto", () => {
  const resumo = calcularResumoFinanceiroRegra({
    receitasPeriodo: [
      { valor: 1000, baixado: false },
      { valor: 500, baixado: true }
    ],
    receitasTransportadas: [{ valor: 200 }],
    receitasRecebidas: [{ valor: 500 }],
    receitasParciais: [{ valor: 50 }],
    despesasPeriodo: [
      { valor: 300, baixado: false },
      { valor: 120, baixado: true }
    ],
    despesasTransportadas: [{ valor: 80 }],
    despesasPagas: [{ valor: 120 }],
    despesasParciais: [{ valor: 30 }],
    cartoesAbertos: [{ valor: 400 }],
    investimentosPeriodo: { netInvestido: 200 }
  });

  assert.equal(resumo.totalRecebido, 550);
  assert.equal(resumo.totalPago, 150);
  assert.equal(resumo.totalAReceber, 1200);
  assert.equal(resumo.totalAPagar, 780);
  assert.equal(resumo.saldoRealizado, 400);
  assert.equal(resumo.saldoPendencias, 420);
  assert.equal(resumo.saldoDisponivelRealizado, 200);
  assert.equal(resumo.saldoPrevisto, 620);
});

test("baixa com desconto aceita valor final e rejeita pagar acima do final", () => {
  const baixaComDesconto = validarBaixaLancamento({
    valorOriginal: 291.5,
    desconto: 3.52,
    valorPago: 287.98
  });

  assert.equal(baixaComDesconto.ok, true);
  assert.equal(baixaComDesconto.valorFinal, 287.98);
  assert.equal(baixaComDesconto.restante, 0);
  assert.equal(baixaComDesconto.baixaParcial, false);

  const baixaInvalida = validarBaixaLancamento({
    valorOriginal: 291.5,
    desconto: 3.52,
    valorPago: 291.5
  });

  assert.equal(baixaInvalida.ok, false);
  assert.match(baixaInvalida.erros.join(" "), /maior que o valor final/);
});

test("baixa parcial mantem somente o saldo restante pendente", () => {
  const baixa = validarBaixaLancamento({
    valorOriginal: 3500,
    valorPago: 3000
  });

  assert.equal(baixa.ok, true);
  assert.equal(baixa.valorFinal, 3500);
  assert.equal(baixa.restante, 500);
  assert.equal(baixa.baixaParcial, true);
});

test("pagamento parcial de cartao exige categoria e bloqueia duplicidade", () => {
  assert.equal(validarPagamentoParcialCartao({
    valor: 300,
    contaId: "conta-1"
  }).ok, false);

  assert.equal(validarPagamentoParcialCartao({
    valor: 300,
    contaId: "conta-1",
    categoriaId: "cat-cartao"
  }).ok, true);

  const duplicadoNoCartao = detectarPagamentoParcialDuplicado({
    pagamentosCartao: [{
      tipo: "pagamento",
      descricao: "Pagamento parcial da fatura",
      data_compra: "2026-07-31",
      data_fatura: "2026-07-01",
      valor: -300
    }],
    novoPagamento: {
      valor: 300,
      data: "2026-07-31",
      dataFatura: "2026-07-01",
      contaId: "conta-1"
    }
  });

  assert.equal(duplicadoNoCartao, true);

  const duplicadoNosLancamentos = detectarPagamentoParcialDuplicado({
    despesas: [{
      conta_id: "conta-1",
      descricao: "Pagamento parcial cartão",
      data_baixa: "2026-07-31",
      cartao_pagamento_parcial: true,
      valor: 300
    }],
    novoPagamento: {
      valor: 300,
      data: "2026-07-31",
      dataFatura: "2026-07-01",
      contaId: "conta-1"
    }
  });

  assert.equal(duplicadoNosLancamentos, true);
});

test("pagamento parcial em fatura fechada reduz o saldo vinculado", () => {
  const parcial = aplicarPagamentoParcialEmFaturaFechada({
    valorFatura: 3500,
    valorPago: 3000
  });

  assert.equal(parcial.ok, true);
  assert.equal(parcial.saldoRestante, 500);
  assert.equal(parcial.quitouFatura, false);

  const quitacao = aplicarPagamentoParcialEmFaturaFechada({
    valorFatura: 500,
    valorPago: 500
  });

  assert.equal(quitacao.ok, true);
  assert.equal(quitacao.saldoRestante, 0);
  assert.equal(quitacao.quitouFatura, true);

  const invalido = aplicarPagamentoParcialEmFaturaFechada({
    valorFatura: 500,
    valorPago: 600
  });

  assert.equal(invalido.ok, false);
  assert.match(invalido.erros.join(" "), /maior que o saldo da fatura/);
});

test("auditoria de cartao detecta fatura duplicada e despesa vinculada inconsistente", () => {
  const auditoriaOk = auditarCartoesFaturas({
    faturas: [{
      id: "fat-1",
      user_id: "user-1",
      cartao_id: "card-1",
      mes: 7,
      ano: 2026,
      valor_total: 500,
      status: "fechada",
      pago: false
    }],
    lancamentos: [
      { cartao_id: "card-1", data_fatura: "2026-07-01", valor: 800 },
      { cartao_id: "card-1", data_fatura: "2026-07-01", valor: -300 }
    ],
    despesas: [{ id: "desp-1", cartao_fatura_id: "fat-1", baixado: false }]
  });

  assert.equal(auditoriaOk.ok, true);

  const auditoriaComErro = auditarCartoesFaturas({
    faturas: [
      {
        id: "fat-1",
        user_id: "user-1",
        cartao_id: "card-1",
        mes: 7,
        ano: 2026,
        valor_total: 500,
        status: "paga",
        pago: true
      },
      {
        id: "fat-2",
        user_id: "user-1",
        cartao_id: "card-1",
        mes: 7,
        ano: 2026,
        valor_total: 500,
        status: "fechada",
        pago: false
      },
      {
        id: "fat-3",
        user_id: "user-1",
        cartao_id: "card-1",
        mes: 8,
        ano: 2026,
        valor_total: 100,
        status: "fechada",
        pago: false
      }
    ],
    lancamentos: [
      { cartao_id: "card-1", data_fatura: "2026-07-01", valor: 500 },
      { cartao_id: "card-1", data_fatura: "2026-08-01", valor: 100 }
    ],
    despesas: [{ id: "desp-1", cartao_fatura_id: "fat-1", baixado: false }]
  });

  assert.equal(auditoriaComErro.ok, false);
  assert.equal(auditoriaComErro.divergencias.length, 4);
  assert.match(auditoriaComErro.divergencias.join(" "), /duplicada/);
  assert.match(auditoriaComErro.divergencias.join(" "), /não está baixada/);
});

test("saldo da conta parte do saldo inicial e nao zera quando periodo fecha em zero", () => {
  const saldo = calcularSaldoConta({
    saldoInicial: 4.18,
    movimentacoes: [
      { tipo: "credito", valor: 302.15 },
      { tipo: "debito", valor: 302.15 }
    ]
  });

  assert.equal(saldo, 4.18);
});

test("auditoria de transportadas alerta baixadas, atuais e duplicadas", () => {
  const auditoriaOk = auditarTransportadas({
    inicioPeriodo: "2026-08-01",
    itens: [
      { id: "julho-1", descricao: "Despesa julho", data_original: "2026-07-20", baixado: false }
    ]
  });

  assert.equal(auditoriaOk.ok, true);

  const auditoriaComErro = auditarTransportadas({
    inicioPeriodo: "2026-08-01",
    itens: [
      { id: "x", descricao: "Pago antigo", data_original: "2026-07-20", baixado: true },
      { id: "y", descricao: "Atual", data_original: "2026-08-01", baixado: false },
      { id: "x", descricao: "Pago antigo", data_original: "2026-07-20", baixado: false }
    ]
  });

  assert.equal(auditoriaComErro.ok, false);
  assert.equal(auditoriaComErro.divergencias.length, 3);
});
