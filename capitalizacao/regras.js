(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ArolixCapitalizacao = api;
})(globalThis, function () {
  'use strict';
  // Ficha Raspa DinDin 48 meses, SUSEP 15414.662222/2024-10, página 3.
  // A tabela já incorpora suas hipóteses atuariais: não aplicar 0,73% de novo.
  const TABELA_48 = Object.freeze([
    0, 50,50,50,50,50,50,50,50,50,50,50,51.45,54.36,56.90,59.14,61.15,
    62.96,64.60,66.11,67.50,68.79,70,71.13,72.19,77.27,78.28,79.25,80.17,
    81.06,81.91,82.73,83.53,84.30,85.05,85.78,86.58,91.96,92.77,93.56,
    94.32,95.08,95.82,96.55,97.26,97.97,98.66,99.34,100.02
  ]);
  const cents = value => Math.round(Number(value || 0) * 100);
  const sum = values => values.reduce((total, value) => total + cents(value), 0) / 100;
  function paymentRows(titulo, data) {
    const despesas = new Map((data.despesas || []).map(row => [row.id, row]));
    const compras = new Map((data.compras || []).map(row => [row.id, row]));
    const seen = new Set();
    return (data.pagamentos || []).filter(link => link.titulo_id === titulo.id).flatMap(link => {
      const key = link.despesa_id ? `d:${link.despesa_id}` : `c:${link.cartao_lancamento_id}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const row = link.despesa_id ? despesas.get(link.despesa_id) : compras.get(link.cartao_lancamento_id);
      if (!row || Number(row.valor) <= 0) return [];
      let pago = row.baixado === true;
      let detalhe = pago ? 'Pago' : 'A pagar';
      let dataPagamento = row.data_baixa || row.data;
      if (link.cartao_lancamento_id) {
        if (!['compra', undefined, null].includes(row.tipo)) return [];
        const [ano, mes] = String(row.data_fatura || '').split('-').map(Number);
        const fatura = (data.faturas || []).find(f => f.id === row.fatura_id ||
          (f.cartao_id === row.cartao_id && Number(f.ano) === ano && Number(f.mes) === mes));
        const despesaFatura = despesas.get(row.despesa_id) || (data.despesas || []).find(d => fatura && d.cartao_fatura_id === fatura.id);
        pago = despesaFatura ? despesaFatura.baixado === true : !!fatura && (fatura.pago === true || fatura.status === 'paga');
        dataPagamento = despesaFatura?.data_baixa || row.data_compra || row.data_fatura;
        detalhe = pago ? 'Cartão • fatura paga' : 'Cartão • aguardando quitação da fatura';
      }
      return [{ link, source: row, valor: Number(row.valor), data: row.data || row.data_compra || row.data_fatura, dataPagamento, pago, detalhe }];
    }).sort((a,b) => String(a.data).localeCompare(String(b.data)));
  }
  function summary(titulo, data, today) {
    const rows = paymentRows(titulo, data);
    const pagas = rows.filter(row => row.pago && row.dataPagamento <= today);
    const totalPago = sum(pagas.map(row => row.valor));
    const recebimentos = (data.recebimentos || []).filter(link => link.titulo_id === titulo.id).flatMap(link => {
      const receita = (data.receitas || []).find(r => r.id === link.receita_id);
      return receita?.baixado && (receita.data_baixa || receita.data) <= today ? [{ ...link, receita }] : [];
    });
    const real = receita => {
      const movs = (data.movimentacoes || []).filter(m => m.lancamento_id === receita.id && m.tipo === 'credito');
      return movs.length ? sum(movs.map(m => m.valor)) : Number(receita.valor);
    };
    let estimativa = null, percentual = null;
    if (titulo.regra_resgate === 'raspa48_662222_2024' && Number(titulo.prazo_meses) === 48 &&
        titulo.processo_susep === '15414.662222/2024-10' && pagas.length > 0 && pagas.length <= 48) {
      percentual = TABELA_48[pagas.length];
      estimativa = Math.round(cents(totalPago) * percentual / 100) / 100;
    }
    return {
      rows, pagas: pagas.length, restantes: Math.max(0, Number(titulo.prazo_meses) - pagas.length), totalPago,
      proximas: rows.filter(row => !row.pago), estimativa, percentual,
      premios: sum(recebimentos.filter(r => r.tipo === 'premio').map(r => real(r.receita))),
      resgatado: sum(recebimentos.filter(r => r.tipo === 'resgate').map(r => real(r.receita))),
      baseFinal: cents(titulo.valor_parcela) * Number(titulo.prazo_meses) / 100,
      vencido: titulo.status === 'ativo' && titulo.fim_vigencia <= today,
      excesso: pagas.length > Number(titulo.prazo_meses)
    };
  }
  function validateTitle(title) {
    if (!String(title.nome || '').trim()) throw new Error('Informe o nome do título.');
    if (!(Number(title.valor_parcela) > 0)) throw new Error('Informe uma parcela maior que zero.');
    if (!Number.isInteger(Number(title.prazo_meses)) || title.prazo_meses < 1 || title.prazo_meses > 600) throw new Error('Prazo inválido.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(title.inicio_vigencia || '') || !/^\d{4}-\d{2}-\d{2}$/.test(title.fim_vigencia || '') || title.fim_vigencia <= title.inicio_vigencia) throw new Error('Confira o início e o fim da vigência.');
    if (!Number.isInteger(Number(title.dia_cobranca)) || title.dia_cobranca < 1 || title.dia_cobranca > 31) throw new Error('Dia de cobrança inválido.');
    if (title.regra_resgate === 'raspa48_662222_2024' && (Number(title.prazo_meses) !== 48 || title.processo_susep !== '15414.662222/2024-10')) throw new Error('A tabela de 48 meses exige o prazo e o processo SUSEP correspondentes.');
    if ((title.valor_resgate_banco == null) !== !title.data_consulta_resgate || (title.valor_resgate_banco != null && title.valor_resgate_banco < 0)) throw new Error('Preencha o valor e a data da consulta ao banco juntos.');
    return title;
  }
  return { TABELA_48, summary, paymentRows, validateTitle, sum };
});
