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

function calcularSaldoConta({ saldoInicial = 0, movimentacoes = [] } = {}) {
  return roundCurrency(movimentacoes.reduce((saldo, movimento) => {
    const valor = Number(movimento.valor || 0);
    return movimento.tipo === "credito" ? saldo + valor : saldo - valor;
  }, Number(saldoInicial || 0)));
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

module.exports = {
  roundCurrency,
  sumValues,
  calcularResumoFinanceiroRegra,
  calcularValorFinalBaixa,
  validarBaixaLancamento,
  validarPagamentoParcialCartao,
  detectarPagamentoParcialDuplicado,
  aplicarPagamentoParcialEmFaturaFechada,
  calcularSaldoConta,
  auditarTransportadas
};
