(function () {
  const $ = id => document.getElementById(id);
  const labels = { lancamentos: 'Relatório de lançamentos', balanco: 'Balanço do período', recebidos: 'Recebido', pagos: 'Pago', receber: 'A receber', pagar: 'A pagar', cartao: 'Compras no cartão' };
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
    $('report-period-navigation').classList.toggle('hidden', !['month', 'year'].includes(type));
    $('report-custom-dates').classList.toggle('hidden', type !== 'custom');
    $('report-future-range').classList.toggle('hidden', type !== 'future');
    $('report-previous').setAttribute('aria-label', type === 'year' ? 'Ano anterior' : 'Mês anterior');
    $('report-next').setAttribute('aria-label', type === 'year' ? 'Próximo ano' : 'Próximo mês');
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
    $('report-future-range').textContent = `${dateBR($('report-start').value)} a ${dateBR($('report-end').value)}`;
    const year = Number((type === 'year' ? $('report-year').value : $('report-month').value).slice(0, 4));
    $('report-previous').disabled = type === 'year' ? year <= 1900 : $('report-month').value <= '1900-01';
    $('report-next').disabled = type === 'year' ? year >= 2200 : $('report-month').value >= '2200-12';
  }
  function navigatePeriod(direction) {
    const type = $('report-period').value;
    if (type === 'month') {
      const [year, month] = $('report-month').value.split('-').map(Number);
      if (!year || !month) return;
      const date = new Date(year, month - 1 + direction, 1);
      if (date.getFullYear() < 1900 || date.getFullYear() > 2200) return;
      $('report-month').value = window.ArolixRuntime.localISODate(date).slice(0, 7);
    } else if (type === 'year') {
      const year = Number($('report-year').value) + direction;
      if (year < 1900 || year > 2200) return;
      $('report-year').value = year;
    } else return;
    periodPreset(); refresh();
  }
  function updateFilterControls() {
    const overdue = mode !== 'cartao' && $('report-overdue').checked;
    $('report-more-count').classList.toggle('hidden', !overdue);
    $('report-clear-filters').disabled = !overdue && $('report-category').value === 'all'
      && $(mode === 'cartao' ? 'report-card' : 'report-account').value === 'all'
      && (mode !== 'lancamentos' || (!$('transaction-report-categories').querySelector(':checked')
        && $('transaction-report-kind').value === 'all' && $('transaction-report-status').value === 'all'));
  }
  function filters() {
    return { mode, start: $('report-start').value, end: $('report-end').value,
      account: $('report-account').value, card: $('report-card').value,
      category: $('report-category').value, overdue: $('report-overdue').checked,
      kind: $('transaction-report-kind').value, status: $('transaction-report-status').value,
      categories: Array.from($('transaction-report-categories').querySelectorAll(':checked'), item => item.value) };
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
    const expenses = unique([...pendingExpense, ...paidExpense, ...linkedExpense]);
    const related = async (table, column, ids) => {
      const { data, error } = await window.ArolixRuntime.selectIn(batch => base(table).in(column,batch).order('id'), ids);
      if (error) throw error;
      return data || [];
    };
    // A baixa de uma fatura pode ocorrer em outro mês/ano. Resolve somente seu
    // contexto, com user_id e paginação, antes de detalhar as categorias.
    const invoiceIds = [...new Set(expenses.map(item => item.cartao_fatura_id).filter(Boolean))];
    const partialIds = expenses.filter(item => item.cartao_pagamento_parcial).map(item => item.id);
    const [extraInvoices, paymentReferences] = await Promise.all([
      related('cartao_faturas', 'id', invoiceIds), related('cartao_lancamentos', 'despesa_id', partialIds)
    ]);
    const allInvoices = unique([...invoices, ...extraInvoices]);
    const windows = new Map();
    const include = (cardId, month) => {
      if (!cardId || !/^\d{4}-\d{2}$/.test(month)) return;
      const span = windows.get(cardId) || { start:month, end:month };
      if (month < span.start) span.start = month;
      if (month > span.end) span.end = month;
      windows.set(cardId,span);
    };
    allInvoices.filter(item => invoiceIds.includes(item.id)).forEach(item => include(item.cartao_id,`${item.ano}-${String(item.mes).padStart(2,'0')}`));
    paymentReferences.forEach(item => include(item.cartao_id,String(item.data_fatura || '').slice(0,7)));
    const extraPurchases = await Promise.all(Array.from(windows, ([cardId, span]) => {
      const [year,month] = span.end.split('-').map(Number);
      const last = new Date(year,month,0).getDate();
      return all(base('cartao_lancamentos').eq('cartao_id',cardId).gte('data_fatura',`${span.start}-01`).lte('data_fatura',`${span.end}-${String(last).padStart(2,'0')}`));
    }));
    return { income: unique([...pendingIncome, ...paidIncome, ...linkedIncome]),
      expenses, movements, purchases:unique([...purchases,...paymentReferences,...extraPurchases.flat()]), invoices:allInvoices, cards,
      categories: window.STATE.categorias || [], accounts: (window.STATE.contas || []).map(account => ({...account, nome: window.ArolixRuntime.accountLabel(account)})) };
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
      if (item.cardBreakdown) row.children[1].appendChild(node('p', item.proportional
        ? 'Cartão · valor distribuído proporcionalmente entre as compras da fatura'
        : 'Cartão · categoria da compra, sem somar o pagamento da fatura novamente'));
      if (item.cardAdjustment) row.children[1].appendChild(node('p', 'Diferença preservada sem atribuir a uma categoria de compra por suposição'));
    });
    wrapper.appendChild(table);
    return wrapper;
  }

  const balanceHeadings = ['Já recebido', 'Já pago', 'Falta receber', 'Falta pagar', 'Saldo previsto'];
  const balanceValues = item => [item.recebidos, item.pagos, item.receber, item.pagar, item.pendingBalance];
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
    result.groups.forEach(group => {
      const row = body.insertRow();
      const categoryCell = node('td', group.name);
      if (group.sources?.includes('cartao')) categoryCell.appendChild(node('small', group.sources.includes('lancamento') ? 'Lançamentos + cartão' : 'Cartão', 'reports-category-origin'));
      row.appendChild(categoryCell); balanceCells(row, group);
    });
    const foot = table.createTFoot().insertRow();
    foot.appendChild(node('td', 'Total do período')); balanceCells(foot, result);
    wrapper.appendChild(table);
    return wrapper;
  }

  function render() {
    updateFilterControls();
    if (!snapshot) return;
    const options = filters();
    if (loadedKey !== `${options.start}:${options.end}:${options.overdue}`) return;
    if (mode === 'lancamentos') { renderTransactions(options); return; }
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
        'report-realized': result.realized, 'report-pending-balance': result.pendingBalance };
      Object.entries(values).forEach(([id, value]) => { $(id).textContent = fmt(value); });
      ['report-realized', 'report-pending-balance'].forEach(id => {
        $(id).classList.toggle('report-negative', values[id] < 0);
        $(id).classList.toggle('report-positive', values[id] >= 0);
      });
    }
    $('report-note').textContent = mode === 'cartao'
      ? 'Compras e parcelas por mês de fatura, com a data original da compra no detalhamento. Pagamentos da fatura não entram nesta visão. Este total não deve ser somado ao relatório de despesas pagas.'
      : 'Resumo financeiro pessoal: recebido e pago usam a data da baixa; previsões usam o vencimento. As categorias reúnem lançamentos e compras do cartão, sem somar a fatura duas vezes. Pagamentos parciais do cartão são rateados proporcionalmente. Juros, descontos e ajustes preservam o valor efetivamente pago. O resultado não é lucro contábil nem saldo bancário; a previsão considera apenas o que ainda falta receber e pagar. Transferências e movimentações do módulo de investimentos ficam fora.';
    if (mode === 'balanco' && options.account !== 'all') {
      $('report-note').textContent += ' Faturas abertas ainda sem conta de pagamento definida aparecem em Todas as contas.';
    }
    $('report-category-heading').textContent = mode === 'balanco' ? 'Lançamentos e cartão por categoria' : 'Compras por categoria';
    $('report-monthly-heading').textContent = mode === 'balanco' ? 'Planejamento mês a mês' : 'Compras por mês de fatura';
    const content = $('report-content');
    content.replaceChildren();
    if (!result.rows.length) content.appendChild(node('p', 'Nenhum lançamento encontrado para estes filtros.', 'reports-empty'));
    if (mode === 'balanco') {
      content.appendChild(balanceCategoryTable());
    }
    if (mode === 'cartao') result.groups.forEach(group => {
      const detail = node('details', '', 'reports-group');
      const summary = node('summary', '');
      summary.append(node('span', group.name), node('small', `${group.rows.length} lançamento(s)`));
      if (mode === 'cartao') summary.appendChild(node('strong', fmt(group.total)));
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

  function transactionTable(rows) {
    const wrap = node('div', '', 'reports-table-wrap');
    const table = node('table', '', 'reports-table transaction-report-table');
    const header = table.createTHead().insertRow();
    ['Vencimento', 'Pagamento / recebimento', 'Descrição', 'Categoria', 'Conta', 'Situação', 'Valor'].forEach(text => header.appendChild(node('th', text)));
    const body = table.createTBody();
    rows.forEach(item => {
      const row = body.insertRow();
      [dateBR(item.dueDate), dateBR(item.paymentDate), item.description, item.category, item.account,
        labels[item.lane] + (item.provisional ? ' · Fatura aberta' : ''), fmt(item.value)].forEach(text => row.appendChild(node('td', text)));
      row.lastChild.className = item.kind === 'income' ? 'report-positive' : 'report-negative';
    });
    const foot = table.createTFoot().insertRow();
    const label = node('td', `${rows.length} lançamento(s) · total dos valores listados`); label.colSpan = 6;
    foot.append(label, node('td', fmt(result.total)));
    wrap.appendChild(table); return wrap;
  }
  function renderTransactions(options) {
    const container = $('transaction-report-categories');
    const checked = new Set(options.categories);
    const available = window.ArolixReportsRules.buildTransactions(snapshot, {...options, categories: []});
    const categories = new Map(available.rows.map(row => [row.categoryId, row.category]));
    // Keep selected categories visible even when another filter yields no rows.
    checked.forEach(id => { if (!categories.has(id)) categories.set(id, (snapshot.categories || []).find(item => item.id === id)?.nome || 'Sem categoria'); });
    container.replaceChildren();
    Array.from(categories).sort((a,b) => a[1].localeCompare(b[1])).forEach(([id,name]) => {
      const label = node('label', ''); const input = document.createElement('input');
      input.type = 'checkbox'; input.value = id; input.checked = checked.has(id);
      input.addEventListener('change', render);
      label.append(input, node('span', name)); container.appendChild(label);
    });
    $('transaction-report-category-caption').textContent = checked.size ? `${checked.size} categoria(s) selecionada(s)` : 'Todas as categorias';
    result = window.ArolixReportsRules.buildTransactions(snapshot, options); loadedOptions = options;
    const scope = [labels[mode], `${dateBR(options.start)} a ${dateBR(options.end)}`,
      $('transaction-report-kind').selectedOptions[0].textContent, $('transaction-report-status').selectedOptions[0].textContent];
    if (options.account !== 'all') scope.push($('report-account').selectedOptions[0].textContent);
    if (checked.size) scope.push(...Array.from(checked, id => categories.get(id)));
    if (options.overdue) scope.push('Inclui vencidos anteriores');
    $('report-period-caption').textContent = scope.join(' · ');
    const summary = $('transaction-report-summary'); summary.replaceChildren();
    Object.entries(result.totals).forEach(([lane,total]) => {
      const card = node('div', '', ['recebidos','receber'].includes(lane) ? 'report-income' : 'report-expense');
      card.append(node('span', labels[lane]), node('strong', fmt(total))); summary.appendChild(card);
    });
    $('report-note').textContent = 'Pagos e recebidos são selecionados pela data da baixa e incluem juros e descontos registrados. Pendentes são selecionados pelo vencimento. Faturas aparecem uma única vez, sem somar novamente suas compras. Transferências e aplicações não são receitas ou despesas. O total da listagem soma os valores exibidos, não representa saldo.';
    $('report-category-heading').textContent = 'Lançamentos do período';
    const content = $('report-content'); content.replaceChildren();
    if (result.rows.length) content.appendChild(transactionTable(result.rows));
    else content.appendChild(node('p', 'Nenhum lançamento encontrado para estes filtros.', 'reports-empty'));
    $('report-export').disabled = $('report-print').disabled = !result.rows.length;
    updateFilterControls();
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
      window.ArolixRuntime.populateAccountSelect($('report-account'), window.STATE.contas || [], 'Todas as contas');
      setOptions('report-card', data.cards, 'Todos os cartões');
      $('report-status').textContent = '';
      render();
    } catch (error) {
      if (currentRequest !== request) return;
      snapshot = null; result = null;
      $('report-content').replaceChildren();
      $('report-total').textContent = '—';
      ['report-count', 'report-category-count', 'report-received', 'report-paid', 'report-receivable', 'report-payable', 'report-realized', 'report-pending-balance'].forEach(id => { $(id).textContent = '—'; });
      $('report-monthly').replaceChildren();
      $('report-status').className = 'reports-error';
      $('report-status').textContent = `Não foi possível carregar o relatório. ${error.message || 'Tente novamente.'}`;
    }
  }

  function printReport() {
    if (!result || !loadedOptions || $('report-print').disabled) return;
    const container = node('div', '');
    container.appendChild(node('p', $('report-period-caption').textContent, 'print-scope'));
    const summary = $(mode === 'lancamentos' ? 'transaction-report-summary' : mode === 'balanco' ? 'report-balance-summary' : 'report-card-summary').cloneNode(true);
    summary.classList.remove('hidden'); container.appendChild(summary);
    if (mode === 'balanco') container.appendChild($('report-balance-result').cloneNode(true));
    container.appendChild(node('h2', $('report-category-heading').textContent));
    const content = $('report-content').cloneNode(true);
    content.querySelectorAll('details').forEach(detail => { detail.open = true; });
    container.appendChild(content);
    if (mode !== 'lancamentos' && result.months.length > 1) {
      container.appendChild(node('h2', $('report-monthly-heading').textContent));
      container.appendChild($('report-monthly').closest('table').cloneNode(true));
    }
    container.appendChild(node('p', $('report-note').textContent, 'print-method'));
    // Only cloned, text-populated report nodes enter the isolated print document.
    container.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    window.ArolixReportPrint.open({title:$('report-heading').textContent, html:container.innerHTML});
  }
  function setMode(value) {
    mode = value;
    window.dispatchEvent(new CustomEvent('arolix:screen-change', {detail: mode === 'lancamentos' ? 'lanc' : 'relatorios'}));
    $('report-transactions-back').classList.toggle('hidden', mode !== 'lancamentos');
    $('report-heading').textContent = mode === 'lancamentos' ? 'Relatório de lançamentos' : mode === 'cartao' ? 'Consulta de compras no cartão' : 'Balanço financeiro';
    $('report-description').textContent = mode === 'cartao'
      ? 'Consulta específica do módulo Cartões. Os pagamentos das faturas já estão incluídos no balanço consolidado.'
      : mode === 'lancamentos' ? 'Consulte, filtre e imprima suas receitas e despesas com datas e totais.' : 'Lançamentos e cartão juntos por categoria, com realizado e previsões separados.';
    $('report-card-back').classList.toggle('hidden', mode !== 'cartao');
    $('report-account-label').classList.toggle('hidden', mode === 'cartao');
    $('report-card-label').classList.toggle('hidden', mode !== 'cartao');
    $('report-overdue-label').classList.toggle('hidden', mode === 'cartao');
    $('report-more-filters').classList.toggle('hidden', mode === 'cartao');
    $('report-category').closest('label').classList.toggle('hidden', mode === 'lancamentos');
    $('transaction-report-controls').classList.toggle('hidden', mode !== 'lancamentos');
    $('transaction-report-summary').classList.toggle('hidden', mode !== 'lancamentos');
    $('report-monthly-heading').classList.toggle('hidden', mode === 'lancamentos');
    $('report-monthly').closest('.reports-table-wrap').classList.toggle('hidden', mode === 'lancamentos');
    $('report-balance-summary').classList.toggle('hidden', mode !== 'balanco');
    $('report-balance-result').classList.toggle('hidden', mode !== 'balanco');
    $('report-card-summary').classList.toggle('hidden', mode !== 'cartao');
    $('report-category').value = 'all';
    updateFilterControls();
  }
  function init() {
    if (initialized) return;
    initialized = true;
    setMode('balanco');
    const today = window.ArolixRuntime.localISODate(new Date());
    $('report-month').value = today.slice(0, 7); $('report-year').value = today.slice(0, 4);
    periodPreset();
    ['report-period', 'report-month', 'report-year'].forEach(id => $(id).addEventListener('change', () => { periodPreset(); refresh(); }));
    ['report-start', 'report-end', 'report-overdue'].forEach(id => $(id).addEventListener('change', () => { updateFilterControls(); refresh(); }));
    $('report-previous').addEventListener('click', () => navigatePeriod(-1));
    $('report-next').addEventListener('click', () => navigatePeriod(1));
    $('report-clear-filters').addEventListener('click', () => {
      const reload = $('report-overdue').checked;
      ['report-account', 'report-card', 'report-category'].forEach(id => { $(id).value = 'all'; });
      $('report-overdue').checked = false;
      $('transaction-report-kind').value = $('transaction-report-status').value = 'all';
      $('transaction-report-categories').querySelectorAll('input').forEach(input => { input.checked = false; });
      updateFilterControls();
      if (reload) refresh(); else render();
    });
    ['report-account', 'report-card', 'report-category'].forEach(id => $(id).addEventListener('change', () => render()));
    ['transaction-report-kind', 'transaction-report-status'].forEach(id => $(id).addEventListener('change', render));
    $('report-refresh').addEventListener('click', () => refresh(true));
    $('report-export').addEventListener('click', () => {
      if (!result || !loadedOptions) return;
      const quote = value => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
      const decimal = value => Number(value).toFixed(2).replace('.', ',');
      const rows = mode === 'lancamentos' ? [
        ['Relatório de lançamentos', $('report-period-caption').textContent],
        ['Recebido', 'Pago', 'A receber', 'A pagar'],
        ['recebidos', 'pagos', 'receber', 'pagar'].map(key => decimal(result.totals[key])), [],
        ['Vencimento', 'Pagamento / recebimento', 'Descrição', 'Categoria', 'Conta', 'Situação', 'Valor'],
        ...result.rows.map(item => [dateBR(item.dueDate), dateBR(item.paymentDate), item.description, item.category, item.account,
          labels[item.lane] + (item.provisional ? ' · Fatura aberta' : ''), decimal(item.value)]),
        ['Total da listagem', decimal(result.total)]
      ] : mode === 'balanco' ? [
        ['Balanço do período', dateBR(loadedOptions.start), dateBR(loadedOptions.end)],
        ['Resumo', ...balanceHeadings], ['Total', ...balanceValues(result).map(decimal)],
        ['Resultado realizado', decimal(result.realized)], [],
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
    $('report-print').addEventListener('click', printReport);
  }
  window.ArolixReports = { open(value, context) {
    init(); setMode(['cartao','lancamentos'].includes(value) ? value : 'balanco');
    if (context && mode === 'lancamentos') {
      $('report-period').value = 'custom'; periodPreset();
      $('report-start').value = context.start; $('report-end').value = context.end;
      if (context.account && context.account !== 'all' && !Array.from($('report-account').options).some(option => option.value === context.account)) {
        $('report-account').add(new Option((window.STATE.contas || []).find(item => item.id === context.account)?.nome || 'Conta selecionada', context.account));
      }
      $('report-account').value = context.account || 'all';
      $('report-overdue').checked = context.lane === 'transportadas';
      $('transaction-report-kind').value = ['receitas','recebidos'].includes(context.lane) ? 'income' : ['despesas','pagos'].includes(context.lane) ? 'expense' : 'all';
      $('transaction-report-status').value = ['recebidos','pagos'].includes(context.lane) ? 'paid' : 'pending';
    }
    refresh(true);
  } };
})();
