/* app.js — Versão consolidada completa
   - Compatível com seu HTML atual (dashboard, contas, lançamentos, modal, extrato)
   - Filtragem por conta e período
   - Modal profissional para adicionar/editar lançamentos (parcelamento suportado)
   - Baixa / cancelar baixa (gera e remove movimentacoes)
   - Gráficos Chart.js (receitas por categoria, despesas por categoria, resumo)
   - Popula selects de contas e categorias em todas as telas
   - Realtime via Supabase channels
   - Robusto: checagens, mensagens de console e handlers
*/

/* eslint-disable no-unused-vars */
(() => {
  'use strict';

  /* ============================
     CONFIG & ESTADO GLOBAL
  ============================ */
  const STATE = {
    user: null,
    contas: [],
    categorias: [],
    receitas: [],
    despesas: [],
    movimentacoes: [],
    charts: { recCat: null, desCat: null, resumo: null },
    subs: [] // para armazenar channels se quiser unsub later
  };

  const IDS = {
    // header / auth
    userEmail: 'user-email',
    logoutBtn: 'btn-logout',
    menuBtns: '.menu-btn',
    screens: '[data-screen]',

    // dashboard
    chartRecCat: 'chart-receitas-categorias',
    chartDesCat: 'chart-despesas-categorias',
    chartResumo: 'chart-dashboard',
    dashPeriod: 'dash-period',
    dashReceber: 'dash-receber',
    dashPagar: 'dash-pagar',
    dashSaldoAtual: 'dash-saldo-atual',
    dashSaldoPrevisto: 'dash-saldo-previsto',

    // contas (tabs)
    btnAddConta: 'btn-add-conta',
    contaNome: 'conta-nome',
    contaSaldo: 'conta-saldo',
    contaDataSaldo: 'conta-data-saldo',
    selectContasLista: 'select-contas-lista',
    tabBtns: '.tab-btn',
    tabCadastro: 'tab-cadastro',
    tabExtrato: 'tab-extrato',
    tabCategorias: 'tab-categorias',

    // extrato
    selectExtrato: 'select-contas-extrato',
    periodoExtrato: 'periodo-extrato',
    dataInicioExtrato: 'data-inicio',
    dataFimExtrato: 'data-fim',
    btnFiltrarExtrato: 'btn-filtrar-extrato',
    tableExtrato: 'table-extrato',
    totalReceitasExtrato: 'total-receitas-extrato',
    totalDespesasExtrato: 'total-despesas-extrato',
    saldoPeriodoExtrato: 'saldo-periodo-extrato',
    saldoAtualContaExtrato: 'saldo-atual-conta-extrato',

    // lançamentos (tela principal)
    periodoLanc: 'periodo-lanc',
    dataInicioLanc: 'data-inicio-lanc',
    dataFimLanc: 'data-fim-lanc',
    selectContas: 'select-contas',
    btnFiltrarLanc: 'btn-filtrar-lanc',
    btnOpenAdd: 'btn-open-add-lanc',
    listReceitas: 'list-receitas',
    listDespesas: 'list-despesas',
    totalReceitas: 'total-receitas',
    totalDespesas: 'total-despesas',
    saldoAtual: 'saldo-atual',

    // modal add / edit lançamento
    modalAdd: 'modal-add-lanc',
    modalClose: 'btn-close-add-lanc',
    modalTipo: 'modal-tipo',
    modalValor: 'modal-valor',
    modalDesc: 'modal-desc',
    modalData: 'modal-data',
    modalConta: 'modal-conta',
    modalCategoria: 'modal-categoria',
    modalRecorrencia: 'modal-recorrencia',
    modalParcelas: 'modal-parcelas',
    modalSave: 'modal-save-lanc',
    modalCancel: 'modal-cancel-lanc',

    // categorias tab
    categoriaNome: 'categoria-nome',
    btnAddCategoria: 'btn-add-categoria',
    listaCategorias: 'lista-categorias'
  };

  /* ============================
     HELPERS
  ============================ */
  const $ = id => document.getElementById(id);
  const $all = sel => Array.from(document.querySelectorAll(sel || ''));
  function safeText(el, txt) { if (!el) return; el.textContent = txt; }
  function fmtMoney(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDateBR(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; }
  function isoToday() { return new Date().toISOString().slice(0,10); }
  function uid() { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2,9); }
  function safeGet(elId) { const e = $(elId); return e ? e.value : null; }

  /* ============================
     SESSION / AUTH
  ============================ */
  async function requireSessionOrRedirect() {
    try {
      if (!window.supabase) { console.error('Supabase client não encontrado'); return window.location.href = 'login.html'; }
      const { data } = await supabase.auth.getSession();
      if (!data || !data.session) return window.location.href = 'login.html';
      STATE.user = data.session.user;
      const emailEl = $(IDS.userEmail); if (emailEl) emailEl.textContent = STATE.user.email;
      return true;
    } catch (e) {
      console.error('requireSessionOrRedirect', e);
      return window.location.href = 'login.html';
    }
  }

  /* ============================
     SERVIÇOS (Supabase)
  ============================ */

  const ContasService = {
    async load() {
      try {
        const { data, error } = await supabase.from('contas_bancarias').select('*').eq('user_id', STATE.user.id).order('nome');
        if (error) throw error;
        STATE.contas = data || [];
        return STATE.contas;
      } catch (e) {
        console.error('ContasService.load', e);
        STATE.contas = [];
        return [];
      }
    },
    async create({ nome, saldo_inicial, data_saldo }) {
      try {
        const item = { id: uid(), nome, saldo_inicial: Number(saldo_inicial||0), saldo_atual: Number(saldo_inicial||0), data_saldo, user_id: STATE.user.id };
        const { error } = await supabase.from('contas_bancarias').insert([item]);
        if (error) throw error;
        await this.load();
        return item;
      } catch (e) { console.error('ContasService.create', e); throw e; }
    },
    // opcional: recalcula saldo a partir das movimentacoes da conta
    async recalc(conta_id) {
      try {
        if (!conta_id) return null;
        const { data: conta } = await supabase.from('contas_bancarias').select('saldo_inicial').eq('id', conta_id).maybeSingle();
        const si = Number(conta?.saldo_inicial || 0);
        const { data: movs } = await supabase.from('movimentacoes').select('tipo,valor').eq('conta_id', conta_id);
        let cred = 0, deb = 0;
        (movs || []).forEach(m => { if (m.tipo === 'credito') cred += Number(m.valor||0); else deb += Number(m.valor||0); });
        const saldo = si + cred - deb;
        await supabase.from('contas_bancarias').update({ saldo_atual: saldo }).eq('id', conta_id);
        // atualizar cache local se existir
        const idx = STATE.contas.findIndex(c => c.id === conta_id);
        if (idx >= 0) { STATE.contas[idx].saldo_atual = saldo; }
        return saldo;
      } catch (e) { console.error('ContasService.recalc', e); return null; }
    }
  };

  const CategoriasService = {
    async load() {
      try {
        const { data, error } = await supabase.from('categorias').select('*').order('nome');
        if (error) throw error;
        STATE.categorias = data || [];
        return STATE.categorias;
      } catch (e) { console.error('CategoriasService.load', e); STATE.categorias = []; return []; }
    },
    async add(nome) {
      try {
        const item = { id: uid(), nome };
        const { error } = await supabase.from('categorias').insert([item]);
        if (error) throw error;
        await this.load();
        return item;
      } catch (e) { console.error('CategoriasService.add', e); throw e; }
    }
  };

  const LancService = {
    async fetch(tipo, conta_id='all', inicio, fim) {
      try {
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        let q = supabase.from(tabela).select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: true });
        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('LancService.fetch', e);
        return [];
      }
    },
    async insert(t) {
      try {
        const tabela = t.tipo === 'receita' ? 'receitas' : 'despesas';
        const item = {
          id: uid(),
          user_id: STATE.user.id,
          descricao: t.descricao,
          valor: Number(t.valor || 0),
          data: t.data,
          conta_id: t.conta_id || null,
          categoria_id: t.categoria_id || null,
          baixado: false
        };
        const { error } = await supabase.from(tabela).insert([item]);
        if (error) throw error;
        return item;
      } catch (e) { console.error('LancService.insert', e); throw e; }
    },
    async update(tipo, id, patch) {
      try {
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        const { error } = await supabase.from(tabela).update(patch).eq('id', id);
        if (error) throw error;
        return true;
      } catch (e) { console.error('LancService.update', e); throw e; }
    },
    async delete(tipo, id) {
      try {
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        const { error } = await supabase.from(tabela).delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (e) { console.error('LancService.delete', e); throw e; }
    }
  };

  const MovService = {
    async insert(m) {
      try {
        const item = Object.assign({ id: uid(), user_id: STATE.user.id }, m);
        const { error } = await supabase.from('movimentacoes').insert([item]);
        if (error) throw error;
        return item;
      } catch (e) { console.error('MovService.insert', e); throw e; }
    },
    async delete(id) {
      try {
        const { error } = await supabase.from('movimentacoes').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (e) { console.error('MovService.delete', e); throw e; }
    }
  };

  const ExtratoService = {
    async fetch(conta_id='all', inicio, fim) {
      try {
        let q = supabase.from('movimentacoes').select('*').gte('data', inicio).lte('data', fim).order('data', { ascending: true });
        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('ExtratoService.fetch', e); return []; }
    }
  };

  /* ============================
     UI FUNCTIONS
  ============================ */
  const UI = {
    attachHandlers() {
      // menu buttons
      $all(IDS.menuBtns).forEach(b => {
        b.addEventListener('click', () => {
          const t = b.dataset.target;
          if (t) App.showScreen(t);
        });
      });

      // logout
      const btnLogout = $(IDS.logoutBtn);
      if (btnLogout) btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      });

      // tabs conts
      $all(IDS.tabBtns).forEach(b => {
        b.addEventListener('click', () => {
          $all(IDS.tabBtns).forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          const tab = b.dataset.tab;
          ['tab-cadastro','tab-extrato','tab-categorias'].forEach(id=>{ const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
          const show = document.getElementById('tab-' + tab);
          if (show) show.classList.remove('hidden');
          if (tab === 'extrato') App.renderExtrato();
          if (tab === 'categorias') UI.renderCategorias();
        });
      });

      // periodo lanc change
      const pL = $(IDS.periodoLanc);
      if (pL) pL.addEventListener('change', () => {
        const custom = pL.value === 'personalizado';
        $(IDS.dataInicioLanc).classList.toggle('hidden', !custom);
        $(IDS.dataFimLanc).classList.toggle('hidden', !custom);
      });

      // filtro lanc
      const bFil = $(IDS.btnFiltrarLanc);
      if (bFil) bFil.addEventListener('click', async (e) => { e.preventDefault(); await App.refreshLancamentos(); });

      // open modal add lanc
      const openBtn = $(IDS.btnOpenAdd);
      if (openBtn) openBtn.addEventListener('click', UI.openAddModal);

      // modal close / cancel
      const modalClose = $(IDS.modalClose);
      if (modalClose) modalClose.addEventListener('click', UI.closeAddModal);
      const modalCancel = $(IDS.modalCancel);
      if (modalCancel) modalCancel.addEventListener('click', UI.closeAddModal);

      // modal save
      const modalSave = $(IDS.modalSave);
      if (modalSave) modalSave.addEventListener('click', UI.handleSaveModal);

      // filtrar extrato
      const btnFE = $(IDS.btnFiltrarExtrato);
      if (btnFE) btnFE.addEventListener('click', (e) => { e.preventDefault(); App.renderExtrato(); });

      // add conta / categoria in tabs
      const btnAddConta = $(IDS.btnAddConta);
      if (btnAddConta) btnAddConta.addEventListener('click', async () => {
        const nome = $(IDS.contaNome).value?.trim();
        const saldo = $(IDS.contaSaldo).value;
        const data_saldo = $(IDS.contaDataSaldo).value;
        if (!nome || !data_saldo) return alert('Preencha nome e data do saldo.');
        await ContasService.create({ nome, saldo_inicial: Number(saldo||0), data_saldo });
        await App.reloadAll();
      });

      const btnAddCat = $(IDS.btnAddCategoria);
      if (btnAddCat) btnAddCat.addEventListener('click', async () => {
        const nome = $(IDS.categoriaNome).value?.trim();
        if (!nome) return alert('Informe o nome da categoria.');
        await CategoriasService.add(nome);
        $(IDS.categoriaNome).value = '';
        await App.reloadAll();
      });
    },

    // populate all relevant selects with contas and categorias
   populateSelects() {
  const selFilter = $(IDS.selectContas);
  const selModalConta = $(IDS.modalConta);
  const selModalCat = $(IDS.modalCategoria);
  const selExtr = $(IDS.selectExtrato);
  const selLista = $(IDS.selectContasLista);

  // Limpar selects
  [selFilter, selModalConta, selModalCat, selExtr, selLista].forEach(el => {
    if (el) el.innerHTML = '';
  });

  const addAllOpt = el => {
    if (!el) return;
    el.appendChild(new Option('Todas as Contas', 'all'));
  };

  // ✔ Só Filtros recebem "Todas as Contas"
  addAllOpt(selFilter);
  addAllOpt(selExtr);
  addAllOpt(selLista);

  // ✔ Modal NÃO recebe "Todas as Contas", apenas contas reais
  if (selModalConta) {
    selModalConta.innerHTML = '';
    (STATE.contas || []).forEach(c => {
      selModalConta.appendChild(new Option(c.nome, c.id));
    });
  }

  // ✔ Popular contas nos filtros normalmente
  (STATE.contas || []).forEach(c => {
    const label = `${c.nome} (${fmtMoney(c.saldo_atual ?? c.saldo_inicial)})`;
    if (selFilter) selFilter.appendChild(new Option(label, c.id));
    if (selExtr) selExtr.appendChild(new Option(c.nome, c.id));
    if (selLista) selLista.appendChild(new Option(c.nome, c.id));
  });

  // ✔ Categorias no modal
  if (selModalCat) {
    selModalCat.innerHTML = '';
    selModalCat.appendChild(new Option('Sem categoria', ''));
    (STATE.categorias || []).forEach(cat => {
      selModalCat.appendChild(new Option(cat.nome, cat.id));
    });
  }

  // Defaults
  if (selFilter && (!selFilter.value || selFilter.value.trim() === ''))
    selFilter.value = 'all';

  if (selExtr && (!selExtr.value || selExtr.value.trim() === ''))
    selExtr.value = 'all';
},
    renderCategorias() {
      const ul = $(IDS.listaCategorias);
      if (!ul) return;
      ul.innerHTML = '';
      (STATE.categorias || []).forEach(cat => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        const span = document.createElement('span'); span.textContent = cat.nome;
        const btn = document.createElement('button'); btn.textContent = 'Excluir';
        btn.addEventListener('click', async () => {
          if (!confirm('Deseja excluir esta categoria?')) return;
          await supabase.from('categorias').delete().eq('id', cat.id);
          // remove referencia em receitas/despesas
          await supabase.from('receitas').update({ categoria_id: null }).eq('categoria_id', cat.id);
          await supabase.from('despesas').update({ categoria_id: null }).eq('categoria_id', cat.id);
          await App.reloadAll();
        });
        li.appendChild(span); li.appendChild(btn); ul.appendChild(li);
      });
    },

    // renders the lists of receipts and expenses in the lanc screen
    renderLancamentos({ receitas, despesas }) {
      const ulR = $(IDS.listReceitas); const ulD = $(IDS.listDespesas);
      if (ulR) ulR.innerHTML = '';
      if (ulD) ulD.innerHTML = '';

      let totalR = 0, totalD = 0;

      (receitas || []).forEach(r => {
        totalR += Number(r.valor || 0);
        if (ulR) ulR.appendChild(UI._createLancItem(r, 'receita'));
      });

      (despesas || []).forEach(d => {
        totalD += Number(d.valor || 0);
        if (ulD) ulD.appendChild(UI._createLancItem(d, 'despesa'));
      });

      const tr = $(IDS.totalReceitas); const td = $(IDS.totalDespesas);
      if (tr) tr.textContent = fmtMoney(totalR);
      if (td) td.textContent = fmtMoney(totalD);
    },

    _createLancItem(item, tipo) {
      const li = document.createElement('li');
      li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.padding = '6px 0';

      const left = document.createElement('div');
      left.textContent = `${fmtDateBR(item.data)} — ${item.descricao} — ${fmtMoney(item.valor)}${item.baixado ? ' (BAIXADO)' : ''}`;

      const right = document.createElement('div');
      right.style.display = 'flex'; right.style.gap = '6px';

      const btnEdit = document.createElement('button'); btnEdit.textContent = 'Editar';
      btnEdit.addEventListener('click', () => UI.openModalEdit(item, tipo));

      const btnDelete = document.createElement('button'); btnDelete.textContent = 'Excluir';
      btnDelete.addEventListener('click', async () => {
        if (!confirm('Excluir lançamento?')) return;
        await LancService.delete(tipo, item.id);
        await App.refreshLancamentos();
      });

      right.appendChild(btnEdit); right.appendChild(btnDelete);

    if (!item.baixado) {
  const btnBaixar = document.createElement('button');
  btnBaixar.textContent = 'Baixar';

  btnBaixar.addEventListener('click', () => abrirModalBaixa(tipo, item));

  right.appendChild(btnBaixar);

} else {
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar Baixa';

  btnCancel.addEventListener('click', async () => {
    if (!confirm('Cancelar baixa?')) return;

    // localizar movimentação vinculada ao lançamento
    const { data: mv } = await supabase
      .from('movimentacoes')
      .select('*')
      .eq('lancamento_id', item.id)
      .maybeSingle();

    if (!mv) {
      alert('Movimentação não encontrada.');
      return;
    }

    await supabase
      .from('movimentacoes')
      .delete()
      .eq('id', mv.id);

    const tabela = tipo === 'receita' ? 'receitas' : 'despesas';

    await supabase
      .from(tabela)
      .update({ baixado: false, data_baixa: null })
      .eq('id', item.id);

    await App.refreshLancamentos();
    await App.renderExtrato();
  });

  right.appendChild(btnCancel);
}


      li.appendChild(left); li.appendChild(right);
      return li;
    },

    // open add modal (clean)
    openAddModal() {
      const modal = $(IDS.modalAdd);
      if (!modal) return;
      // clear fields
      $(IDS.modalTipo).value = 'despesa';
      $(IDS.modalValor).value = '';
      $(IDS.modalDesc).value = '';
      $(IDS.modalData).value = isoToday();
      $(IDS.modalRecorrencia).value = 'none';
      $(IDS.modalParcelas).value = 1;
      // remove edit metadata
      const saveBtn = $(IDS.modalSave); if (saveBtn) { delete saveBtn.dataset.edit; delete saveBtn.dataset.editId; saveBtn.textContent = 'Salvar'; }
      // ensure selects are populated
      UI.populateSelects();
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden','false');
    },

    // open modal to edit
    openModalEdit(item, tipo) {
      const modal = $(IDS.modalAdd); if (!modal) return;
      $(IDS.modalTipo).value = tipo;
      // if description ends with (x/y) we keep it but also allow edit: strip suffix for base
      $(IDS.modalDesc).value = (item.descricao || '').replace(/\s\(\d+\/\d+\)$/, '');
      $(IDS.modalValor).value = item.valor || '';
      $(IDS.modalData).value = item.data || isoToday();
      $(IDS.modalConta).value = item.conta_id || 'all';
      $(IDS.modalCategoria).value = item.categoria_id || '';
      // mark save button as editing
      const saveBtn = $(IDS.modalSave); if (saveBtn) { saveBtn.dataset.edit = 'true'; saveBtn.dataset.editId = item.id; saveBtn.textContent = 'Salvar alteração'; }
      UI.populateSelects();
      modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    },

    closeAddModal() {
      const modal = $(IDS.modalAdd); if (!modal) return;
      modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
      const saveBtn = $(IDS.modalSave); if (saveBtn) { delete saveBtn.dataset.edit; delete saveBtn.dataset.editId; saveBtn.textContent = 'Salvar'; }
    },

    async handleSaveModal() {
      // called when user clicks save
      try {
        const tipo = $(IDS.modalTipo).value;
        const descricao = $(IDS.modalDesc).value.trim();
        const valor = Number($(IDS.modalValor).value || 0);
        const data = $(IDS.modalData).value || isoToday();
        const conta_id = $(IDS.modalConta).value || null;
        const categoria_id = $(IDS.modalCategoria).value || null;
        const recorrencia = $(IDS.modalRecorrencia).value;
        const parcelas = Number($(IDS.modalParcelas).value || 1);

        if (!descricao || !valor || !data) return alert('Preencha descrição, valor e data.');

        // edit?
        const saveBtn = $(IDS.modalSave);
        if (saveBtn && saveBtn.dataset.edit === 'true' && saveBtn.dataset.editId) {
          const editId = saveBtn.dataset.editId;
          // update the row (simple patch)
          await LancService.update(tipo, editId, { descricao, valor, data, conta_id: conta_id || null, categoria_id: categoria_id || null });
          UI.closeAddModal();
          await App.refreshLancamentos();
          return;
        }

        // insert: handle parcelamento
        if (recorrencia !== 'none' && parcelas > 1) {
          const base = new Date(data + 'T00:00:00');
          for (let i=1;i<=parcelas;i++) {
            let dt = new Date(base);
            if (i > 1) {
              if (recorrencia === 'monthly') dt.setMonth(dt.getMonth() + (i-1));
              else if (recorrencia === 'fortnight') dt.setDate(dt.getDate() + 15*(i-1));
              else if (recorrencia === 'weekly') dt.setDate(dt.getDate() + 7*(i-1));
              else if (recorrencia === 'annual') dt.setFullYear(dt.getFullYear() + (i-1));
            }
            const dISO = dt.toISOString().slice(0,10);
            let vParc = Number((valor / parcelas).toFixed(2));
            if (i === 1) {
              const soma = Number((vParc * parcelas).toFixed(2));
              const dif = Number((valor - soma).toFixed(2));
              vParc = Number((vParc + dif).toFixed(2));
            }
            await LancService.insert({ tipo, descricao: `${descricao} (${i}/${parcelas})`, valor: vParc, data: dISO, conta_id: conta_id || null, categoria_id: categoria_id || null });
          }
        } else {
          await LancService.insert({ tipo, descricao, valor, data, conta_id: conta_id || null, categoria_id: categoria_id || null });
        }

        UI.closeAddModal();
        await App.refreshLancamentos();
      } catch (e) {
        console.error('handleSaveModal', e);
        alert('Erro ao salvar lançamento. Veja console.');
      }
    },

  /* ============================
     CHARTS
  ============================ */
  async function drawReceitasPorCategoria(inicio, fim) {
    try {
      const { data } = await supabase.from('receitas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
      const groups = {};
      (data || []).forEach(r => {
        const name = STATE.categorias.find(c => c.id === r.categoria_id)?.nome || 'Sem categoria';
        groups[name] = (groups[name] || 0) + Number(r.valor || 0);
      });
      const labels = Object.keys(groups);
      const values = Object.values(groups);
      const ctx = document.getElementById(IDS.chartRecCat);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.recCat) STATE.charts.recCat.destroy(); } catch (e) {}
      STATE.charts.recCat = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Receitas por categoria', data: values }] }, options: { responsive: true } });
    } catch (e) { console.error('drawReceitasPorCategoria', e); }
  }

  async function drawDespesasPorCategoria(inicio, fim) {
    try {
      const { data } = await supabase.from('despesas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
      const groups = {};
      (data || []).forEach(d => {
        const name = STATE.categorias.find(c => c.id === d.categoria_id)?.nome || 'Sem categoria';
        groups[name] = (groups[name] || 0) + Number(d.valor || 0);
      });
      const labels = Object.keys(groups);
      const values = Object.values(groups);
      const ctx = document.getElementById(IDS.chartDesCat);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.desCat) STATE.charts.desCat.destroy(); } catch (e) {}
      STATE.charts.desCat = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Despesas por categoria', data: values }] }, options: { responsive: true } });
    } catch (e) { console.error('drawDespesasPorCategoria', e); }
  }

  async function drawResumo(inicio, fim) {
    try {
      const { data: rec } = await supabase.from('receitas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
      const { data: des } = await supabase.from('despesas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
      const totalR = (rec || []).reduce((s, x) => s + Number(x.valor || 0), 0);
      const totalD = (des || []).reduce((s, x) => s + Number(x.valor || 0), 0);
      safeText($(IDS.dashReceber), fmtMoney(totalR));
      safeText($(IDS.dashPagar), fmtMoney(totalD));
      safeText($(IDS.dashSaldoAtual), fmtMoney(totalR - totalD));
      const ctx = document.getElementById(IDS.chartResumo);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.resumo) STATE.charts.resumo.destroy(); } catch (e) {}
      STATE.charts.resumo = new Chart(ctx, { type: 'bar', data: { labels: ['Receitas','Despesas'], datasets: [{ label: 'Resumo', data: [totalR, totalD] }] }, options: { responsive: true } });
    } catch (e) { console.error('drawResumo', e); }
  }

  /* ============================
     APP CORE
  ============================ */
  const App = {
    async reloadAll() {
      await Promise.all([ CategoriasService.load(), ContasService.load() ]);
      UI.populateSelects();
      UI.renderCategorias();
    },

    async init() {
      UI.attachHandlers();
      await this.reloadAll();
      // show dashboard initially
      this.showScreen('dashboard');

      // setup realtime
      this.subscribeRealtime();

      // initial renderings
      await this.refreshLancamentos();
      const now = new Date(); const ano = now.getFullYear(); const mes = now.getMonth() + 1;
      const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const fim = `${ano}-${String(mes).padStart(2,'0')}-${lastDay}`;
      await drawResumo(inicio, fim);
      await drawReceitasPorCategoria(inicio, fim);
      await drawDespesasPorCategoria(inicio, fim);
    },

    showScreen(name) {
      document.querySelectorAll(IDS.screens).forEach(s => s.classList.add('hidden'));
      const target = document.querySelector(`[data-screen="${name}"]`);
      if (target) target.classList.remove('hidden');
      $all(IDS.menuBtns).forEach(b => b.classList.toggle('active', b.dataset.target === name));
      if (name === 'lanc') this.refreshLancamentos();
      if (name === 'contas') UI.populateSelects();
    },

    subscribeRealtime() {
      // we create channels per table; store refs on STATE.subs to unsubscribe if needed
      try {
        const chReceitas = supabase.channel('chan_receitas').on('postgres_changes', { event: '*', schema: 'public', table: 'receitas' }, payload => {
          console.debug('realtime receitas', payload);
          this.refreshLancamentos();
        }).subscribe();
        const chDespesas = supabase.channel('chan_despesas').on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, payload => { console.debug('realtime despesas', payload); this.refreshLancamentos(); }).subscribe();
        const chMov = supabase.channel('chan_mov').on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, payload => { console.debug('realtime mov', payload); this.renderExtrato(); }).subscribe();
        const chCats = supabase.channel('chan_cats').on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, payload => { console.debug('realtime categorias', payload); this.reloadCatsContas(); }).subscribe();
        const chContas = supabase.channel('chan_contas').on('postgres_changes', { event: '*', schema: 'public', table: 'contas_bancarias' }, payload => { console.debug('realtime contas', payload); this.reloadCatsContas(); }).subscribe();
        STATE.subs.push(chReceitas, chDespesas, chMov, chCats, chContas);
      } catch (e) { console.warn('subscribeRealtime failed', e); }
    },

    async reloadCatsContas() {
      await Promise.all([ CategoriasService.load(), ContasService.load() ]);
      UI.populateSelects();
    },

    async refreshLancamentos() {
      try {
        const conta_id = $(IDS.selectContas)?.value || 'all';
        const periodo = $(IDS.periodoLanc)?.value || 'mes_atual';
        const now = new Date();
        let inicio, fim;
        if (periodo === 'mes_atual') {
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if (periodo === 'mes_anterior') {
          const ano = now.getFullYear(); const mes = now.getMonth();
          inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const last = new Date(ano, mes, 0).getDate();
          fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
        } else if (periodo === 'ultimos_30') {
          const past = new Date(now.getTime() - 30 * 86400000);
          inicio = past.toISOString().slice(0,10);
          fim = isoToday();
        } else { // personalizado
          inicio = $(IDS.dataInicioLanc).value || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          fim = $(IDS.dataFimLanc).value || isoToday();
        }

        const [r, d] = await Promise.all([
          LancService.fetch('receita', conta_id, inicio, fim),
          LancService.fetch('despesa', conta_id, inicio, fim)
        ]);
        STATE.receitas = r; STATE.despesas = d;
        UI.renderLancamentos({ receitas: r, despesas: d });

        // saldo atual da conta filtro
        if (conta_id && conta_id !== 'all') {
          const { data } = await supabase.from('contas_bancarias').select('saldo_atual').eq('id', conta_id).maybeSingle();
          safeText($(IDS.saldoAtual), fmtMoney(data?.saldo_atual || 0));
        } else safeText($(IDS.saldoAtual), '—');
      } catch (e) {
        console.error('refreshLancamentos', e);
      }
    },

    async renderExtrato() {
      try {
        const conta_id = $(IDS.selectExtrato)?.value || 'all';
        const periodo = $(IDS.periodoExtrato)?.value || 'mes_atual';
        const now = new Date();
        let inicio, fim;
        if (periodo === 'mes_atual') {
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if (periodo === 'ultimos_30') {
          const past = new Date(now.getTime() - 30 * 86400000);
          inicio = past.toISOString().slice(0,10);
          fim = isoToday();
        } else { inicio = $(IDS.dataInicioExtrato).value; fim = $(IDS.dataFimExtrato).value; }

        const movs = await ExtratoService.fetch(conta_id, inicio, fim);
        const tbody = $(IDS.tableExtrato)?.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        let totalCred = 0, totalDeb = 0;
        (movs || []).forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${fmtDateBR(m.data)}</td><td>${m.descricao}</td><td>${m.tipo==='credito'?'Crédito':'Débito'}</td><td>${fmtMoney(m.valor)}</td><td><button class="btn-small">Cancelar Baixa</button></td>`;
          const btn = tr.querySelector('button');
          btn.addEventListener('click', async () => {
            if (!confirm('Cancelar baixa?')) return;
            await MovService.delete(m.id);
            const tabela = m.tipo === 'credito' ? 'receitas' : 'despesas';
            await supabase.from(tabela).update({ baixado: false, data_baixa: null }).eq('id', m.lancamento_id);
            await App.refreshLancamentos();
            await App.renderExtrato();
          });
          tbody.appendChild(tr);
          if (m.tipo === 'credito') totalCred += Number(m.valor || 0); else totalDeb += Number(m.valor || 0);
        });
        safeText($(IDS.totalReceitasExtrato), fmtMoney(totalCred));
        safeText($(IDS.totalDespesasExtrato), fmtMoney(totalDeb));
        safeText($(IDS.saldoPeriodoExtrato), fmtMoney(totalCred - totalDeb));
        // saldo atual da conta no extrato
        if (conta_id && conta_id !== 'all') {
          const { data } = await supabase.from('contas_bancarias').select('saldo_atual').eq('id', conta_id).maybeSingle();
          safeText($(IDS.saldoAtualContaExtrato), fmtMoney(data?.saldo_atual || 0));
        } else safeText($(IDS.saldoAtualContaExtrato), '—');
      } catch (e) { console.error('renderExtrato', e); }
    },

    async loadDashboard() {
      const now = new Date(); const ano = now.getFullYear(); const mes = now.getMonth() + 1;
      const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const last = new Date(ano, mes, 0).getDate();
      const fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
      await drawResumo(inicio, fim);
      await drawReceitasPorCategoria(inicio, fim);
      await drawDespesasPorCategoria(inicio, fim);
    }
  };

  /* ============================
     BOOTSTRAP / START
  ============================ */
  (async function bootstrap() {
    try {
      await requireSessionOrRedirect(); // redirects if no session

      // attach UI handlers
      UI.attachHandlers();

      // initial load
      await Promise.all([ CategoriasService.load(), ContasService.load() ]);
      UI.populateSelects();
      UI.renderCategorias();

      // start application logic (renders, realtime)
      await App.init();

      console.log('app.js carregado — ambiente pronto');
    } catch (e) {
      console.error('bootstrap error', e);
    }
  })();

})();
