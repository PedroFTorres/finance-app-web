const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  agruparItensPorCategoriaRegra,
  auditarTransportadas,
  aplicarPagamentoParcialEmFaturaFechada,
  auditarCartoesFaturas,
  calcularTransferenciaMovimentacoesRegra,
  calcularResumoFinanceiroRegra,
  calcularSaldoConta,
  detectarPagamentoParcialDuplicado,
  filtrarLancamentosPorAbaRegra,
  filtrarPorContaRegra,
  isCompraCartaoGerencial,
  isDespesaTecnicaCartao,
  limparCategoriaDeItensRegra,
  montarBaseDespesasPorCategoria,
  hasPremiumAccessRegra,
  hasFinancialAccessRegra,
  hasInvestmentAccessRegra,
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

test("transferencia debita origem, credita destino e preserva saldo consolidado", () => {
  const transferencia = calcularTransferenciaMovimentacoesRegra({
    transferenciaId: "transf-1",
    userId: "user-1",
    contaOrigem: "bb",
    contaDestino: "caixa",
    valor: 302.15,
    data: "2026-07-15",
    descricao: "Pagamento de seguro"
  });

  assert.equal(transferencia.ok, true);
  assert.equal(transferencia.movimentacoes.length, 2);
  assert.deepEqual(transferencia.movimentacoes.map(item => item.tipo), ["debito", "credito"]);
  assert.equal(transferencia.movimentacoes[0].conta_id, "bb");
  assert.equal(transferencia.movimentacoes[1].conta_id, "caixa");
  assert.equal(transferencia.movimentacoes[0].valor, 302.15);
  assert.equal(transferencia.movimentacoes[1].valor, 302.15);
  assert.equal(
    transferencia.movimentacoes.reduce((sum, item) => sum + (item.tipo === "credito" ? item.valor : -item.valor), 0),
    0
  );

  assert.equal(calcularSaldoConta({
    saldoInicial: 1000,
    movimentacoes: [transferencia.movimentacoes[0]]
  }), 697.85);

  assert.equal(calcularSaldoConta({
    saldoInicial: 10,
    movimentacoes: [transferencia.movimentacoes[1]]
  }), 312.15);
});

test("transferencia bloqueia origem igual destino e valor invalido", () => {
  const mesmaConta = calcularTransferenciaMovimentacoesRegra({
    contaOrigem: "bb",
    contaDestino: "bb",
    valor: 100
  });

  assert.equal(mesmaConta.ok, false);
  assert.match(mesmaConta.erros.join(" "), /diferentes/);

  const valorInvalido = calcularTransferenciaMovimentacoesRegra({
    contaOrigem: "bb",
    contaDestino: "caixa",
    valor: 0
  });

  assert.equal(valorInvalido.ok, false);
  assert.match(valorInvalido.erros.join(" "), /valor válido/);
});

test("filtro por conta nao mistura lancamentos de outras contas", () => {
  const lista = [
    { id: "1", conta_id: "bb", valor: 100 },
    { id: "2", conta_id: "caixa", valor: 200 },
    { id: "3", conta_id: "bb", valor: 300 }
  ];

  assert.deepEqual(filtrarPorContaRegra(lista, "bb").map(item => item.id), ["1", "3"]);
  assert.deepEqual(filtrarPorContaRegra(lista, "all").map(item => item.id), ["1", "2", "3"]);
});

