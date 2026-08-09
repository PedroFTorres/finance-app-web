function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function sumValues(list) {
  return roundCurrency((list || []).reduce((total, item) => total + Number(item.valor || 0), 0));
}

function calcularResumoFinanceiroRegra({
  receitasPeriodo = [],
  despesasPeriodo = [],
  receitasTransportadas = [],
  despesasTransportadas = [],
  receitasRecebidas = [],
  despesasPagas = [],
  receitasParciais = [],
  despesasParciais = [],
  cartoesAbertos = [],
  cartoesTransportados = [],
  investimentosPeriodo = {}
} = {}) {
  const pendentesReceita = [
    ...receitasTransportadas,
    ...receitasPeriodo.filter(item => item.baixado !== true)
  ];
  const pendentesDespesa = [
    ...despesasTransportadas,
    ...despesasPeriodo.filter(item => item.baixado !== true)
  ];
  const receitasRealizadas = [...receitasRecebidas, ...receitasParciais];
  const despesasRealizadas = [...despesasPagas, ...despesasParciais];

  const totalRecebido = sumValues(receitasRealizadas);
  const totalPago = sumValues(despesasRealizadas);
  const totalAReceber = sumValues(pendentesReceita);
  const totalDespesasPendentes = sumValues(pendentesDespesa);
  const totalCartoesAbertos = sumValues(cartoesAbertos);
  const totalCartoesTransportados = sumValues(cartoesTransportados);
  const totalTransportadoReceber = sumValues(receitasTransportadas);
  const totalTransportadoPagar = roundCurrency(sumValues(despesasTransportadas) + totalCartoesTransportados);
  const totalAPagar = roundCurrency(totalDespesasPendentes + totalCartoesAbertos + totalCartoesTransportados);
  const netInvestido = Number(investimentosPeriodo.netInvestido || 0);
  const saldoRealizado = roundCurrency(totalRecebido - totalPago);
  const saldoPendencias = roundCurrency(totalAReceber - totalAPagar);
  const saldoDisponivelRealizado = roundCurrency(saldoRealizado - netInvestido);

  return {
    pendentesReceita,
    pendentesDespesa,
    receitasRecebidas: receitasRealizadas,
    despesasPagas: despesasRealizadas,
    cartoesAbertos,
    cartoesTransportados,
    totalRecebido,
    totalPago,
    totalAReceber,
    totalDespesasPendentes,
    totalCartoesAbertos,
    totalCartoesTransportados,
    totalTransportadoReceber,
    totalTransportadoPagar,
    totalAPagar,
    totalReceitas: roundCurrency(totalRecebido + totalAReceber),
    totalDespesas: roundCurrency(totalPago + totalAPagar),
    saldoRealizado,
    saldoPendencias,
    saldoDisponivelRealizado,
    investimentosPeriodo: { ...investimentosPeriodo, netInvestido },
    saldoPrevisto: roundCurrency(saldoDisponivelRealizado + saldoPendencias)
  };
}

function calcularValorFinalBaixa({ valorOriginal, juros = 0, desconto = 0 } = {}) {
  return roundCurrency(Number(valorOriginal || 0) + Number(juros || 0) - Number(desconto || 0));
}

function validarBaixaLancamento({ valorOriginal, valorPago, juros = 0, desconto = 0 } = {}) {
  const valorFinal = calcularValorFinalBaixa({ valorOriginal, juros, desconto });
  const valorPagoNormalizado = roundCurrency(valorPago);
  const erros = [];

  if (valorFinal <= 0) {
    erros.push("O valor final da baixa precisa ser maior que zero.");
  }

  if (valorPagoNormalizado <= 0) {
    erros.push("Informe o valor pago agora.");
  }

  if (valorPagoNormalizado > valorFinal + 0.009) {
    erros.push("O valor pago nao pode ser maior que o valor final.");
  }

  const restante = roundCurrency(valorFinal - valorPagoNormalizado);

  return {
    ok: erros.length === 0,
    erros,
    valorFinal,
    valorPago: valorPagoNormalizado,
    restante: Math.max(0, restante),
    baixaParcial: restante > 0.009
  };
}

function validarPagamentoParcialCartao({ valor, categoriaId, contaId } = {}) {
  const erros = [];

  if (roundCurrency(valor) <= 0) {
    erros.push("Informe o valor pago.");
  }

  if (!contaId) {
    erros.push("Informe a conta de pagamento.");
  }

  if (!categoriaId) {
    erros.push("Informe a categoria do pagamento parcial.");
  }

  return { ok: erros.length === 0, erros };
}

