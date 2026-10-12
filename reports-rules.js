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
  function buildBalance(data, options) {
    const lanes = ['recebidos', 'pagos', 'receber', 'pagar'];
    const totals = () => ({ recebidos: 0, pagos: 0, receber: 0, pagar: 0 });
    const finish = item => ({ ...item, realized: money(item.recebidos - item.pagos),
      projected: money(item.recebidos - item.pagos + item.receber - item.pagar) });
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
      const report = buildReport(data, { ...options, mode: lane });
      sum[lane] = report.total;
      for (const item of report.rows) {
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
