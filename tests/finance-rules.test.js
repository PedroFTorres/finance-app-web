const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  agruparItensPorCategoriaRegra,
  auditarTransportadas,
  aplicarPagamentoParcialEmFaturaFechada,
  auditarCartoesFaturas,
  calcularResumoFinanceiroRegra,
  calcularSaldoConta,
  detectarPagamentoParcialDuplicado,
  isCompraCartaoGerencial,
  isDespesaTecnicaCartao,
  montarBaseDespesasPorCategoria,
  hasPremiumAccessRegra,
  validarLimitePlano,
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

test("dashboard nao trata investimento como despesa e desconta apenas do disponivel", () => {
  const resumo = calcularResumoFinanceiroRegra({
    receitasRecebidas: [{ valor: 1000 }],
    despesasPagas: [{ valor: 200 }],
    investimentosPeriodo: { netInvestido: 300 }
  });

  assert.equal(resumo.totalRecebido, 1000);
  assert.equal(resumo.totalPago, 200);
  assert.equal(resumo.saldoRealizado, 800);
  assert.equal(resumo.saldoDisponivelRealizado, 500);
  assert.equal(resumo.saldoPrevisto, 500);
});

test("dashboard inclui faturas transportadas no a pagar sem duplicar realizado", () => {
  const resumo = calcularResumoFinanceiroRegra({
    receitasRecebidas: [{ valor: 900 }],
    despesasPagas: [{ valor: 100 }],
    despesasPeriodo: [{ valor: 250, baixado: false }],
    cartoesAbertos: [{ valor: 300 }],
    cartoesTransportados: [{ valor: 450 }]
  });

  assert.equal(resumo.totalPago, 100);
  assert.equal(resumo.totalAPagar, 1000);
  assert.equal(resumo.totalTransportadoPagar, 450);
  assert.equal(resumo.saldoRealizado, 800);
  assert.equal(resumo.saldoPendencias, -1000);
  assert.equal(resumo.saldoPrevisto, -200);
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

test("baixa com juros e desconto calcula saldo parcial sobre o valor final", () => {
  const baixa = validarBaixaLancamento({
    valorOriginal: 1000,
    juros: 50,
    desconto: 150,
    valorPago: 700
  });

  assert.equal(baixa.ok, true);
  assert.equal(baixa.valorFinal, 900);
  assert.equal(baixa.valorPago, 700);
  assert.equal(baixa.restante, 200);
  assert.equal(baixa.baixaParcial, true);
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

  const parecidoMasValido = detectarPagamentoParcialDuplicado({
    pagamentosCartao: [{
      tipo: "pagamento",
      descricao: "Pagamento parcial da fatura",
      data_compra: "2026-07-31",
      data_fatura: "2026-07-01",
      valor: -300
    }],
    despesas: [{
      conta_id: "conta-1",
      descricao: "Pagamento parcial cartão",
      data_baixa: "2026-07-31",
      cartao_pagamento_parcial: true,
      valor: 300
    }],
    novoPagamento: {
      valor: 300,
      data: "2026-08-01",
      dataFatura: "2026-08-01",
      contaId: "conta-1"
    }
  });

  assert.equal(parecidoMasValido, false);
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

test("auditoria de cartao detecta total divergente, despesa duplicada e status incompleto", () => {
  const auditoria = auditarCartoesFaturas({
    faturas: [{
      id: "fat-1",
      user_id: "user-1",
      cartao_id: "card-1",
      mes: 9,
      ano: 2026,
      valor_total: 500,
      status: "paga",
      pago: false
    }],
    lancamentos: [
      { cartao_id: "card-1", data_fatura: "2026-09-01", valor: 350 }
    ],
    despesas: [
      { id: "desp-1", cartao_fatura_id: "fat-1", baixado: true },
      { id: "desp-2", cartao_fatura_id: "fat-1", baixado: true }
    ]
  });

  assert.equal(auditoria.ok, false);
  assert.equal(auditoria.divergencias.length, 2);
  assert.equal(auditoria.alertas.length, 1);
  assert.match(auditoria.divergencias.join(" "), /diferente do líquido/);
  assert.match(auditoria.divergencias.join(" "), /despesas vinculadas/);
  assert.match(auditoria.alertas.join(" "), /status paga sem flag pago=true/);
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

test("grafico de despesas por categoria usa compras do cartao e ignora fatura tecnica", () => {
  const base = montarBaseDespesasPorCategoria({
    despesasComPrevisao: [
      { descricao: "Condominio", valor: 1200, categoria_nome: "Condominio" },
      { descricao: "Fatura Santander", valor: 500, categoria_nome: "Cartão de Crédito", cartao_fatura_id: "fat-1" },
      { descricao: "Fatura aberta", valor: 300, categoria_nome: "Cartão de Crédito", provisorio_cartao: true },
      { descricao: "Pagamento parcial cartão", valor: 250, categoria_nome: "Cartão de Crédito", cartao_pagamento_parcial: true }
    ],
    comprasCartao: [
      { descricao: "Calvin Klein (1/4)", valor: 180, categoria_nome: "Roupas e Acessórios" },
      { descricao: "Compra celular", valor: 900, categoria_nome: "Informática e Celular" },
      { descricao: "Pagamento parcial da fatura", tipo: "pagamento", valor: -250, categoria_nome: "Cartão de Crédito" },
      { descricao: "Antecipação Santander", valor: 100, categoria_nome: "Cartão de Crédito" }
    ]
  });

  const grupos = agruparItensPorCategoriaRegra(base);

  assert.equal(base.length, 3);
  assert.equal(grupos["Condominio"].total, 1200);
  assert.equal(grupos["Roupas e Acessórios"].total, 180);
  assert.equal(grupos["Informática e Celular"].total, 900);
  assert.equal(grupos["Cartão de Crédito"], undefined);
});

test("detalhamento por categoria preserva os itens que formam a barra", () => {
  const grupos = agruparItensPorCategoriaRegra([
    { id: "1", descricao: "Posto Full", valor: 150, categoria_nome: "Combustível" },
    { id: "2", descricao: "Posto São Raimundo", valor: 100, categoria_nome: "Combustível" },
    { id: "3", descricao: "Academia", valor: 80, categoria_nome: "Academia" }
  ]);

  assert.equal(grupos["Combustível"].total, 250);
  assert.deepEqual(grupos["Combustível"].items.map(item => item.descricao), [
    "Posto Full",
    "Posto São Raimundo"
  ]);
  assert.equal(grupos["Academia"].total, 80);
});

test("classificadores protegem categorias contra movimentos tecnicos do cartao", () => {
  assert.equal(isDespesaTecnicaCartao({ cartao_fatura_id: "fat-1" }), true);
  assert.equal(isDespesaTecnicaCartao({ provisorio_cartao: true }), true);
  assert.equal(isDespesaTecnicaCartao({ cartao_pagamento_parcial: true }), true);
  assert.equal(isDespesaTecnicaCartao({ descricao: "Seguro", valor: 100 }), false);

  assert.equal(isCompraCartaoGerencial({ descricao: "Compra mercado", valor: 100 }), true);
  assert.equal(isCompraCartaoGerencial({ descricao: "Pagamento parcial da fatura", tipo: "pagamento", valor: -100 }), false);
  assert.equal(isCompraCartaoGerencial({ descricao: "Antecipação Santander", valor: 100 }), false);
  assert.equal(isCompraCartaoGerencial({ descricao: "Estorno", valor: -10 }), false);
});

test("limites do plano free bloqueiam conta extra, cartao e lancamento acima do limite", () => {
  assert.equal(validarLimitePlano({ recurso: "conta", totalContas: 1 }).ok, true);

  const contaExtra = validarLimitePlano({ recurso: "conta", totalContas: 2 });
  assert.equal(contaExtra.ok, false);
  assert.match(contaExtra.erros.join(" "), /2 contas/);

  const cartaoFree = validarLimitePlano({ recurso: "cartao" });
  assert.equal(cartaoFree.ok, false);
  assert.match(cartaoFree.erros.join(" "), /PRO/);

  const lancamentoExtra = validarLimitePlano({ recurso: "lancamento", totalLancamentos: 50 });
  assert.equal(lancamentoExtra.ok, false);
  assert.match(lancamentoExtra.erros.join(" "), /50 lancamentos/);
});

test("plano pro ou vip ativo libera limites ate a data de expiracao", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  assert.equal(hasPremiumAccessRegra({
    plano: "pro",
    subscriptionStatus: "active",
    subscriptionEndsAt: "2026-08-10T00:00:00Z",
    now
  }), true);

  assert.equal(validarLimitePlano({
    recurso: "cartao",
    plano: "vip",
    subscriptionStatus: "active",
    planoExpiraEm: "2026-08-10T00:00:00Z",
    totalContas: 99,
    totalLancamentos: 999,
    now
  }).ok, true);

  assert.equal(hasPremiumAccessRegra({
    plano: "pro",
    subscriptionStatus: "active",
    subscriptionEndsAt: "2026-08-01T00:00:00Z",
    now
  }), false);

  assert.equal(hasPremiumAccessRegra({
    plano: "pro",
    subscriptionStatus: "inactive",
    subscriptionEndsAt: "2026-08-10T00:00:00Z",
    now
  }), false);
});

test("migracao do banco protege limites de plano nos inserts criticos", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/202608090003_enforce_plan_limits.sql"),
    "utf8"
  );

  assert.match(sql, /create or replace function public\.arolix_enforce_plan_limits\(\)/);
  assert.match(sql, /before insert on public\.contas_bancarias/);
  assert.match(sql, /before insert on public\.receitas/);
  assert.match(sql, /before insert on public\.despesas/);
  assert.match(sql, /before insert on public\.cartoes_credito/);
  assert.match(sql, /Plano Free permite ate 2 contas/);
  assert.match(sql, /Plano Free permite ate 50 lancamentos/);
  assert.match(sql, /Cartao disponivel apenas no plano PRO/);
  assert.doesNotMatch(sql, /security\s+definer/i);
});
