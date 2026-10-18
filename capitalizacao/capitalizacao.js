(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const rules = window.ArolixCapitalizacao;
  const state = { user: null, profile: null, titulos: [], pagamentos: [], recebimentos: [], despesas: [], compras: [], faturas: [], receitas: [], movimentacoes: [], selected: null, editing: null, busy: false, loading: false, loadedAt: 0 };
  const today = () => window.ArolixRuntime.localISODate(new Date());
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = iso => iso ? iso.slice(0,10).split('-').reverse().join('/') : '—';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function node(tag, value, className) {
    const el = document.createElement(tag);
    if (value != null) el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function button(label, handler, className = 'btn-secondary') {
    const el = node('button', label, className); el.type = 'button'; el.onclick = handler; return el;
  }
  function errorText(error) {
    if (error?.code === '23505') return 'Este título ou lançamento já está vinculado. Atualize a página e confira os vínculos.';
    if (error?.code === '42501') return 'Acesso negado. Confira sua assinatura e confirme o MFA ao entrar novamente.';
    return error?.message || 'Não foi possível concluir. Tente novamente.';
  }
  async function loadAll(table, columns = '*') {
    const { data, error } = await window.ArolixRuntime.selectAll(supabase.from(table).select(columns).eq('user_id', state.user.id).order('id'));
    if (error) throw error;
    return data || [];
  }
  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    try {
      const names = ['titulos','pagamentos','recebimentos','despesas','compras','faturas','receitas'];
      const result = await Promise.all([
        loadAll('capitalizacao_titulos'), loadAll('capitalizacao_pagamentos'), loadAll('capitalizacao_recebimentos'),
        loadAll('despesas', 'id,descricao,valor,data,data_baixa,baixado,recorrencia_id,cartao_fatura_id,cartao_pagamento_parcial'),
        loadAll('cartao_lancamentos', 'id,descricao,valor,data_compra,data_fatura,tipo,cartao_id,fatura_id,despesa_id'),
        loadAll('cartao_faturas', 'id,cartao_id,mes,ano,pago,status'),
        loadAll('receitas', 'id,descricao,valor,data,data_baixa,baixado')
      ]);
      const ids = result[2].map(link => link.receita_id);
      const movs = ids.length ? await window.ArolixRuntime.selectIn(batch => supabase.from('movimentacoes')
        .select('lancamento_id,valor,tipo').eq('user_id', state.user.id).in('lancamento_id', batch), ids) : { data: [], error: null };
      if (movs.error) throw movs.error;
      names.forEach((name, index) => { state[name] = result[index]; });
      state.movimentacoes = movs.data || [];
      state.loadedAt = Date.now();
      render(); $('cap-content').classList.remove('hidden'); $('cap-status').textContent = '';
    } catch (error) {
      $('cap-status').textContent = `Não foi possível atualizar a capitalização. ${errorText(error)} Os dados anteriores podem estar desatualizados.`;
      throw error;
    } finally { state.loading = false; }
  }
  async function mutate(statusId, task) {
    if (state.busy) return;
    state.busy = true;
    const buttons = Array.from(document.querySelectorAll('dialog button'));
    buttons.forEach(el => { el.disabled = true; });
    $(statusId).textContent = 'Salvando…';
    try {
      if (!window.ArolixAccess.hasFinancialAccess(state.profile)) throw new Error('Assinatura sem acesso financeiro.');
      await task();
      $(statusId).textContent = 'Salvo. Nenhum lançamento financeiro foi criado ou alterado.';
      await refresh();
    } catch (error) { $(statusId).textContent = errorText(error); }
    finally { state.busy = false; buttons.forEach(el => { el.disabled = false; }); }
  }
  function render() {
    const summaries = state.titulos.map(t => ({ t, s: rules.summary(t, state, today()) }));
    $('cap-ativos').textContent = state.titulos.filter(t => t.status === 'ativo').length;
    $('cap-pago').textContent = money(rules.sum(summaries.map(x => x.s.totalPago)));
    $('cap-premios').textContent = money(rules.sum(summaries.map(x => x.s.premios)));
    $('cap-resgatado').textContent = money(rules.sum(summaries.map(x => x.s.resgatado)));
    const list = $('cap-list'); list.replaceChildren();
    if (!summaries.length) {
      const empty = node('article', null, 'cap-empty');
      empty.append(node('h2', 'Seus títulos, sem confundir com investimento'), node('p', 'Cadastre o título e vincule as parcelas já existentes no app.'), button('Cadastrar primeiro título', () => openTitle(), 'btn-primary'));
      list.append(empty); return;
    }
    summaries.sort((a,b) => a.t.fim_vigencia.localeCompare(b.t.fim_vigencia)).forEach(({ t, s }) => {
      const card = node('article', null, 'cap-title-card');
      const head = node('header', null, 'cap-card-head'); const info = node('div');
      info.append(node('span', `${t.instituicao} • ${t.prazo_meses} meses`, 'cap-tag'), node('h2', t.nome), node('small', t.numero_titulo ? `Título ${t.numero_titulo}` : 'Número do título não informado', 'cap-help'));
      head.append(info, node('span', t.status === 'ativo' ? 'Ativo' : 'Encerrado', 'cap-tag')); card.append(head);
      const progressText = node('div', null, 'cap-progress-label');
      progressText.append(node('span', `${s.pagas} de ${t.prazo_meses} parcelas pagas`), node('span', `${s.restantes} restantes`));
      const progress = document.createElement('progress'); progress.max = Number(t.prazo_meses); progress.value = s.pagas; progress.setAttribute('aria-label', 'Progresso das parcelas pagas');
      card.append(progressText, progress);
      const metrics = node('div', null, 'cap-metrics');
      const metric = (label,value,hint) => { const box = node('div'); box.append(node('span',label),node('strong',value),node('small',hint)); metrics.append(box); };
      metric('Total contribuído', money(s.totalPago), 'Parcelas nominais confirmadas, sem somar duas vezes a fatura.');
      if (t.valor_resgate_banco != null) metric('Resgate informado pelo banco', money(t.valor_resgate_banco), `Consulta em ${date(t.data_consulta_resgate)}. Pode ter mudado desde então.`);
      else if (s.estimativa != null && t.status === 'ativo') metric('Referência de resgate • tabela', money(s.estimativa), `${s.percentual.toLocaleString('pt-BR')}% do total pago. Base TR = 0; não é cotação líquida nem garantia de liberação.`);
      else metric('Resgate antecipado', 'Não calculado', t.status === 'encerrado' ? 'Título encerrado. Consulte os resgates efetivamente recebidos.' : 'Informe uma consulta do banco ou confira as condições gerais do produto.');
      metric('Fim previsto da vigência', date(t.fim_vigencia), `${money(t.valor_parcela)} por mês atualmente${t.reajuste === 'igpm_anual' ? ' • reajuste anual pelo IGP-M' : ' • reajuste não informado'}.`);
      card.append(metrics);
      if (t.status === 'ativo' && s.vencido) card.append(node('p', 'O fim previsto chegou. Confira o resgate e eventuais prorrogações no banco.', 'cap-warning'));
      if (s.excesso) card.append(node('p', 'Há mais pagamentos do que o prazo contratado. Revise os vínculos antes de usar a estimativa.', 'cap-warning'));
      if (t.status === 'ativo' && s.proximas[0]) card.append(node('p', `Próxima parcela vinculada ainda não quitada: ${date(s.proximas[0].data)} • ${money(s.proximas[0].valor)}.`, 'cap-help'));
      if (t.status === 'ativo' && !s.proximas.length && s.restantes > 0) card.append(node('p', 'Sem próximas parcelas vinculadas. Vincule os lançamentos futuros para continuar acompanhando.', 'cap-warning'));
      const actions = node('div', null, 'cap-actions');
      actions.append(button('Vincular parcelas', () => openLinks(t)), button('Prêmios e resgates', () => openEvents(t)), button('Editar dados', () => openTitle(t)));
      card.append(actions);
      const detail = node('details'); detail.append(node('summary', 'Histórico e condições'));
      detail.append(node('p', `SUSEP: ${t.processo_susep || 'Não informado'} • Vigência: ${date(t.inicio_vigencia)} a ${date(t.fim_vigencia)} • Número da sorte: ${t.numero_sorte || 'Não informado'}`, 'cap-help'));
      detail.append(node('p', `Base nominal a parcelas constantes: ${money(s.baseFinal)}. Não inclui reajustes futuros, TR ou prêmios e não é promessa de resgate. Atrasos podem prorrogar a vigência; confirme as datas com o banco.`, 'cap-help'));
      if (t.regra_resgate === 'raspa48_662222_2024') detail.append(node('p', 'Tabela do produto de 48 meses: já incorpora as hipóteses de remuneração da ficha. Não se aplica juros de 0,73% novamente. Carência, tributos e condições de liberação devem ser conferidos no banco.', 'cap-help'));
      if (t.observacoes) detail.append(node('p', t.observacoes, 'cap-help'));
      const table = node('table', null, 'cap-table'); const thead = node('thead'); const tr = node('tr');
      ['Data','Parcela vinculada','Valor','Situação',''].forEach(label => tr.append(node('th', label))); thead.append(tr); table.append(thead);
      const tbody = node('tbody');
      s.rows.forEach(row => {
        const line = node('tr');
        line.append(node('td',date(row.data)),node('td',row.source.descricao),node('td',money(row.valor)),node('td',row.detalhe));
        const action = node('td'); action.append(button('Desvincular', () => unlink('capitalizacao_pagamentos', row.link.id), 'btn-secondary cap-remove')); line.append(action); tbody.append(line);
      });
      table.append(tbody); const wrap = node('div', null, 'cap-table-wrap'); wrap.append(table); detail.append(wrap);
      if (!s.rows.length) detail.append(node('p','Nenhuma parcela vinculada. O app não supõe que uma parcela foi paga só pela passagem do tempo.', 'cap-help'));
      detail.append(button('Remover acompanhamento', () => deleteTitle(t), 'btn-secondary cap-remove'));
      card.append(detail); list.append(card);
    });
  }
  function openTitle(t = null) {
    if (state.busy) return;
    state.editing = t?.id || null; $('title-form').reset(); $('title-status').textContent = '';
    $('title-heading').textContent = t ? 'Editar título' : 'Novo título';
    const values = t || { nome: '', instituicao: 'Santander', inicio_vigencia: today(), fim_vigencia: '', dia_cobranca: new Date().getDate(), status: 'ativo' };
    const fields = { nome:'nome', instituicao:'instituicao', numero:'numero_titulo', proposta:'numero_proposta', sorte:'numero_sorte', susep:'processo_susep', prazo:'prazo_meses', inicio:'inicio_vigencia', fim:'fim_vigencia', dia:'dia_cobranca', reajuste:'reajuste', 'titulo-status':'status', 'data-cotacao':'data_consulta_resgate', observacoes:'observacoes' };
    Object.entries(fields).forEach(([id,field]) => { if (values[field] != null) $(id).value = values[field]; });
    $('parcela').value = t ? Number(t.valor_parcela).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '';
    $('cotacao').value = t?.valor_resgate_banco == null ? '' : Number(t.valor_resgate_banco).toLocaleString('pt-BR',{minimumFractionDigits:2});
    $('modelo').value = t?.regra_resgate === 'raspa48_662222_2024' ? 'raspa48' : t?.processo_susep === '15414.662220/2024-12' ? 'raspa60' : 'outro';
    $('title-dialog').showModal();
  }
  function setEndDate() {
    if ($('inicio').value && Number($('prazo').value) > 0) $('fim').value = window.ArolixRuntime.addMonthsClamped($('inicio').value, Number($('prazo').value));
  }
  $('modelo').onchange = () => {
    const modelo = $('modelo').value;
    if (modelo === 'outro') return;
    const is48 = modelo === 'raspa48';
    $('nome').value = `Raspa DinDin ${is48 ? 48 : 60} meses`; $('prazo').value = is48 ? 48 : 60;
    $('instituicao').value = 'Santander'; $('susep').value = is48 ? '15414.662222/2024-10' : '15414.662220/2024-12';
    $('reajuste').value = is48 ? 'igpm_anual' : 'nao_informado'; setEndDate();
  };
  $('inicio').onchange = setEndDate; $('prazo').onchange = setEndDate;
  $('title-form').onsubmit = event => {
    event.preventDefault();
    mutate('title-status', async () => {
      const amount = id => $(id).value.trim() ? window.ArolixRuntime.parseMoney($(id).value) : null;
      const title = rules.validateTitle({ nome:$('nome').value.trim(), instituicao:$('instituicao').value.trim(), numero_titulo:$('numero').value.trim() || null,
        numero_proposta:$('proposta').value.trim() || null, numero_sorte:$('sorte').value.trim() || null, processo_susep:$('susep').value.trim() || null,
        valor_parcela:amount('parcela'), prazo_meses:Number($('prazo').value), inicio_vigencia:$('inicio').value, fim_vigencia:$('fim').value,
        dia_cobranca:Number($('dia').value), reajuste:$('reajuste').value, regra_resgate:$('modelo').value === 'raspa48' ? 'raspa48_662222_2024' : 'nao_informada',
        status:$('titulo-status').value, valor_resgate_banco:amount('cotacao'), data_consulta_resgate:$('data-cotacao').value || null, observacoes:$('observacoes').value.trim() || null });
      let query = supabase.from('capitalizacao_titulos');
      query = state.editing ? query.update(title).eq('id', state.editing).eq('user_id', state.user.id) : query.insert({ ...title, user_id:state.user.id });
      const { data, error } = await query.select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('O título não foi salvo. Atualize a página e tente novamente.');
      $('title-dialog').close();
    });
  };
  function eligible(source) {
    return (source === 'despesa' ? state.despesas.filter(row => !row.cartao_fatura_id && !row.cartao_pagamento_parcial) : state.compras.filter(row => !row.tipo || row.tipo === 'compra')).filter(row => Number(row.valor) > 0);
  }
  function openLinks(t) {
    state.selected = t.id; $('link-title').textContent = t.nome; $('link-status').textContent = '';
    $('link-source').value = 'despesa'; $('link-mode').value = 'one'; $('link-search').value = t.numero_titulo || 'DinDin';
    renderOptions(); $('links-dialog').showModal();
  }
  function renderOptions() {
    const source = $('link-source').value; const query = normalize($('link-search').value.trim());
    const key = source === 'despesa' ? 'despesa_id' : 'cartao_lancamento_id';
    const linked = new Set(state.pagamentos.map(link => link[key]).filter(Boolean));
    const options = eligible(source).filter(row => !linked.has(row.id) && normalize(row.descricao).includes(query));
    const list = $('link-options'); list.replaceChildren();
    options.sort((a,b) => String(a.data || a.data_compra).localeCompare(String(b.data || b.data_compra))).forEach(row => {
      const label = node('label', null, 'cap-option'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = row.id;
      const info = node('span', row.descricao); info.append(node('small', `${date(row.data || row.data_compra)} • ${money(row.valor)} • ${source === 'cartao' ? 'Quitação verificada pela fatura' : row.baixado ? 'Pago' : 'A pagar'}`));
      label.append(checkbox, info); list.append(label);
    });
    if (!options.length) list.append(node('p','Nenhum item disponível nesta busca. Limpe a busca ou confira se a parcela já foi vinculada.', 'cap-help'));
  }
  $('link-search').oninput = renderOptions;
  $('link-source').onchange = () => { $('link-mode').value = 'one'; $('link-mode').disabled = $('link-source').value === 'cartao'; renderOptions(); };
  $('save-links').onclick = () => mutate('link-status', async () => {
    const source = $('link-source').value, selected = new Set(Array.from($('link-options').querySelectorAll('input:checked')).map(el => el.value));
    if (!selected.size) throw new Error('Selecione pelo menos uma parcela.');
    const sourceRows = eligible(source);
    const series = new Set(sourceRows.filter(row => selected.has(row.id)).map(row => row.recorrencia_id).filter(Boolean));
    const key = source === 'despesa' ? 'despesa_id' : 'cartao_lancamento_id';
    let chosen = sourceRows.filter(row => selected.has(row.id) || (source === 'despesa' && $('link-mode').value === 'series' && series.has(row.recorrencia_id)));
    if (chosen.some(row => state.pagamentos.some(link => link[key] === row.id && link.titulo_id !== state.selected))) throw new Error('Uma parcela da série pertence a outro título. Revise a seleção.');
    chosen = chosen.filter(row => !state.pagamentos.some(link => link[key] === row.id));
    if (!chosen.length) throw new Error('Esses pagamentos já estão vinculados.');
    const { error } = await supabase.from('capitalizacao_pagamentos').insert(chosen.map(row => ({ user_id:state.user.id, titulo_id:state.selected, [key]:row.id })));
    if (error) throw error;
    $('links-dialog').close();
  });
  async function unlink(table, id) {
    if (state.busy || !confirm('Remover somente o vínculo? O lançamento original e o saldo da conta serão mantidos.')) return;
    await mutate('cap-status', async () => {
      const { data, error } = await supabase.from(table).delete().eq('id', id).eq('user_id', state.user.id).select('id');
      if (error) throw error; if (!data?.length) throw new Error('Vínculo não encontrado. Atualize a página.');
    });
  }
  async function deleteTitle(t) {
    if (state.busy || !confirm('Remover este título do acompanhamento? Os pagamentos, prêmios e resgates originais NÃO serão apagados.')) return;
    await mutate('cap-status', async () => {
      const { data, error } = await supabase.from('capitalizacao_titulos').delete().eq('id',t.id).eq('user_id',state.user.id).select('id');
      if (error) throw error; if (!data?.length) throw new Error('Título não encontrado.');
    });
  }
  function renderEventOptions() {
    const used = new Set(state.recebimentos.map(link => link.receita_id)); const query = normalize($('event-search').value);
    $('event-source').replaceChildren(new Option('Selecione a receita', ''));
    state.receitas.filter(row => !used.has(row.id) && Number(row.valor) > 0 && normalize(row.descricao).includes(query)).forEach(row => {
      $('event-source').append(new Option(`${date(row.data_baixa || row.data)} • ${row.descricao} • ${money(row.valor)}${row.baixado ? ' • Recebido' : ' • A receber'}`,row.id));
    });
  }
  function openEvents(t) {
    state.selected = t.id; $('event-title').textContent = t.nome; $('event-status').textContent = ''; $('event-search').value = ''; $('event-type').value = 'premio';
    renderEvents(); renderEventOptions(); $('events-dialog').showModal();
  }
  function renderEvents() {
    const list = $('event-list'); list.replaceChildren();
    state.recebimentos.filter(link => link.titulo_id === state.selected).forEach(link => {
      const receita = state.receitas.find(row => row.id === link.receita_id); if (!receita) return;
      const row = node('div', null, 'cap-receipt-row'); const info = node('div', `${link.tipo === 'premio' ? 'Prêmio' : 'Resgate'} • ${money(receita.valor)}`);
      info.append(node('small',`${receita.descricao} • ${receita.baixado ? 'Recebido' : 'A receber'}`));
      row.append(info,button('Desvincular', async () => { await unlink('capitalizacao_recebimentos',link.id); renderEvents(); renderEventOptions(); }, 'btn-secondary cap-remove')); list.append(row);
    });
    if (!list.children.length) list.append(node('p','Nenhum prêmio ou resgate vinculado.', 'cap-help'));
  }
  $('event-search').oninput = renderEventOptions;
  $('event-form').onsubmit = event => {
    event.preventDefault(); mutate('event-status', async () => {
      if (!$('event-source').value) throw new Error('Selecione a receita.');
      const { error } = await supabase.from('capitalizacao_recebimentos').insert({ user_id:state.user.id,titulo_id:state.selected,receita_id:$('event-source').value,tipo:$('event-type').value });
      if (error) throw error;
      $('events-dialog').close();
    });
  };
  document.querySelectorAll('[data-close]').forEach(el => { el.onclick = () => { if (!state.busy) $(el.dataset.close).close(); }; });
  document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); }); });
  $('novo-titulo').onclick = () => openTitle();
  $('sair').onclick = async () => { await supabase.auth.signOut(); location.href = '../login.html'; };
  window.addEventListener('focus', () => { if (state.user && !state.busy && Date.now() - state.loadedAt > 30000 && !document.querySelector('dialog[open]')) refresh().catch(console.error); });
  async function boot() {
    try {
      if (!(await window.ArolixSecurity.requireMfaForProtectedPage())) return;
      const { data, error } = await supabase.auth.getUser(); if (error) throw error;
      if (!data.user) { location.href = '../login.html'; return; } state.user = data.user;
      const result = await supabase.from('user_profiles').select('*').eq('id',state.user.id).maybeSingle();
      if (result.error) throw result.error; state.profile = result.data;
      if (!window.ArolixAccess.hasFinancialAccess(state.profile)) throw new Error('Seu plano não possui acesso financeiro ativo.');
      await refresh(); $('novo-titulo').disabled = false;
    } catch (error) { $('cap-status').textContent = `Não foi possível carregar. ${errorText(error)}`; }
  }
  boot();
})();
