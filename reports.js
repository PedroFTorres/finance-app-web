(function () {
  const $ = id => document.getElementById(id);
  const labels = { balanco: 'Balanço do período', recebidos: 'Recebido', pagos: 'Pago', receber: 'Previsto a receber', pagar: 'Previsto a pagar', cartao: 'Compras no cartão' };
  const fmt = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateBR = value => value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
  let mode = 'balanco', request = 0, snapshot = null, loadedKey = '', result = null, loadedOptions = null;
  let initialized = false;

  function node(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function setOptions(id, items, empty) {
    const select = $(id), current = select.value;
    select.replaceChildren(new Option(empty, 'all'), ...items.map(item => new Option(item.nome, item.id)));
    select.value = items.some(item => item.id === current) ? current : 'all';
  }
  function periodPreset() {
    const now = new Date(), type = $('report-period').value;
    $('report-month-label').classList.toggle('hidden', type !== 'month');
    $('report-year-label').classList.toggle('hidden', type !== 'year');
    $('report-start').disabled = type !== 'custom';
    $('report-end').disabled = type !== 'custom';
    if (type === 'custom') return;
    let start, end;
    if (type === 'month') {
      const [year, month] = $('report-month').value.split('-').map(Number);
      start = new Date(year, month - 1, 1); end = new Date(year, month, 0);
    } else if (type === 'year') {
      const year = Number($('report-year').value);
      if (year < 1900 || year > 2200) return;
      start = new Date(year, 0, 1); end = new Date(year, 11, 31);
    } else {
      start = now;
      end = new Date(`${window.ArolixRuntime.addMonthsClamped(window.ArolixRuntime.localISODate(now), 12)}T00:00:00`);
    }
    $('report-start').value = window.ArolixRuntime.localISODate(start);
    $('report-end').value = window.ArolixRuntime.localISODate(end);
  }
  function filters() {
    return { mode, start: $('report-start').value, end: $('report-end').value,
      account: $('report-account').value, card: $('report-card').value,
      category: $('report-category').value, overdue: $('report-overdue').checked };
  }
  async function fetchData(options) {
    const client = window.supabase, user = window.STATE.user.id;
    const all = async query => {
      const { data, error } = await window.ArolixRuntime.selectAll(query.order('id'));
      if (error) throw error;
      return data || [];
    };
    const base = table => client.from(table).select('*').eq('user_id', user);
    const pending = table => {
      let query = base(table).neq('baixado', true).lte('data', options.end);
      if (!options.overdue) query = query.gte('data', options.start);
      return all(query);
    };
    const paid = table => all(base(table).eq('baixado', true).gte('data_baixa', options.start).lte('data_baixa', options.end));
    const [pendingIncome, pendingExpense, paidIncome, paidExpense, movements, purchases, invoices, cards] = await Promise.all([
      pending('receitas'), pending('despesas'), paid('receitas'), paid('despesas'),
      all(base('movimentacoes').gte('data', options.start).lte('data', options.end)),
      all(options.overdue ? base('cartao_lancamentos').lte('data_fatura', options.end) : base('cartao_lancamentos').gte('data_fatura', `${options.start.slice(0, 7)}-01`).lte('data_fatura', options.end)),
      all(options.overdue ? base('cartao_faturas') : base('cartao_faturas').gte('ano', Number(options.start.slice(0, 4))).lte('ano', Number(options.end.slice(0, 4)))),
      all(base('cartoes_credito'))
    ]);
    // Resolve movements even when the original due date falls outside the report.
    const linkedIds = [...new Set(movements.map(item => item.lancamento_id).filter(Boolean))];
    const resolve = async table => {
      const { data, error } = await window.ArolixRuntime.selectIn(ids => base(table).in('id', ids).order('id'), linkedIds);
      if (error) throw error;
      return data || [];
    };
    const [linkedIncome, linkedExpense] = await Promise.all([resolve('receitas'), resolve('despesas')]);
    const unique = items => Array.from(new Map(items.map(item => [item.id, item])).values());
    return { income: unique([...pendingIncome, ...paidIncome, ...linkedIncome]),
      expenses: unique([...pendingExpense, ...paidExpense, ...linkedExpense]), movements, purchases, invoices, cards,
      categories: window.STATE.categorias || [], accounts: window.STATE.contas || [] };
  }

  function renderTable(rows) {
    const wrapper = node('div', '', 'reports-table-wrap');
    const table = node('table', '', 'reports-table');
    const head = table.createTHead().insertRow();
    const headings = ['Data', 'Descrição', mode === 'cartao' ? 'Cartão' : 'Conta / origem'];
    if (mode === 'balanco') headings.push('Situação');
    headings.push('Valor');
    headings.forEach(label => head.appendChild(node('th', label)));
    const body = table.createTBody();
    rows.forEach(item => {
      const row = body.insertRow();
      row.append(node('td', dateBR(item.date)), node('td', item.description), node('td', item.account));
      if (mode === 'balanco') {
        const status = node('td', '');
        status.appendChild(node('span', labels[item.lane], 'reports-status-label'));
        row.appendChild(status);
      }
      row.appendChild(node('td', fmt(item.value)));
      if (item.purchaseDate && mode === 'cartao') row.children[1].appendChild(node('p', `Compra em ${dateBR(item.purchaseDate)}`));
      if (item.overdue) row.children[1].appendChild(node('p', 'Vencido antes do período'));
      if (item.provisional) row.children[1].appendChild(node('p', 'Fatura aberta · valor provisório'));
    });
    wrapper.appendChild(table);
    return wrapper;
  }

  const balanceHeadings = ['Recebido', 'Pago', 'Previsto a receber', 'Previsto a pagar', 'Saldo projetado'];
  const balanceValues = item => [item.recebidos, item.pagos, item.receber, item.pagar, item.projected];
  function amountCell(value, isBalance = false) {
    return node('td', fmt(value), isBalance ? value < 0 ? 'report-negative' : 'report-positive' : '');
  }
  function balanceCells(row, item) {
    balanceValues(item).forEach((value, index) => row.appendChild(amountCell(value, index === 4)));
  }
  function balanceCategoryTable() {
    const wrapper = node('div', '', 'reports-table-wrap');
    const table = node('table', '', 'reports-table reports-balance-table');
    const head = table.createTHead().insertRow();
    ['Categoria', ...balanceHeadings].forEach(label => head.appendChild(node('th', label)));
    const body = table.createTBody();
    result.groups.forEach(group => { const row = body.insertRow(); row.appendChild(node('td', group.name)); balanceCells(row, group); });
    const foot = table.createTFoot().insertRow();
    foot.appendChild(node('td', 'Total do período')); balanceCells(foot, result);
    wrapper.appendChild(table);
    return wrapper;
  }

  function render() {
    if (!snapshot) return;
    const options = filters();
    if (loadedKey !== `${options.start}:${options.end}:${options.overdue}`) return;
    const build = mode === 'balanco' ? window.ArolixReportsRules.buildBalance : window.ArolixReportsRules.buildReport;
    const available = build(snapshot, { ...options, category: 'all' });
    setOptions('report-category', available.groups.map(item => ({ id: item.id, nome: item.name })), 'Todas as categorias');
    options.category = $('report-category').value;
    result = build(snapshot, options);
    loadedOptions = options;
    $('report-total').textContent = mode === 'cartao' ? fmt(result.total) : '—';
    $('report-count').textContent = String(result.rows.length);
    $('report-category-count').textContent = String(result.groups.length);
    const scope = [labels[mode], `${dateBR(options.start)} a ${dateBR(options.end)}`];
    if (mode === 'balanco' && options.account !== 'all') scope.push($('report-account').selectedOptions[0].textContent);
    if (mode === 'cartao' && options.card !== 'all') scope.push($('report-card').selectedOptions[0].textContent);
    if (options.category !== 'all') scope.push($('report-category').selectedOptions[0].textContent);
    if (options.overdue && mode === 'balanco') scope.push('incluindo vencidos anteriores');
    $('report-period-caption').textContent = scope.join(' · ');
    if (mode === 'balanco') {
      const values = { 'report-received': result.recebidos, 'report-paid': result.pagos,
        'report-receivable': result.receber, 'report-payable': result.pagar,
        'report-realized': result.realized, 'report-projected': result.projected };
      Object.entries(values).forEach(([id, value]) => { $(id).textContent = fmt(value); });
      ['report-realized', 'report-projected'].forEach(id => {
        $(id).classList.toggle('report-negative', values[id] < 0);
        $(id).classList.toggle('report-positive', values[id] >= 0);
      });
    }
    $('report-note').textContent = mode === 'cartao'
      ? 'Compras e parcelas por mês de fatura, com a data original da compra no detalhamento. Pagamentos da fatura não entram nesta visão. Este total não deve ser somado ao relatório de despesas pagas.'
      : 'Recebido e pago usam a data da baixa e incluem juros e descontos. Previsões usam o vencimento dos lançamentos cadastrados, incluindo faturas abertas sem duplicar faturas fechadas. O saldo mostra o resultado deste período, não o saldo bancário. Transferências e investimentos ficam fora. Recorrências futuras entram quando seus lançamentos já estão cadastrados.';
    if (mode === 'balanco' && options.account !== 'all') {
      $('report-note').textContent += ' Faturas abertas ainda sem conta de pagamento definida aparecem em Todas as contas.';
    }
    $('report-category-heading').textContent = mode === 'balanco' ? 'Balanço por categoria' : 'Compras por categoria';
    $('report-monthly-heading').textContent = mode === 'balanco' ? 'Planejamento mês a mês' : 'Compras por mês de fatura';
    const content = $('report-content');
    content.replaceChildren();
    if (!result.rows.length) content.appendChild(node('p', 'Nenhum lançamento encontrado para estes filtros.', 'reports-empty'));
    if (mode === 'balanco') {
      content.appendChild(balanceCategoryTable());
      if (result.rows.length) content.appendChild(node('h3', 'Detalhamento · clique na categoria para ver os lançamentos', 'reports-detail-heading'));
    }
    result.groups.forEach(group => {
      const detail = node('details', '', 'reports-group');
      const summary = node('summary', '');
      summary.append(node('span', group.name), node('small', `${group.rows.length} lançamento(s)`), node('strong', fmt(mode === 'balanco' ? group.projected : group.total)));
      detail.append(summary, renderTable(group.rows));
      content.appendChild(detail);
    });
    const monthly = $('report-monthly');
    monthly.replaceChildren();
    const monthlyHead = $('report-monthly-head');
    monthlyHead.replaceChildren();
    const header = document.createElement('tr');
    ['Mês', ...(mode === 'balanco' ? balanceHeadings : ['Total'])].forEach(label => header.appendChild(node('th', label)));
    monthlyHead.appendChild(header);
    monthly.closest('table').classList.toggle('reports-balance-table', mode === 'balanco');
    result.months.forEach(item => {
      const row = document.createElement('tr');
      row.appendChild(node('td', item.month === 'overdue' ? 'Vencidos antes do período' : `${item.month.slice(5)}/${item.month.slice(0, 4)}`));
      if (mode === 'balanco') balanceCells(row, item);
      else row.appendChild(amountCell(item.total));
      monthly.appendChild(row);
    });
    $('report-export').disabled = !result.rows.length;
    $('report-print').disabled = !result.rows.length;
  }

  async function refresh(force = false) {
    const options = filters(), key = `${options.start}:${options.end}:${options.overdue}`;
    const currentRequest = ++request;
    if (!options.start || !options.end || options.start > options.end) {
      $('report-status').textContent = 'Informe uma data inicial e final válidas.';
      $('report-status').className = 'reports-error';
      $('report-export').disabled = $('report-print').disabled = true;
      return;
    }
    if (!force && snapshot && loadedKey === key) { render(); return; }
    $('report-status').textContent = 'Carregando relatórios…';
    $('report-status').className = '';
    $('report-export').disabled = $('report-print').disabled = true;
    try {
      const data = await fetchData(options);
      if (currentRequest !== request) return;
      snapshot = data; loadedKey = key;
      setOptions('report-account', data.accounts, 'Todas as contas');
      setOptions('report-card', data.cards, 'Todos os cartões');
      $('report-status').textContent = '';
      render();
    } catch (error) {
      if (currentRequest !== request) return;
      snapshot = null; result = null;
      $('report-content').replaceChildren();
      $('report-total').textContent = '—';
      ['report-count', 'report-category-count', 'report-received', 'report-paid', 'report-receivable', 'report-payable', 'report-realized', 'report-projected'].forEach(id => { $(id).textContent = '—'; });
      $('report-monthly').replaceChildren();
      $('report-status').className = 'reports-error';
      $('report-status').textContent = `Não foi possível carregar o relatório. ${error.message || 'Tente novamente.'}`;
    }
  }

  function setMode(value) {
    mode = value;
    document.querySelectorAll('[data-report-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.reportMode === mode)));
    $('report-account-label').classList.toggle('hidden', mode === 'cartao');
    $('report-card-label').classList.toggle('hidden', mode !== 'cartao');
    $('report-overdue-label').classList.toggle('hidden', mode !== 'balanco');
    $('report-balance-summary').classList.toggle('hidden', mode !== 'balanco');
    $('report-balance-result').classList.toggle('hidden', mode !== 'balanco');
    $('report-card-summary').classList.toggle('hidden', mode !== 'cartao');
    $('report-category').value = 'all';
  }
  function init() {
    if (initialized) return;
    initialized = true;
    setMode('balanco');
    const today = window.ArolixRuntime.localISODate(new Date());
    $('report-month').value = today.slice(0, 7); $('report-year').value = today.slice(0, 4);
    periodPreset();
    ['report-period', 'report-month', 'report-year'].forEach(id => $(id).addEventListener('change', () => { periodPreset(); refresh(); }));
    ['report-start', 'report-end', 'report-overdue'].forEach(id => $(id).addEventListener('change', () => refresh()));
    ['report-account', 'report-card', 'report-category'].forEach(id => $(id).addEventListener('change', () => render()));
    document.querySelectorAll('[data-report-mode]').forEach(button => button.addEventListener('click', () => { setMode(button.dataset.reportMode); refresh(); }));
    $('report-refresh').addEventListener('click', () => refresh(true));
    $('report-export').addEventListener('click', () => {
      if (!result || !loadedOptions) return;
      const quote = value => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
      const decimal = value => Number(value).toFixed(2).replace('.', ',');
      const rows = mode === 'balanco' ? [
        ['Balanço do período', dateBR(loadedOptions.start), dateBR(loadedOptions.end)],
        ['Resumo', ...balanceHeadings], ['Total', ...balanceValues(result).map(decimal)],
        ['Saldo realizado', decimal(result.realized)], [],
        ['Categoria', ...balanceHeadings], ...result.groups.map(group => [group.name, ...balanceValues(group).map(decimal)]), [],
        ['Mês', ...balanceHeadings], ...result.months.map(item => [item.month === 'overdue' ? 'Vencidos antes do período' : item.month, ...balanceValues(item).map(decimal)]), [],
        ['Data', 'Descrição', 'Categoria', 'Conta', 'Situação', 'Valor'],
        ...result.rows.map(item => [dateBR(item.date), item.description, item.category, item.account, labels[item.lane], decimal(item.value)])
      ] : [['Data', 'Descrição', 'Categoria', 'Cartão', 'Valor', 'Data da compra'],
        ...result.rows.map(item => [dateBR(item.date), item.description, item.category, item.account, decimal(item.value), dateBR(item.purchaseDate)])];
      const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url;
      link.download = `arolix-${mode}-${loadedOptions.start}-${loadedOptions.end}.csv`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('report-print').addEventListener('click', () => {
      const details = Array.from(document.querySelectorAll('#report-content details'));
      const original = details.map(item => item.open);
      details.forEach(item => { item.open = true; });
      window.addEventListener('afterprint', () => details.forEach((item, index) => { item.open = original[index]; }), { once: true });
      window.print();
    });
  }
  window.ArolixReports = { open(value) { init(); setMode(value === 'cartao' ? 'cartao' : 'balanco'); refresh(true); } };
})();