test("abas de lancamentos separam pendencias, pagos, recebidos e transportadas", () => {
  const receitas = [
    { id: "rec-aberta", baixado: false },
    { id: "rec-paga", baixado: true },
    { id: "rec-antiga", baixado: false, transportado: true }
  ];
  const despesas = [
    { id: "desp-aberta", baixado: false },
    { id: "desp-paga", baixado: true },
    { id: "desp-antiga", baixado: false, transportado: true }
  ];
  const cartoesPrevistos = [
    { id: "fat-aberta", baixado: false, provisorio_cartao: true }
  ];

  const pendencias = filtrarLancamentosPorAbaRegra({ receitas, despesas, cartoesPrevistos, filtro: "pendencias" });
  assert.deepEqual(pendencias.receitas.map(item => item.id), ["rec-aberta", "rec-antiga"]);
  assert.deepEqual(pendencias.despesas.map(item => item.id), ["desp-aberta", "desp-antiga", "fat-aberta"]);

  const pagos = filtrarLancamentosPorAbaRegra({ receitas, despesas, cartoesPrevistos, filtro: "pagos" });
  assert.deepEqual(pagos.receitas.map(item => item.id), []);
  assert.deepEqual(pagos.despesas.map(item => item.id), ["desp-paga"]);
  assert.deepEqual(pagos.despesasPeriodo.map(item => item.id), ["desp-aberta", "desp-paga", "desp-antiga"]);

  const recebidos = filtrarLancamentosPorAbaRegra({ receitas, despesas, cartoesPrevistos, filtro: "recebidos" });
  assert.deepEqual(recebidos.receitas.map(item => item.id), ["rec-paga"]);
  assert.deepEqual(recebidos.despesas.map(item => item.id), []);

  const transportadas = filtrarLancamentosPorAbaRegra({ receitas, despesas, cartoesPrevistos, filtro: "transportadas" });
  assert.deepEqual(transportadas.receitas.map(item => item.id), ["rec-antiga"]);
  assert.deepEqual(transportadas.despesas.map(item => item.id), ["desp-antiga"]);
});