function detectarPagamentoParcialDuplicado({
  pagamentosCartao = [],
  despesas = [],
  novoPagamento = {}
} = {}) {
  const valor = Math.abs(Number(novoPagamento.valor || 0));
  const data = novoPagamento.data;
  const dataFatura = novoPagamento.dataFatura;
  const contaId = novoPagamento.contaId;

  const duplicadoNoCartao = pagamentosCartao.some(item => {
    const mesmoTipo = item.tipo === "pagamento";
    const mesmaDescricao = item.descricao === "Pagamento parcial da fatura";
    const mesmaData = item.data_compra === data && item.data_fatura === dataFatura;
    const mesmoValor = Math.abs(Number(item.valor || 0) + valor) < 0.000001;
    return mesmoTipo && mesmaDescricao && mesmaData && mesmoValor;
  });

  const duplicadoNosLancamentos = despesas.some(item => {
    const mesmaConta = item.conta_id === contaId;
    const mesmaDescricao = item.descricao === "Pagamento parcial cartão";
    const mesmaData = item.data_baixa === data;
    const mesmoMarcador = item.cartao_pagamento_parcial === true;
    const mesmoValor = Math.abs(Number(item.valor || 0) - valor) < 0.000001;
    return mesmaConta && mesmaDescricao && mesmaData && mesmoMarcador && mesmoValor;
  });

  return duplicadoNoCartao || duplicadoNosLancamentos;
}

function aplicarPagamentoParcialEmFaturaFechada({ valorFatura, valorPago } = {}) {
  const valorAtual = roundCurrency(valorFatura);
  const pagamento = roundCurrency(valorPago);
  const erros = [];

  if (valorAtual <= 0) {
    erros.push("Fatura sem saldo pendente.");
  }

  if (pagamento <= 0) {
    erros.push("Informe o valor pago.");
  }

  if (pagamento > valorAtual + 0.009) {
    erros.push("O pagamento parcial nao pode ser maior que o saldo da fatura.");
  }

  const saldoRestante = roundCurrency(valorAtual - pagamento);

  return {
    ok: erros.length === 0,
    erros,
    valorPago: pagamento,
    saldoRestante: Math.max(0, saldoRestante),
    quitouFatura: saldoRestante <= 0.009
  };
}

