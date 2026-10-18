(function (root) {
  const money = value => Math.round((Number(value) || 0) * 100) / 100;
  const inside = (date, start, end) => Boolean(date && date >= start && date <= end);
  const keyInvoice = item => `${item.cartao_id}:${item.ano}-${String(item.mes).padStart(2, '0')}`;

  function buildReport(data, { mode, start, end, account = 'all', card = 'all', category = 'all', overdue = false }) {
    const categories = new Map((data.categories || []).map(item => [item.id, item.nome]));
    const accounts = new Map((data.accounts || []).map(item => [item.id, item.nome]));
    const cards = new Map((data.cards || []).map(item => [item.id, item.nome]));
    const cardDetails = new Map((data.cards || []).map(item => [item.id, item]));
    const cardCategory = (data.categories || []).find(item => String(item.nome || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'cartao de credito');
    const income = mode === 'recebidos' || mode === 'receber';
    const pending = mode === 'receber' || mode === 'pagar';
    const records = income ? data.income || [] : data.expenses || [];
    const normalize = (item, extra = {}) => ({
      id: item.id, description: item.descricao || 'Lançamento', value: money(item.valor),
      date: item.data_baixa || item.data, purchaseDate: item.data_compra || '',
      categoryId: item.categoria_id || 'uncategorized',
      category: categories.get(item.categoria_id) || 'Sem categoria',
      accountId: item.conta_id, account: accounts.get(item.conta_id) || 'Sem conta',
      sourceId: item.id, invoiceId: item.cartao_fatura_id || null,
      partialCardPayment: item.cartao_pagamento_parcial === true,
      ...extra
    });
    let rows = [];
    if (mode === 'cartao') {
      rows = (data.purchases || []).filter(item => item.tipo !== 'pagamento' && inside(item.data_fatura, start, end))
        .filter(item => card === 'all' || item.cartao_id === card)
        .map(item => normalize(item, { date: item.data_fatura, account: cards.get(item.cartao_id) || 'Cartão' }));
    } else if (pending) {
      rows = records.filter(item => item.baixado !== true && item.data && item.data <= end && (overdue || item.data >= start))
        .map(item => normalize(item, { date: item.data, overdue: item.data < start }));
      if (mode === 'pagar' && account === 'all') {
        const invoices = new Map((data.invoices || []).map(item => [keyInvoice(item), item]));
        const groups = new Map();
        for (const item of data.purchases || []) {
          if (!item.data_fatura) continue;
          const [year, month] = item.data_fatura.split('-').map(Number);
          const dueDay = Number(cardDetails.get(item.cartao_id)?.dia_vencimento);
          const lastDay = new Date(year, month, 0).getDate();
          const dueDate = dueDay >= 1 && dueDay <= 31
            ? `${item.data_fatura.slice(0, 7)}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`
            : item.data_fatura;
          if (dueDate > end || (!overdue && dueDate < start)) continue;
          const key = `${item.cartao_id}:${item.data_fatura.slice(0, 7)}`;
          const invoice = invoices.get(key);
          if (invoice && (invoice.pago === true || ['fechada', 'paga'].includes(invoice.status))) continue;
          const row = groups.get(key) || normalize(item, { id: `invoice-${key}`, description: `Fatura aberta — ${cards.get(item.cartao_id) || 'Cartão'}`,
            invoiceKey: key,
            categoryId: cardCategory?.id || 'card-invoice', category: cardCategory?.nome || 'Cartão de Crédito', account: 'Conta ainda não definida',
            date: dueDate, value: 0, provisional: true, overdue: dueDate < start });
          row.value = money(row.value + Number(item.valor || 0));
          groups.set(key, row);
        }
        rows.push(...Array.from(groups.values()).filter(item => item.value > 0));
      }
    } else {
      const byId = new Map(records.map(item => [item.id, item]));
      const represented = new Set();
      for (const movement of data.movements || []) {
        if (!inside(movement.data, start, end) || movement.tipo !== (income ? 'credito' : 'debito')) continue;
        const original = byId.get(movement.lancamento_id);
        const partial = !movement.lancamento_id && /baixa parcial/i.test(movement.descricao || '');
        if (!original && !partial) continue; // Transfers and investments are not income/expense.
        if (original) represented.add(original.id);
        rows.push(normalize(original || movement, {
          id: movement.id, value: money(movement.valor), date: movement.data,
          accountId: movement.conta_id, account: accounts.get(movement.conta_id) || 'Sem conta',
          ...(partial ? { categoryId: 'partial', category: 'Baixas parciais sem categoria registrada' } : {})
        }));
      }
      for (const item of records) {
        if (item.baixado === true && inside(item.data_baixa, start, end) && !represented.has(item.id)) rows.push(normalize(item));
      }
    }
    if (mode !== 'cartao' && account !== 'all') rows = rows.filter(item => item.accountId === account);
    if (category !== 'all') rows = rows.filter(item => item.categoryId === category);
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
    const groups = new Map(), months = new Map();
    for (const row of rows) {
      const group = groups.get(row.categoryId) || { id: row.categoryId, name: row.category, total: 0, rows: [] };
      group.total = money(group.total + row.value);
      group.rows.push(row);
      groups.set(row.categoryId, group);
      const month = row.date.slice(0, 7);
      months.set(month, money((months.get(month) || 0) + row.value));
    }
    return { rows, total: money(rows.reduce((sum, item) => sum + item.value, 0)),
      groups: Array.from(groups.values()).sort((a, b) => b.total - a.total),
      months: Array.from(months, ([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)) };
  }
  // Decompõe SOMENTE a representação do balanço. Não cria despesas adicionais.
  function expandCardCategories(data, rows) {
    const invoices = new Map((data.invoices || []).map(item => [item.id, keyInvoice(item)]));
    const categories = new Map((data.categories || []).map(item => [item.id, item.nome]));
    const batches = new Map();
    const partialKeys = new Map();
    for (const purchase of data.purchases || []) {
      if (!purchase.data_fatura) continue;
      const key = `${purchase.cartao_id}:${purchase.data_fatura.slice(0,7)}`;
      const batch = batches.get(key) || { items: [], payments: 0 };
      if (purchase.tipo === 'pagamento') {
        batch.payments = money(batch.payments + Number(purchase.valor || 0));
        if (purchase.despesa_id) partialKeys.set(purchase.despesa_id, key);
      } else {
        batch.items.push(purchase);
      }
      batches.set(key, batch);
    }
    return rows.flatMap(row => {
      const key = row.invoiceKey || invoices.get(row.invoiceId) || (row.partialCardPayment ? partialKeys.get(row.sourceId) : null);
      const batch = batches.get(key);
      const base = money((batch?.items || []).reduce((sum, item) => sum + Number(item.valor || 0), 0));
      // Sem vínculo inequívoco ou sem compras positivas líquidas, mantém o valor
      // original: não atribui a academia/alimentação por suposição.
      if (!batch || base <= 0 || row.value <= 0) return [row];
      const remaining = money(Math.max(0, base + batch.payments));
      const principal = row.partialCardPayment ? Math.min(row.value, base) : Math.min(row.value, remaining);
      const target = Math.round(principal * 100);
      const divisor = Math.round(base * 100);
      // Maiores restos: soma exata em centavos inclusive com estornos negativos.
      const parts = batch.items.map((item, index) => {
        const raw = target * Math.round(Number(item.valor || 0) * 100) / divisor;
        return { item, index, cents: Math.floor(raw), fraction: raw - Math.floor(raw) };
      });
      const remainder = target - parts.reduce((sum, part) => sum + part.cents, 0);
      const ranked = [...parts].sort((a,b) => b.fraction - a.fraction || a.index - b.index);
      for (let i=0; i<remainder; i++) ranked[i % ranked.length].cents++;
      const split = parts.filter(part => part.cents !== 0).map(({item, cents}) => ({
        ...row, id: `${row.id}:purchase:${item.id}`, value: cents / 100,
        categoryId: item.categoria_id || 'uncategorized', category: categories.get(item.categoria_id) || 'Sem categoria',
        description: `${item.descricao || 'Compra no cartão'} · ${row.description}`,
        purchaseDate: item.data_compra || '', cardBreakdown: true,
        proportional: target !== divisor
      }));
      const difference = money(row.value - principal);
      if (difference) split.push({ ...row, id:`${row.id}:unallocated`, value:difference,
        categoryId:'card-adjustments', category:'Cartão — juros e ajustes sem categoria',
        description:`Juros ou diferença sem detalhamento · ${row.description}`, cardAdjustment:true });
      return split;
    });
  }
  function buildBalance(data, options) {
    const lanes = ['recebidos', 'pagos', 'receber', 'pagar'];
    const totals = () => ({ recebidos: 0, pagos: 0, receber: 0, pagar: 0 });
    const finish = item => ({ ...item, realized: money(item.recebidos - item.pagos),
      pendingBalance: money(item.receber - item.pagar) });
    const sum = totals(), groups = new Map(), months = new Map(), rows = [];
    // Include empty months so a future period is presented as a complete plan.
    const [year, month] = options.start.split('-').map(Number);
    const cursor = new Date(year, month - 1, 1);
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (key > options.end.slice(0, 7)) break;
      months.set(key, { month: key, ...totals() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const lane of lanes) {
      const report = buildReport(data, { ...options, mode: lane, category: 'all' });
      let laneRows = lane === 'pagos' || lane === 'pagar' ? expandCardCategories(data, report.rows) : report.rows;
      if (options.category && options.category !== 'all') laneRows = laneRows.filter(row => row.categoryId === options.category);
      sum[lane] = money(laneRows.reduce((total,row) => total + row.value,0));
      for (const item of laneRows) {
        const row = { ...item, lane };
        rows.push(row);
        const group = groups.get(row.categoryId) || { id: row.categoryId, name: row.category, rows: [], ...totals() };
        group[lane] = money(group[lane] + row.value);
        group.rows.push(row);
        groups.set(group.id, group);
        const key = row.overdue ? 'overdue' : row.date.slice(0, 7);
        const period = months.get(key) || { month: key, ...totals() };
        period[lane] = money(period[lane] + row.value);
        months.set(key, period);
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
    return { ...finish(sum), rows,
      groups: Array.from(groups.values(), finish).sort((a, b) => a.name.localeCompare(b.name)),
      months: Array.from(months.values(), finish).sort((a, b) => a.month === 'overdue' ? -1 : b.month === 'overdue' ? 1 : a.month.localeCompare(b.month)) };
  }
  const api = { buildReport, buildBalance };
  root.ArolixReportsRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