test("excluir categoria limpa referencia sem apagar lancamentos", () => {
  const itens = [
    { id: "1", descricao: "Energia", categoria_id: "cat-conta", valor: 200 },
    { id: "2", descricao: "Salario", categoria_id: "cat-renda", valor: 1000 }
  ];

  const atualizados = limparCategoriaDeItensRegra(itens, "cat-conta");

  assert.equal(atualizados.length, 2);
  assert.equal(atualizados[0].categoria_id, null);
  assert.equal(atualizados[1].categoria_id, "cat-renda");
  assert.deepEqual(itens.map(item => item.categoria_id), ["cat-conta", "cat-renda"]);
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

test("plano free libera app financeiro por 5 dias e bloqueia apos o teste", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  assert.equal(hasFinancialAccessRegra({
    plano: "free",
    trialStartedAt: "2026-08-06T12:00:00Z",
    now
  }), true);

  assert.equal(validarLimitePlano({
    recurso: "cartao",
    plano: "free",
    trialStartedAt: "2026-08-06T12:00:00Z",
    totalContas: 99,
    totalLancamentos: 999,
    now
  }).ok, true);

  const expirado = validarLimitePlano({
    recurso: "lancamento",
    plano: "free",
    trialStartedAt: "2026-08-01T12:00:00Z",
    now
  });
  assert.equal(expirado.ok, false);
  assert.match(expirado.erros.join(" "), /período gratuito terminou/i);
});

test("pro ativo libera financeiro e apenas vip ativo libera investimentos", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  assert.equal(hasPremiumAccessRegra({
    plano: "pro",
    subscriptionStatus: "active",
    subscriptionEndsAt: "2026-08-10T00:00:00Z",
    now
  }), true);

  assert.equal(validarLimitePlano({
    recurso: "cartao",
    plano: "pro",
    subscriptionStatus: "active",
    planoExpiraEm: "2026-08-10T00:00:00Z",
    totalContas: 99,
    totalLancamentos: 999,
    now
  }).ok, true);

  assert.equal(hasInvestmentAccessRegra({
    plano: "pro",
    subscriptionStatus: "active",
    planoExpiraEm: "2026-08-10T00:00:00Z",
    now
  }), false);

  assert.equal(validarLimitePlano({
    recurso: "investimento",
    plano: "pro",
    subscriptionStatus: "active",
    planoExpiraEm: "2026-08-10T00:00:00Z",
    now
  }).ok, false);

  assert.equal(hasInvestmentAccessRegra({
    plano: "vip",
    subscriptionStatus: "active",
    planoExpiraEm: "2026-08-10T00:00:00Z",
    now
  }), true);

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

test("frontend premium segue a mesma regra de expiracao do banco", () => {
  const premiumClient = fs.readFileSync(path.join(__dirname, "../premium-access-client.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

  assert.match(premiumClient, /subscription_ends_at/);
  assert.match(premiumClient, /plano_expira_em/);
  assert.match(premiumClient, /trial_started_at/);
  assert.match(premiumClient, /hasFinancialAccess/);
  assert.match(app, /premiumDateIsValid\(STATE\.profile\?\.subscription_ends_at\)/);
  assert.match(app, /premiumDateIsValid\(STATE\.profile\?\.plano_expira_em\)/);
  assert.match(app, /function hasFinancialAccess/);
  assert.match(app, /function hasInvestmentAccess/);
});

test("mensagem de bloqueio de plano aparece clara ao salvar lancamento", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

  assert.match(app, /function friendlySaveError/);
  assert.match(app, /Seu período gratuito terminou/);
  assert.match(app, /Investimentos e CVM estão disponíveis apenas para usuários VIP/);
  assert.doesNotMatch(app, /alert\('Erro ao salvar lançamento\. Veja console\.'\)/);
});

test("logos bancarias preservam banco em conta de investimento e cobrem catalogo principal", () => {
  const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const cartao = fs.readFileSync(path.join(__dirname, "../cartao.js"), "utf8");
  const bankLogoFiles = {
    bb: "assets/banks/bb.png",
    bradesco: "assets/banks/bradesco.png",
    btg: "assets/banks/btg.svg",
    c6: "assets/banks/c6.png",
    caixa: "assets/banks/caixa.png",
    inter: "assets/banks/inter.png",
    itau: "assets/banks/itau.png",
    mercadopago: "assets/banks/mercadopago.png",
    picpay: "assets/banks/picpay.svg",
    safra: "assets/banks/safra.png",
    santander: "assets/banks/santander.png",
    sicredi: "assets/banks/sicredi.png",
    sicoob: "assets/banks/sicoob.png",
    xp: "assets/banks/xp.png"
  };

  Object.entries(bankLogoFiles).forEach(([code, expectedLogo]) => {
    const expectedLogoPattern = `${expectedLogo.replace("/", "\\/")}(?:\\?v=\\d{8}-\\d)?`;
    assert.match(app, new RegExp(`code: '${code}'[\\s\\S]*?logo: '${expectedLogoPattern}'`));
    assert.match(cartao, new RegExp(`code: '${code}'[\\s\\S]*?logo: '${expectedLogoPattern}'`));
    assert.ok(fs.existsSync(path.join(__dirname, "..", expectedLogo)));
  });
  assert.doesNotMatch(app, /tipo_conta === 'investimento'[\s\S]*?code: 'investimento'/);
});

test("migracao do banco protege regras finais de planos", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/202608160001_plan_access_rules.sql"),
    "utf8"
  );

  assert.match(sql, /trial_started_at/);
  assert.match(sql, /arolix_has_financial_access/);
  assert.match(sql, /arolix_has_investment_access/);
  assert.match(sql, /create or replace function public\.arolix_enforce_plan_limits\(\)/);
  assert.match(sql, /before insert or update or delete/);
  assert.match(sql, /Investimentos e CVM estao disponiveis apenas no plano VIP/);
  assert.match(sql, /Seu periodo gratuito terminou/);
  assert.doesNotMatch(sql, /Plano Free permite ate 2 contas/);
  assert.doesNotMatch(sql, /Plano Free permite ate 50 lancamentos/);
  assert.doesNotMatch(sql, /Cartao disponivel apenas no plano PRO/);
});

test("fluxo de pagamento de fatura tem compensacao contra falha parcial", () => {
  const js = fs.readFileSync(path.join(__dirname, "../cartao.js"), "utf8");

  assert.match(js, /let despesaOriginal = null/);
  assert.match(js, /let movimentacaoCriadaId = null/);
  assert.match(js, /let pagamentoPersistido = false/);
  assert.match(js, /pagamentoPersistido = true/);
  assert.match(js, /if \(pagamentoPersistido\)/);
  assert.match(js, /\.from\("movimentacoes"\)\s*[\s\S]*?\.delete\(\)/);
  assert.match(js, /\.from\("despesas"\)\s*[\s\S]*?valor: despesaOriginal\.valor/);
  assert.match(js, /await recalcularSaldoConta\(contaPagamentoId\)/);
});

test("fluxo de pagamento parcial de fatura evita rollback depois de salvo", () => {
  const js = fs.readFileSync(path.join(__dirname, "../cartao.js"), "utf8");

  assert.match(js, /let pagamentoParcialPersistido = false/);
  assert.match(js, /pagamentoParcialPersistido = true/);
  assert.match(js, /if \(pagamentoParcialPersistido\)/);
  assert.match(js, /Pagamento parcial salvo, mas não consegui atualizar a tela/);
  assert.match(js, /\.from\("cartao_lancamentos"\)\s*[\s\S]*?\.delete\(\)/);
  assert.match(js, /\.from\("movimentacoes"\)\s*[\s\S]*?\.delete\(\)/);
  assert.match(js, /\.from\("despesas"\)\s*[\s\S]*?\.delete\(\)/);
});

test("fluxo de baixa comum recalcula saldo e compensa falha apos criar movimentacao", () => {
  const js = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

  assert.match(js, /let movimentacaoCriadaId = null/);
  assert.match(js, /const novaMovimentacaoId = uid\(\)/);
  assert.match(js, /movimentacaoCriadaId = novaMovimentacaoId/);
  assert.match(js, /if \(movimentacaoCriadaId\)/);
  assert.match(js, /\.from\("movimentacoes"\)\s*[\s\S]*?\.delete\(\)/);
  assert.match(js, /await ContasService\.recalc\(contaId\)/);
  assert.match(js, /if \(contaBaixaId\) await ContasService\.recalc\(contaBaixaId\)/);
});

test("pagamento de fatura bloqueia conta de investimento mesmo se o select vier inconsistente", () => {
  const js = fs.readFileSync(path.join(__dirname, "../cartao.js"), "utf8");

  assert.match(js, /async function validarContaPagamentoCartao\(contaId\)/);
  assert.match(js, /Conta de investimento não pode pagar fatura/);
  assert.match(js, /const contaPagamento = await validarContaPagamentoCartao\(contaId\)/);
  assert.match(js, /if \(!contaPagamento\.ok\)/);
});

test("onboarding finaliza com primeiro lancamento mesmo antes da baixa", () => {
  const js = fs.readFileSync(path.join(__dirname, "../onboarding/onboarding.js"), "utf8");

  assert.match(js, /Primeiro lançamento/);
  assert.match(js, /Pular guia/);
  assert.match(js, /Promise\.all\(/);
  assert.match(js, /\.from\("receitas"\)/);
  assert.match(js, /\.from\("despesas"\)/);
  assert.match(js, /\.from\("movimentacoes"\)/);
});

test("relatorio de extrato identifica saldo atual e trata popup bloqueado", () => {
  const js = fs.readFileSync(path.join(__dirname, "../print.js"), "utf8");

  assert.match(js, /<span>Saldo atual<\/span>/);
  assert.match(js, /if \(!win\)/);
  assert.match(js, /Libere pop-ups para gerar o PDF/);
  assert.match(js, /Relatório financeiro gerado pelo app/);
});
