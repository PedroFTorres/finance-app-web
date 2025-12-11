/* app.js — Versão profissional final (compatível com HTML novo)
   - Navegação: data-target on buttons, data-screen on sections
   - Compatível com suas tabelas Supabase (contas_bancarias, categorias, receitas, despesas, movimentacoes)
   - Mantém parcelamento: cria registros (desc (i/n)) em despesas/receitas
   - Realtime subscriptions para manter UI atualizada
   - Compatível com Chart.js se estiver incluído no HTML
*/

(() => {
  'use strict';

  /* ============================
     CONFIGURAÇÃO / ESTADO GLOBAL
     ============================ */
  const STATE = {
    user: null,
    contas: [],
    categorias: [],
    receitas: [],
    despesas: [],
    movimentacoes: [],
    charts: {},
  };

  // IDs / seletors usados no HTML. Se você alterou algum id no HTML, atualize aqui.
  const SEL = {
    userEmail: 'user-email',
    logoutBtn: 'btn-logout',
    menus: '.menu-btn', // buttons with data-target
    screens: '[data-screen]', // sections
    // telas-chave
    telaDashboard: '[data-screen="dashboard"]',
    telaContas: '[data-screen="contas"]',
    telaLanc: '[data-screen="lanc"]',
    // lançamentos (tela)
    selectContas: 'select-contas',
    periodoLanc: 'periodo-lanc',
    dataInicioLanc: 'data-inicio-lanc',
    dataFimLanc: 'data-fim-lanc',
    btnFiltrarLanc: 'btn-filtrar-lanc',
    listReceitas: 'list-receitas',
    listDespesas: 'list-despesas',
    totalReceitas: 'total-receitas',
    totalDespesas: 'total-despesas',
    saldoAtual: 'saldo-atual',
    // extrato
    selectExtrato: 'select-contas-extrato',
    periodoExtrato: 'periodo-extrato',
    dataInicioExtrato: 'data-inicio',
    dataFimExtrato: 'data-fim',
    btnFiltrarExtrato: 'btn-filtrar-extrato',
    tableExtrato: 'table-extrato',
    // contas
    btnAddConta: 'btn-add-conta',
    contaNome: 'conta-nome',
    contaSaldo: 'conta-saldo',
    contaDataSaldo: 'conta-data-saldo',
    // lançamentos formulário
    btnAddLanc: 'btn-add-lanc',
    btnCancelEdit: 'btn-cancel-edit',
    tipoLanc: 'tipo-lancamento',
    valorLanc: 'valor-lanc',
    descLanc: 'desc-lanc',
    dataLanc: 'data-lanc',
    categoriaLanc: 'categoria-lanc',
    selectContaLanc: 'select-conta-lanc',
    recorrenciaTipo: 'recorrencia-tipo',
    recorrenciaParcelas: 'recorrencia-parcelas'
  };

  /* ============================
     HELPERS
     ============================ */
  const $ = id => document.getElementById(id);
  const $all = sel => Array.from(document.querySelectorAll(sel));

  function formatReal(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function isoToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDatePt(d) {
    if (!d) return '';
    const x = new Date(d + 'T00:00:00');
    return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`;
  }

  function uuid() { return crypto.randomUUID(); }

  function showToast(msg, type = 'info') {
    console.log('[toast]', type, msg);
    const cont = document.getElementById('toast-container');
    if (!cont) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ============================
     AUTH
     ============================ */
  async function ensureSession() {
    try {
      const res = await supabase.auth.getSession();
      if (!res?.data?.session) return false;
      STATE.user = res.data.session.user;
      const el = $(SEL.userEmail);
      if (el) el.textContent = STATE.user.email;
      return true;
    } catch (e) {
      console.error('ensureSession', e);
      return false;
    }
  }

  /* ============================
     CONTAS
     ============================ */
  const Contas = {
    async load() {
      try {
        const { data, error } = await supabase.from('contas_bancarias').select('*').eq('user_id', STATE.user.id).order('nome');
        if (error) throw error;
        STATE.contas = data || [];
        return STATE.contas;
      } catch (e) { console.error('Contas.load', e); return []; }
    },
    async create({ nome, saldo, data_saldo }) {
      try {
        const item = { id: uuid(), nome, saldo_inicial: Number(saldo||0), saldo_atual: Number(saldo||0), data_saldo, user_id: STATE.user.id };
        const { error } = await supabase.from('contas_bancarias').insert([item]);
        if (error) throw error;
        await this.load();
        return item;
      } catch (e) { console.error('Contas.create', e); throw e; }
    },
    async recalc(conta_id) {
      if (!conta_id || conta_id === 'all') return null;
      try {
        const { data: conta } = await supabase.from('contas_bancarias').select('saldo_inicial').eq('id', conta_id).maybeSingle();
        const si = Number(conta?.saldo_inicial || 0);
        const { data: movs } = await supabase.from('movimentacoes').select('tipo,valor').eq('conta_id', conta_id);
        let cred = 0, deb = 0;
        (movs||[]).forEach(m => { if (m.tipo === 'credito') cred += Number(m.valor||0); else deb += Number(m.valor||0); });
        const saldo = si + cred - deb;
        await supabase.from('contas_bancarias').update({ saldo_atual: saldo }).eq('id', conta_id);
        // atualizar cache local
        const idx = STATE.contas.findIndex(c => c.id === conta_id);
        if (idx >= 0) STATE.contas[idx].saldo_atual = saldo;
        return saldo;
      } catch (e) { console.error('Contas.recalc', e); return null; }
    }
  };

  /* ============================
     CATEGORIAS
     ============================ */
  const Categorias = {
    async load() {
      try {
        const { data } = await supabase.from('categorias').select('*').order('nome');
        STATE.categorias = data || [];
        return STATE.categorias;
      } catch (e) { console.error('Categorias.load', e); return []; }
    },
    async getOrCreate(nome) {
      try {
        const { data } = await supabase.from('categorias').select('*').eq('nome', nome).maybeSingle();
        if (data) return data.id;
        const created = await supabase.from('categorias').insert([{ id: uuid(), nome }]).select().maybeSingle();
        return created?.data?.id || created?.id || null;
      } catch (e) { console.error('Categorias.getOrCreate', e); return null; }
    }
  };

  /* ============================
     LANCAMENTOS (receitas/despesas)
     ============================ */
  const Lancamentos = {
    // fetch com filtro de conta opcional
    async fetch({ tipo, conta_id = 'all', inicio, fim }) {
      const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
      try {
        let q = supabase.from(tabela).select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: true });
        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('Lancamentos.fetch', e); return []; }
    },

    async insert({ tipo, descricao, valor, data, conta_id, categoria_id }) {
      const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
      try {
        const item = { id: uuid(), user_id: STATE.user.id, descricao, valor: Number(valor), data, conta_id: conta_id || null, categoria_id: categoria_id || null, baixado: false };
        const { error } = await supabase.from(tabela).insert([item]);
        if (error) throw error;
        return item;
      } catch (e) { console.error('Lancamentos.insert', e); throw e; }
    },

    async delete({ tipo, id }) {
      const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
      try {
        await supabase.from(tabela).delete().eq('id', id);
      } catch (e) { console.error('Lancamentos.delete', e); throw e; }
    }
  };

  /* ============================
     EXTRATO
     ============================ */
  const Extrato = {
    async fetch({ conta_id = 'all', inicio, fim }) {
      try {
        let q = supabase.from('movimentacoes').select('*').gte('data', inicio).lte('data', fim).order('data', { ascending: true });
        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('Extrato.fetch', e); return []; }
    }
  };

  /* ============================
     UI RENDER
     ============================ */
  const UI = {
    init() {
      // Navegação moderna: buttons com data-target
      $all(SEL.menus).forEach(b => {
        b.addEventListener('click', (ev) => {
          const target = b.dataset.target;
          if (!target) return;
          App.showScreen(target);
        });
      });

      // Periodo lanc change
      const periodoLanc = $(SEL.periodoLanc);
      if (periodoLanc) periodoLanc.addEventListener('change', () => {
        if (periodoLanc.value === 'personalizado') {
          $(SEL.dataInicioLanc).classList.remove('hidden');
          $(SEL.dataFimLanc).classList.remove('hidden');
        } else {
          $(SEL.dataInicioLanc).classList.add('hidden');
          $(SEL.dataFimLanc).classList.add('hidden');
        }
      });

      // Periodo extrato change
      const periodoExt = $(SEL.periodoExtrato);
      if (periodoExt) periodoExt.addEventListener('change', () => {
        if (periodoExt.value === 'personalizado') {
          $(SEL.dataInicioExtrato).classList.remove('hidden');
          $(SEL.dataFimExtrato).classList.remove('hidden');
        } else {
          $(SEL.dataInicioExtrato).classList.add('hidden');
          $(SEL.dataFimExtrato).classList.add('hidden');
        }
      });

      // filtro lanc
      const btnFiltrar = $(SEL.btnFiltrarLanc);
      if (btnFiltrar) btnFiltrar.addEventListener('click', (ev) => { ev?.preventDefault(); App.refreshLancamentos(); });

      // filtro extrato
      const btnFilExtr = $(SEL.btnFiltrarExtrato);
      if (btnFilExtr) btnFilExtr.addEventListener('click', (ev) => { ev?.preventDefault(); App.renderExtrato(); });

      // criar conta
      const btnAddConta = $(SEL.btnAddConta);
      if (btnAddConta) btnAddConta.addEventListener('click', async () => {
        const nome = $(SEL.contaNome).value.trim();
        const saldo = Number($(SEL.contaSaldo).value || 0);
        const data_saldo = $(SEL.contaDataSaldo).value;
        if (!nome || !data_saldo) return alert('Informe nome e data do saldo.');
        await Contas.create({ nome, saldo, data_saldo });
        await App.populateContasSelects();
        showToast('Conta criada', 'success');
      });

      // adicionar lançamento (form)
      const btnAddLanc = $(SEL.btnAddLanc);
      if (btnAddLanc) btnAddLanc.addEventListener('click', async () => {
        try {
          const tipo = $(SEL.tipoLanc).value;
          const descricao = $(SEL.descLanc).value.trim();
          const valor = Number($(SEL.valorLanc).value || 0);
          const data = $(SEL.dataLanc).value;
          const conta_id = $(SEL.selectContaLanc).value;
          const categoria_id = $(SEL.categoriaLanc).value;
          const recorrenciaTipo = $(SEL.recorrenciaTipo) ? $(SEL.recorrenciaTipo).value : 'none';
          const parcelas = Number($(SEL.recorrenciaParcelas) ? $(SEL.recorrenciaParcelas).value || 1 : 1);

          if (!descricao || !valor || !data) return alert('Preencha todos os campos do lançamento.');

          // edição (se botão 'Salvar' mudou para salvar)
          const btnCancel = $(SEL.btnCancelEdit);
          const isEdit = btnAddLanc.dataset.editing === 'true';
          if (isEdit) {
            // salvar edição simplificada (aplica a edição ao item com id salvo no dataset)
            const editId = btnAddLanc.dataset.editId;
            if (!editId) return;
            const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
            await supabase.from(tabela).update({ descricao, valor, data, conta_id: conta_id || null, categoria_id: categoria_id || null }).eq('id', editId);
            btnAddLanc.textContent = 'Adicionar';
            btnAddLanc.dataset.editing = 'false';
            delete btnAddLanc.dataset.editId;
            if (btnCancel) btnCancel.classList.add('hidden');
            await App.refreshLancamentos();
            return;
          }

          // recorrência/parcelamento: criar múltiplos registros
          if (recorrenciaTipo !== 'none' && parcelas > 1) {
            // calcular datas das parcelas
            let base = new Date(data + 'T00:00:00');
            for (let i = 1; i <= parcelas; i++) {
              let parcelaDate = new Date(base);
              // ajustar segundo tipo
              if (i > 1) {
                if (recorrenciaTipo === 'monthly') parcelaDate.setMonth(parcelaDate.getMonth() + (i - 1));
                else if (recorrenciaTipo === 'fortnight') parcelaDate.setDate(parcelaDate.getDate() + 15 * (i - 1));
                else if (recorrenciaTipo === 'weekly') parcelaDate.setDate(parcelaDate.getDate() + 7 * (i - 1));
                else if (recorrenciaTipo === 'annual') parcelaDate.setFullYear(parcelaDate.getFullYear() + (i - 1));
              }
              const parcelaDataISO = parcelaDate.toISOString().slice(0, 10);
              const descParcela = `${descricao} (${i}/${parcelas})`;
              // ajuste de centavos: aplicamos centavos na primeira parcela
              let valorParcela = Number((valor / parcelas).toFixed(2));
              if (i === 1) {
                const somaBase = Number((valorParcela * parcelas).toFixed(2));
                const diferenca = Number((valor - somaBase).toFixed(2));
                valorParcela = Number((valorParcela + diferenca).toFixed(2));
              }
              await Lancamentos.insert({ tipo, descricao: descParcela, valor: valorParcela, data: parcelaDataISO, conta_id, categoria_id });
            }
            // limpar form
            $(SEL.descLanc).value = ''; $(SEL.valorLanc).value = ''; $(SEL.dataLanc).value = '';
            $(SEL.recorrenciaParcelas).value = 1;
            showToast('Lançamentos parcelados criados', 'success');
            await App.refreshLancamentos();
            return;
          }

          // lançamento simples
          await Lancamentos.insert({ tipo, descricao, valor, data, conta_id, categoria_id });
          $(SEL.descLanc).value = ''; $(SEL.valorLanc).value = ''; $(SEL.dataLanc).value = '';
          showToast('Lançamento adicionado', 'success');
          await App.refreshLancamentos();
        } catch (err) {
          console.error('Erro ao adicionar lançamento', err);
          showToast('Erro ao adicionar lançamento', 'error');
        }
      });

      // cancelar edição
      const btnCancelEdit = $(SEL.btnCancelEdit);
      if (btnCancelEdit) btnCancelEdit.addEventListener('click', async () => {
        // limpar formulário
        $(SEL.descLanc).value = ''; $(SEL.valorLanc).value = ''; $(SEL.dataLanc).value = '';
        const b = $(SEL.btnAddLanc); if (b) { b.textContent = 'Adicionar'; b.dataset.editing = 'false'; delete b.dataset.editId; }
        btnCancelEdit.classList.add('hidden');
      });

    },

    async populateContasSelects() {
      // select-contas (lanc), select-contas-extrato, select-conta-lanc
      const sel = $(SEL.selectContas);
      const selExtr = $(SEL.selectExtrato);
      const selContaLanc = $(SEL.selectContaLanc);

      [sel, selExtr, selContaLanc].forEach(s => { if (s) s.innerHTML = ''; });

      const createAll = s => s && s.appendChild(new Option('Todas as Contas', 'all'));
      createAll(sel); createAll(selExtr); createAll(selContaLanc);

      (STATE.contas || []).forEach(c => {
        if (sel) sel.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual ?? c.saldo_inicial)})`, c.id));
        if (selExtr) selExtr.appendChild(new Option(c.nome, c.id));
        if (selContaLanc) selContaLanc.appendChild(new Option(c.nome, c.id));
      });

      if (sel && (!sel.value || sel.value.trim()==='')) sel.value = 'all';
      if (selExtr && (!selExtr.value || selExtr.value.trim()==='')) selExtr.value = 'all';
      if (selContaLanc && (!selContaLanc.value || selContaLanc.value.trim()==='')) selContaLanc.value = 'all';
    },

    renderLancamentos({ receitas, despesas }) {
      const listR = $(SEL.listReceitas); const listD = $(SEL.listDespesas);
      if (listR) listR.innerHTML = ''; if (listD) listD.innerHTML = '';

      let tr = 0, td = 0;

      (receitas || []).forEach(r => {
        tr += Number(r.valor || 0);
        if (listR) listR.appendChild(UI._buildLancItem(r, 'receita'));
      });

      (despesas || []).forEach(d => {
        td += Number(d.valor || 0);
        if (listD) listD.appendChild(UI._buildLancItem(d, 'despesa'));
      });

      if ($(SEL.totalReceitas)) $(SEL.totalReceitas).textContent = formatReal(tr);
      if ($(SEL.totalDespesas)) $(SEL.totalDespesas).textContent = formatReal(td);
    },

    _buildLancItem(item, tipo) {
      const li = document.createElement('li');
      li.style.display = 'flex'; li.style.justifyContent = 'space-between';
      const left = document.createElement('div');
      left.textContent = `${formatDatePt(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;
      if (item.baixado) left.textContent += ' — (BAIXADO)';
      const right = document.createElement('div');

      const btnEdit = document.createElement('button'); btnEdit.textContent = 'Editar';
      btnEdit.onclick = () => startEdit(tipo, item);
      const btnDel = document.createElement('button'); btnDel.textContent = 'Excluir';
      btnDel.onclick = async () => { if (confirm('Excluir este lançamento?')) { await Lancamentos.delete({ tipo, id: item.id }); await App.refreshLancamentos(); } };

      right.appendChild(btnEdit); right.appendChild(btnDel);

      if (!item.baixado) {
        const btnBaixar = document.createElement('button'); btnBaixar.textContent = 'Baixar';
        btnBaixar.onclick = () => baixarLancamento({ tipo, item });
        right.appendChild(btnBaixar);
      } else {
        const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancelar Baixa';
        btnCancel.onclick = async () => {
          // buscar movimentação vinculada
          const { data: mv } = await supabase.from('movimentacoes').select('*').eq('lancamento_id', item.id).maybeSingle();
          if (!mv) return showToast('Movimentação não encontrada', 'error');
          await cancelarBaixaMovimentacao(mv);
        };
        right.appendChild(btnCancel);
      }

      li.appendChild(left); li.appendChild(right);
      return li;
    }
  };

  /* ============================
     AÇÕES: Baixar / Cancelar Baixa
     ============================ */
  async function baixarLancamento({ tipo, item }) {
    // uso modal se existir, caso contrário simplificar: pedir conta e efetuar baixa
    try {
      const modal = document.getElementById('modal-baixa');
      if (!modal) {
        // execução simplificada: escolher conta via prompt (menos ideal)
        const contaId = $(SEL.selectContaLanc) ? $(SEL.selectContaLanc).value : null;
        if (!contaId || contaId === 'all') return alert('Selecione a conta para efetuar baixa.');
        const dataBaixa = isoToday();
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        // marcar baixado
        await supabase.from(tabela).update({ baixado: true, data_baixa: dataBaixa, conta_id: contaId }).eq('id', item.id);
        // criar movimentacao
        await supabase.from('movimentacoes').insert([{
          id: uuid(), user_id: STATE.user.id, conta_id: contaId, tipo: tipo === 'receita' ? 'credito' : 'debito',
          valor: item.valor, descricao: item.descricao, data: dataBaixa, lancamento_id: item.id
        }]);
        await Contas.recalc(contaId);
        await App.refreshLancamentos();
        await App.renderExtrato();
        showToast('Lançamento baixado', 'success');
        return;
      }

      // se houver modal, preencher select de contas do modal e abrir (assumindo HTML do modal já presente)
      // Implementação deixada para modal se existir no layout (manter compatibilidade).
      modal.classList.remove('hidden');
    } catch (e) {
      console.error('baixarLancamento', e); showToast('Erro ao baixar lançamento', 'error');
    }
  }

  async function cancelarBaixaMovimentacao(mov) {
    if (!confirm('Deseja cancelar esta baixa?')) return;
    try {
      const { data: conta } = await supabase.from('contas_bancarias').select('*').eq('id', mov.conta_id).maybeSingle();
      let novoSaldo = Number(conta?.saldo_atual || 0);
      if (mov.tipo === 'credito') novoSaldo -= Number(mov.valor || 0); else novoSaldo += Number(mov.valor || 0);
      await supabase.from('contas_bancarias').update({ saldo_atual: novoSaldo }).eq('id', mov.conta_id);
      await supabase.from('movimentacoes').delete().eq('id', mov.id);
      await supabase.from('receitas').update({ baixado: false, data_baixa: null }).eq('id', mov.lancamento_id);
      await supabase.from('despesas').update({ baixado: false, data_baixa: null }).eq('id', mov.lancamento_id);
      await Contas.recalc(mov.conta_id);
      await App.refreshLancamentos();
      await App.renderExtrato();
      showToast('Baixa cancelada', 'success');
    } catch (e) {
      console.error('cancelarBaixaMovimentacao', e); showToast('Erro ao cancelar baixa', 'error');
    }
  }

  /* ============================
     EDIT MODE
     ============================ */
  function startEdit(tipo, item) {
    // preencher formulário com dados do item e marcar botão em modo edição
    $(SEL.tipoLanc).value = tipo === 'receita' ? 'receita' : 'despesa';
    $(SEL.descLanc).value = item.descricao || '';
    $(SEL.valorLanc).value = item.valor || '';
    $(SEL.dataLanc).value = item.data || '';
    $(SEL.selectContaLanc).value = item.conta_id || 'all';
    $(SEL.categoriaLanc).value = item.categoria_id || '';
    const btn = $(SEL.btnAddLanc);
    if (btn) {
      btn.textContent = 'Salvar';
      btn.dataset.editing = 'true';
      btn.dataset.editId = item.id;
    }
    const btnCancel = $(SEL.btnCancelEdit); if (btnCancel) btnCancel.classList.remove('hidden');
  }

  /* ============================
     APP COORDENADOR
     ============================ */
  const App = {
    async init() {
      // requisito: supabase já deve estar carregado
      if (!window.supabase) { console.error('Supabase client não encontrado'); return; }
      const ok = await ensureSession();
      if (!ok) return window.location.href = 'login.html';
      // listeners UI
      UI.init();
      // carregar dados
      await Promise.all([ Categorias.load(), Contas.load() ]);
      await UI.populateContasSelects();
      // show default screen
      this.showScreen('dashboard');
      // iniciar realtime
      this.subscribeRealtime();
      // refresh inicial
      await this.refreshLancamentos();
      // opcional: carregar dashboard
      this.loadDashboard();
    },

    showScreen(screenName) {
      // esconder todas as screens e mostrar a pedida
      const screens = document.querySelectorAll('[data-screen]');
      screens.forEach(s => s.classList.add('hidden'));
      const target = document.querySelector(`[data-screen="${screenName}"]`);
      if (target) target.classList.remove('hidden');

      // ajustar classe active no menu
      $all(SEL.menus).forEach(b => {
        if (b.dataset.target === screenName) b.classList.add('active'); else b.classList.remove('active');
      });

      // quando abrir lançamentos, garantir select-contas com valor
      if (screenName === 'lanc') {
        const sel = $(SEL.selectContas);
        if (sel && (!sel.value || sel.value.trim() === '')) sel.value = 'all';
        // garantir refresh
        this.refreshLancamentos();
      }

      if (screenName === 'contas') {
        // repopular selects para garantir frescor
        UI.populateContasSelects();
      }
    },

    subscribeRealtime() {
      try {
        supabase.channel('rec').on('postgres_changes', { event: '*', schema: 'public', table: 'receitas' }, () => this.refreshLancamentos()).subscribe();
        supabase.channel('des').on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, () => this.refreshLancamentos()).subscribe();
        supabase.channel('mov').on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, () => this.renderExtrato()).subscribe();
        supabase.channel('cats').on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => Categorias.load()).subscribe();
        supabase.channel('contas').on('postgres_changes', { event: '*', schema: 'public', table: 'contas_bancarias' }, () => Contas.load().then(() => UI.populateContasSelects())).subscribe();
      } catch (e) {
        console.warn('Realtime não disponível', e);
      }
    },

    async loadDashboard() {
      try {
        // exemplo de preenchimento de alguns indicadores (se elementos existirem)
        const now = new Date();
        const ano = now.getFullYear(); const mes = now.getMonth() + 1;
        const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
        const last = new Date(ano, mes, 0).getDate();
        const fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;

        const recQ = await supabase.from('receitas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
        const desQ = await supabase.from('despesas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
        const totalR = (recQ.data || []).reduce((s,x)=>s+Number(x.valor||0),0);
        const totalD = (desQ.data || []).reduce((s,x)=>s+Number(x.valor||0),0);

        const elR = document.getElementById('dash-receber'); if (elR) elR.textContent = formatReal(totalR);
        const elD = document.getElementById('dash-pagar'); if (elD) elD.textContent = formatReal(totalD);
        const elSaldo = document.getElementById('dash-saldo-atual'); if (elSaldo) elSaldo.textContent = formatReal(totalR - totalD);

        // gráficos opcionais (se Chart.js presente e canvas no HTML)
        if (window.Chart) {
          // Exemplo simples: destruir se existir
          try { if (STATE.charts.recap) STATE.charts.recap.destroy(); } catch(e){/*ignore*/}

          const ctx = document.getElementById('chart-dashboard');
          if (ctx) {
            STATE.charts.recap = new Chart(ctx, {
              type: 'bar',
              data: { labels: ['Receitas','Despesas'], datasets: [{ label: 'Resumo', data: [totalR, totalD] }] },
              options: { responsive: true }
            });
          }
        }

      } catch (e) { console.error('loadDashboard', e); }
    },

    async refreshLancamentos() {
      try {
        const sel = $(SEL.selectContas); const conta_id = sel ? sel.value || 'all' : 'all';
        // período
        const periodo = $(SEL.periodoLanc); const now = new Date();
        let inicio, fim;
        const p = periodo ? periodo.value : 'mes_atual';
        if (p === 'mes_atual') {
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if (p === 'mes_anterior') {
          const ano = now.getFullYear(); const mes = now.getMonth();
          inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const last = new Date(ano, mes, 0).getDate();
          fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
        } else if (p === 'ultimos_30') {
          const past = new Date(now.getTime() - 30*86400000);
          inicio = past.toISOString().slice(0,10); fim = now.toISOString().slice(0,10);
        } else {
          inicio = $(SEL.dataInicioLanc) ? $(SEL.dataInicioLanc).value : ''; fim = $(SEL.dataFimLanc) ? $(SEL.dataFimLanc).value : '';
        }

        const [receitas, despesas] = await Promise.all([
          Lancamentos.fetch({ tipo: 'receita', conta_id, inicio, fim }),
          Lancamentos.fetch({ tipo: 'despesa', conta_id, inicio, fim })
        ]);

        STATE.receitas = receitas; STATE.despesas = despesas;
        UI.renderLancamentos({ receitas, despesas });

        // saldo atual (se conta única)
        const saldoEl = $(SEL.saldoAtual);
        if (conta_id && conta_id !== 'all') {
          const { data } = await supabase.from('contas_bancarias').select('saldo_atual').eq('id', conta_id).maybeSingle();
          if (saldoEl) saldoEl.textContent = formatReal(data?.saldo_atual || 0);
          await Contas.recalc(conta_id);
        } else { if (saldoEl) saldoEl.textContent = '—'; }

      } catch (e) { console.error('refreshLancamentos', e); }
    },

    async renderExtrato() {
      try {
        const sel = $(SEL.selectExtrato); const conta_id = sel ? sel.value || 'all' : 'all';
        const periodo = $(SEL.periodoExtrato); const now = new Date();
        let inicio, fim;
        const p = periodo ? periodo.value : 'mes_atual';
        if (p === 'mes_atual') {
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if (p === 'mes_anterior') {
          const ano = now.getFullYear(); const mes = now.getMonth();
          inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const last = new Date(ano, mes, 0).getDate();
          fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
        } else if (p === 'ultimos_30') {
          const past = new Date(now.getTime() - 30*86400000);
          inicio = past.toISOString().slice(0,10); fim = now.toISOString().slice(0,10);
        } else {
          inicio = $(SEL.dataInicioExtrato) ? $(SEL.dataInicioExtrato).value : ''; fim = $(SEL.dataFimExtrato) ? $(SEL.dataFimExtrato).value : '';
        }

        const movs = await Extrato.fetch({ conta_id, inicio, fim });

        // preencher tabela
        const table = $(SEL.tableExtrato);
        if (!table) return console.warn('Tabela de extrato não encontrada (table-extrato).');
        const tbody = table.querySelector('tbody'); if (!tbody) return;
        tbody.innerHTML = '';

        // saldo inicial caso exista conta selecionada
        let conta = null;
        if (conta_id && conta_id !== 'all') {
          const res = await supabase.from('contas_bancarias').select('saldo_inicial,data_saldo,saldo_atual').eq('id', conta_id).maybeSingle();
          conta = res?.data || null;
        }

        const linhas = [];
        if (conta && conta.saldo_inicial && conta.data_saldo) {
          linhas.push({ tipo: 'inicial', data: conta.data_saldo, descricao: 'SALDO INICIAL', valor: Number(conta.saldo_inicial) });
        }
        (movs || []).forEach(m => linhas.push({ tipo: 'mov', data: m.data, mov: m, descricao: m.descricao, valor: Number(m.valor) }));
        linhas.sort((a, b) => new Date(a.data) - new Date(b.data));

        let cred = 0, deb = 0;
        linhas.forEach(l => {
          const tr = document.createElement('tr');
          const tdData = document.createElement('td'); tdData.textContent = formatDatePt(l.data);
          const tdDesc = document.createElement('td'); tdDesc.textContent = l.descricao;
          const tdTipo = document.createElement('td'); tdTipo.textContent = l.tipo === 'inicial' ? 'Crédito' : (l.mov.tipo === 'credito' ? 'Crédito' : 'Débito');
          const tdValor = document.createElement('td'); tdValor.textContent = formatReal(l.valor);

          tr.appendChild(tdData); tr.appendChild(tdDesc); tr.appendChild(tdTipo); tr.appendChild(tdValor);
          const tdAcoes = document.createElement('td');
          if (l.tipo === 'mov') {
            const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancelar Baixa';
            btnCancel.onclick = () => cancelarBaixaMovimentacao(l.mov);
            tdAcoes.appendChild(btnCancel);
            if (l.mov.tipo === 'credito') cred += l.valor; else deb += l.valor;
          } else cred += l.valor;

          tr.appendChild(tdAcoes);
          tbody.appendChild(tr);
        });

        const elTotalRec = document.getElementById('total-receitas-extrato'); if (elTotalRec) elTotalRec.textContent = formatReal(cred);
        const elTotalDes = document.getElementById('total-despesas-extrato'); if (elTotalDes) elTotalDes.textContent = formatReal(deb);
        const elSaldoPeriodo = document.getElementById('saldo-periodo-extrato'); if (elSaldoPeriodo) elSaldoPeriodo.textContent = formatReal(cred - deb);
        const elSaldoAtual = document.getElementById('saldo-atual-conta-extrato'); if (elSaldoAtual) elSaldoAtual.textContent = conta ? formatReal(conta.saldo_atual) : '—';

      } catch (e) { console.error('renderExtrato', e); }
    }
  };

  /* ============================
     INICIALIZAÇÃO (BOOTSTRAP)
     ============================ */
  (async function bootstrap() {
    try {
      if (!window.supabase) { console.error('Supabase client não encontrado. Verifique supabase.js'); return; }
      const ok = await ensureSession();
      if (!ok) return window.location.href = 'login.html';

      // carregar categorias e contas
      await Promise.all([ Categorias.load(), Contas.load() ]);
      await UI.populateContasSelects();

      // iniciar app
      await App.init();
      console.log('app.js pronto');

    } catch (e) {
      console.error('Erro no bootstrap', e);
      showToast('Erro ao inicializar app', 'error');
    }
  })();

})();