function auditarCartoesFaturas({
  faturas = [],
  lancamentos = [],
  despesas = []
} = {}) {
  const divergencias = [];
  const alertas = [];
  const faturasPorPeriodo = {};

  for (const fatura of faturas || []) {
    const chave = [
      fatura.user_id || "",
      fatura.cartao_id || "",
      fatura.ano || "",
      fatura.mes || ""
    ].join("|");
    if (!faturasPorPeriodo[chave]) faturasPorPeriodo[chave] = [];
    faturasPorPeriodo[chave].push(fatura);
  }

  Object.values(faturasPorPeriodo)
    .filter(lista => lista.length > 1)
    .forEach(lista => {
      const primeira = lista[0] || {};
      divergencias.push(`Fatura duplicada para o mesmo cartão e mês: ${String(primeira.mes).padStart(2, "0")}/${primeira.ano}.`);
    });

  const lancamentosPorFatura = (lancamentos || []).reduce((acc, item) => {
    if (!item.cartao_id || !item.data_fatura) return acc;
    const dataFatura = new Date(`${item.data_fatura}T00:00:00`);
    const chave = `${item.cartao_id}:${dataFatura.getFullYear()}-${String(dataFatura.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(item);
    return acc;
  }, {});

  const despesasPorFatura = (despesas || []).reduce((acc, item) => {
    if (!item.cartao_fatura_id) return acc;
    if (!acc[item.cartao_fatura_id]) acc[item.cartao_fatura_id] = [];
    acc[item.cartao_fatura_id].push(item);
    return acc;
  }, {});

  for (const fatura of faturas || []) {
    const chave = `${fatura.cartao_id}:${fatura.ano}-${String(fatura.mes).padStart(2, "0")}`;
    const totalLiquido = roundCurrency((lancamentosPorFatura[chave] || []).reduce((s, item) => s + Number(item.valor || 0), 0));
    const valorFatura = roundCurrency(fatura.valor_total || 0);
    const despesasFatura = despesasPorFatura[fatura.id] || [];
    const faturaLabel = `${String(fatura.mes).padStart(2, "0")}/${fatura.ano}`;

    if (Math.abs(valorFatura - totalLiquido) > 0.01) {
      divergencias.push(`${faturaLabel}: valor da fatura ${valorFatura} diferente do líquido das compras ${totalLiquido}.`);
    }

    if ((fatura.status === "fechada" || fatura.pago === true) && despesasFatura.length === 0) {
      divergencias.push(`${faturaLabel}: fatura fechada/paga sem despesa vinculada.`);
    }

    if (despesasFatura.length > 1) {
      divergencias.push(`${faturaLabel}: ${despesasFatura.length} despesas vinculadas para a mesma fatura.`);
    }

    if (fatura.pago === true && despesasFatura.some(item => item.baixado !== true)) {
      divergencias.push(`${faturaLabel}: fatura marcada como paga, mas a despesa vinculada não está baixada.`);
    }

    if (fatura.status === "paga" && fatura.pago !== true) {
      alertas.push(`${faturaLabel}: status paga sem flag pago=true.`);
    }
  }

  return {
    ok: divergencias.length === 0 && alertas.length === 0,
    divergencias,
    alertas
  };
}

function calcularSaldoConta({ saldoInicial = 0, movimentacoes = [] } = {}) {
  return roundCurrency(movimentacoes.reduce((saldo, movimento) => {
    const valor = Number(movimento.valor || 0);
    return movimento.tipo === "credito" ? saldo + valor : saldo - valor;
  }, Number(saldoInicial || 0)));
}

function filtrarPorContaRegra(lista = [], contaId = "all") {
  if (!contaId || contaId === "all") return [...(lista || [])];
  return (lista || []).filter(item => item.conta_id === contaId);
}

function filtrarLancamentosPorAbaRegra({
  receitas = [],
  despesas = [],
  cartoesPrevistos = [],
  filtro = "pendencias"
} = {}) {
  const despesasPeriodo = [
    ...(despesas || []),
    ...(["pagos", "recebidos"].includes(filtro) ? [] : (cartoesPrevistos || []))
  ];

  const filtrar = (lista, tipo) => (lista || []).filter(item => {
    switch (filtro) {
      case "receitas":
        return tipo === "receita" && item.baixado !== true;
      case "despesas":
        return tipo === "despesa" && item.baixado !== true;
      case "transportadas":
        return item.transportado === true;
      case "recebidos":
        return tipo === "receita" && item.baixado === true;
      case "pagos":
        return tipo === "despesa" && item.baixado === true;
      case "pendencias":
      default:
        return item.baixado !== true;
    }
  });

  return {
    receitas: filtrar(receitas, "receita"),
    despesas: filtrar(despesasPeriodo, "despesa"),
    despesasPeriodo
  };
}

function calcularTransferenciaMovimentacoesRegra({
  transferenciaId = "transferencia",
  userId = "",
  contaOrigem,
  contaDestino,
  valor,
  data,
  descricao = "Transferência entre contas"
} = {}) {
  const erros = [];
  const valorNormalizado = roundCurrency(valor);

  if (!contaOrigem || !contaDestino) {
    erros.push("Selecione as duas contas.");
  }

  if (contaOrigem && contaDestino && contaOrigem === contaDestino) {
    erros.push("A conta de origem e destino devem ser diferentes.");
  }

  if (valorNormalizado <= 0) {
    erros.push("Informe um valor válido.");
  }

  if (erros.length) {
    return { ok: false, erros, movimentacoes: [] };
  }

  return {
    ok: true,
    erros,
    movimentacoes: [
      {
        user_id: userId,
        conta_id: contaOrigem,
        tipo: "debito",
        valor: valorNormalizado,
        data,
        descricao: `Transferência enviada — ${descricao}`,
        transferencia_id: transferenciaId
      },
      {
        user_id: userId,
        conta_id: contaDestino,
        tipo: "credito",
        valor: valorNormalizado,
        data,
        descricao: `Transferência recebida — ${descricao}`,
        transferencia_id: transferenciaId
      }
    ]
  };
}

function limparCategoriaDeItensRegra(items = [], categoriaId) {
  return (items || []).map(item => (
    item.categoria_id === categoriaId
      ? { ...item, categoria_id: null }
      : { ...item }
  ));
}

function auditarTransportadas({ itens = [], inicioPeriodo } = {}) {
  const inicio = inicioPeriodo ? new Date(`${inicioPeriodo}T00:00:00`) : null;
  const ids = new Set();
  const divergencias = [];

  for (const item of itens) {
    if (item.baixado === true) {
      divergencias.push(`${item.descricao || item.id}: item baixado nao deve ser transportado.`);
    }

    if (inicio && item.data_original) {
      const dataOriginal = new Date(`${item.data_original}T00:00:00`);
      if (dataOriginal >= inicio) {
        divergencias.push(`${item.descricao || item.id}: item do periodo atual nao deve ser transportado.`);
      }
    }

    if (item.id && ids.has(item.id)) {
      divergencias.push(`${item.descricao || item.id}: item transportado duplicado.`);
    }

    if (item.id) ids.add(item.id);
  }

  return {
    ok: divergencias.length === 0,
    divergencias
  };
}

function isDespesaTecnicaCartao(item) {
  return Boolean(item?.cartao_fatura_id || item?.provisorio_cartao || item?.cartao_pagamento_parcial);
}

function isCompraCartaoGerencial(item) {
  const valor = Number(item?.valor || 0);
  const tipo = String(item?.tipo || "").toLowerCase();
  const descricao = String(item?.descricao || "").toLowerCase();

  if (valor <= 0) return false;
  if (tipo === "pagamento") return false;
  if (descricao.includes("pagamento parcial da fatura")) return false;
  if (descricao.startsWith("antecipação") || descricao.startsWith("antecipacao")) return false;

  return true;
}

function agruparItensPorCategoriaRegra(lista = [], {
  fallback = "Sem categoria",
  categoriasPorId = {}
} = {}) {
  const grupos = {};

  (lista || []).forEach(item => {
    const nome = item.categoria_nome || categoriasPorId[item.categoria_id] || fallback;
    if (!grupos[nome]) {
      grupos[nome] = { total: 0, items: [] };
    }
    grupos[nome].total = roundCurrency(grupos[nome].total + Number(item.valor || 0));
    grupos[nome].items.push(item);
  });

  return grupos;
}

function montarBaseDespesasPorCategoria({
  despesasComPrevisao = [],
  comprasCartao = []
} = {}) {
  const despesasGerenciais = (despesasComPrevisao || []).filter(item => !isDespesaTecnicaCartao(item));
  const comprasGerenciais = (comprasCartao || [])
    .filter(isCompraCartaoGerencial)
    .map(item => ({
      ...item,
      origem_categoria: item.origem_categoria || "cartao_lancamento"
    }));

  return [...despesasGerenciais, ...comprasGerenciais];
}

function hasPremiumAccessRegra({
  plano = "free",
  subscriptionStatus = "inactive",
  subscriptionEndsAt = null,
  planoExpiraEm = null,
  now = new Date()
} = {}) {
  const planoPremium = ["pro", "vip"].includes(String(plano || "free").toLowerCase());
  const assinaturaAtiva = String(subscriptionStatus || "inactive").toLowerCase() === "active";
  const agora = now instanceof Date ? now : new Date(now);
  const assinaturaNaoExpirou = !subscriptionEndsAt || new Date(subscriptionEndsAt) > agora;
  const planoNaoExpirou = !planoExpiraEm || new Date(planoExpiraEm) > agora;

  return planoPremium && assinaturaAtiva && assinaturaNaoExpirou && planoNaoExpirou;
}

function validarLimitePlano({
  recurso,
  plano = "free",
  subscriptionStatus = "inactive",
  subscriptionEndsAt = null,
  planoExpiraEm = null,
  totalContas = 0,
  totalLancamentos = 0,
  now
} = {}) {
  const premium = hasPremiumAccessRegra({ plano, subscriptionStatus, subscriptionEndsAt, planoExpiraEm, now });
  const erros = [];

  if (premium) {
    return { ok: true, erros, premium };
  }

  if (recurso === "conta" && Number(totalContas || 0) >= 2) {
    erros.push("Plano Free permite ate 2 contas.");
  }

  if (recurso === "cartao") {
    erros.push("Cartao disponivel apenas no plano PRO.");
  }

  if (recurso === "lancamento" && Number(totalLancamentos || 0) >= 50) {
    erros.push("Plano Free permite ate 50 lancamentos.");
  }

  return { ok: erros.length === 0, erros, premium };
}

module.exports = {
  roundCurrency,
  sumValues,
  calcularResumoFinanceiroRegra,
  calcularValorFinalBaixa,
  validarBaixaLancamento,
  validarPagamentoParcialCartao,
  detectarPagamentoParcialDuplicado,
  aplicarPagamentoParcialEmFaturaFechada,
  auditarCartoesFaturas,
  calcularSaldoConta,
  filtrarPorContaRegra,
  filtrarLancamentosPorAbaRegra,
  calcularTransferenciaMovimentacoesRegra,
  limparCategoriaDeItensRegra,
  auditarTransportadas,
  isDespesaTecnicaCartao,
  isCompraCartaoGerencial,
  agruparItensPorCategoriaRegra,
  montarBaseDespesasPorCategoria,
  hasPremiumAccessRegra,
  validarLimitePlano
};
