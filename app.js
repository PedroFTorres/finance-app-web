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
   
   let IS_SAVING_LANCAMENTO = false;
   let IS_CREATING_CONTA = false;
   let IS_BAIXANDO = false;
   let IS_TRANSFERINDO = false;

  /* ============================ CONFIG & ESTADO GLOBAL ============================ */
   
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
   
  let BAIXA_ATUAL = null;

// ================================ // CONTROLE DE PERÍODO — LANÇAMENTOS // ================================
let modoPeriodoLanc = "mes";   // "mes" | "custom"
let mesLancAtual = new Date();
let LANC_INIT = false;

// ================================ // CONTROLE DE PERÍODO — EXTRATO // ================================
let modoPeriodoExtrato = "mes"; // "mes" | "custom"
let mesExtratoAtual = new Date();

// ================================ // FILTRO DE LANÇAMENTOS // ================================
let FILTRO_LANCAMENTOS = "pendencias";

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

  /* ============================ HELPERS  ============================ */
   
  const $ = id => document.getElementById(id);
  const $all = sel => Array.from(document.querySelectorAll(sel || ''));
  function safeText(el, txt) { if (!el) return; el.textContent = txt; }
  function fmtMoney(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDateBR(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; }
  function isoToday() { return new Date().toISOString().slice(0,10); }
  function uid() { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2,9); }
  function safeGet(elId) { const e = $(elId); return e ? e.value : null; }
 function renderMesLanc() {
  const el = document.getElementById("lanc-mes-label");
  if (!el) return;

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  el.textContent =
    `${meses[mesLancAtual.getMonth()]} ${mesLancAtual.getFullYear()}`;
}
   
function renderMesExtrato() {
  const el = document.getElementById("extrato-mes-label");
  if (!el) return;

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  el.textContent =
    `${meses[mesExtratoAtual.getMonth()]} ${mesExtratoAtual.getFullYear()}`;
}

 // ============================ // SESSION / AUTH + PROFILE // ============================

async function loadUserProfile() {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", STATE.user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar user_profiles", error);
      return null;
    }

    return data;
  } catch (e) {
    console.error("loadUserProfile error", e);
    return null;
  }
}

async function requireSessionOrRedirect() {
  try {
    if (!window.supabase) {
      console.error("Supabase client não encontrado");
      window.location.href = "login.html";
      return false;
    }

    const { data } = await supabase.auth.getSession();

    if (!data || !data.session) {
      window.location.href = "login.html";
      return false;
    }

    // ✅ usuário autenticado
    STATE.user = data.session.user;

    // ✅ carrega perfil (upgrade)
    STATE.profile = await loadUserProfile();

    // fallback de segurança
    if (!STATE.profile) {
      STATE.profile = {
        plan: "free",
        onboarding_completed: false
      };
    }

    // email no topo
    const emailEl = document.getElementById(IDS.userEmail);
    if (emailEl) emailEl.textContent = STATE.user.email;

    return true;
  } catch (e) {
    console.error("requireSessionOrRedirect error", e);
     window.location.href = "login.html";
    return false;
  }
}
  /* ============================ SERVIÇOS (Supabase) ============================ */

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
    const item = {
      id: uid(),
      nome,
      saldo_inicial: Number(saldo_inicial||0),
      saldo_atual: Number(saldo_inicial||0),
      data_saldo,
      user_id: STATE.user.id
    };

    const { error } = await supabase
      .from('contas_bancarias')
      .insert([item]);

    if (error) throw error;

    // 🔹 cria lançamento do saldo inicial no extrato
    if (Number(saldo_inicial) !== 0) {
      await supabase.from('movimentacoes').insert([{
        id: uid(),
        user_id: STATE.user.id,
        conta_id: item.id,
        tipo: 'credito',
        valor: Number(saldo_inicial),
        data: data_saldo,
        descricao: 'Saldo inicial'
      }]);
    }

    await this.load();
    return item;

  } catch (e) {
    console.error('ContasService.create', e);
    throw e;
  }
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
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', STATE.user.id)
        .order('nome');

      if (error) throw error;

      STATE.categorias = data || [];
      return STATE.categorias;

    } catch (e) {
      console.error('CategoriasService.load', e);
      STATE.categorias = [];
      return [];
    }
  },

  async add(nome) {
    try {
      const item = {
        id: uid(),
        nome,
        user_id: STATE.user.id
      };

      const { error } = await supabase
        .from('categorias')   // ✅ TABELA CORRETA
        .insert([item]);

      if (error) throw error;

      await this.load();
      return item;

    } catch (e) {
      console.error('CategoriasService.add', e);
      throw e;
    }
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

  // 🔥 LINHA QUE FALTAVA
  recorrencia_id: t.recorrencia_id || null,

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
        const { error } = await supabase.from('movimentacoes') .delete().eq('id', id).eq('user_id', STATE.user.id); 

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
// ================================
// LANÇAMENTOS — filtro por conta
// ================================
const selContaLanc = $(IDS.selectContas);
if (selContaLanc) {
  selContaLanc.addEventListener('change', () => {
    App.refreshLancamentos();
  });
}
// ================================
// LANÇAMENTOS — MENU LATERAL
// ================================
document.querySelectorAll("[data-lanc-tab]").forEach(btn => {
  btn.addEventListener("click", () => {

    // remove active de todos
    document
      .querySelectorAll("[data-lanc-tab]")
      .forEach(b => b.classList.remove("active"));

    // ativa o clicado
    btn.classList.add("active");

    // atualiza estado global
  FILTRO_LANCAMENTOS = btn.dataset.lancTab;


    // recarrega listas
    App.refreshLancamentos();
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

  if (IS_CREATING_CONTA) return;
  IS_CREATING_CONTA = true;

  const modalLoading = document.getElementById("modal-loading");
  btnAddConta.disabled = true;

  try {
    if (modalLoading) modalLoading.classList.remove("hidden");

    const nome = $(IDS.contaNome).value?.trim();
    const saldo = $(IDS.contaSaldo).value;
    const data_saldo = $(IDS.contaDataSaldo).value;

    if (!nome || !data_saldo) {
      alert('Preencha nome e data do saldo.');
      return;
    }

    await ContasService.create({
      nome,
      saldo_inicial: Number(saldo || 0),
      data_saldo
    });

    alert('Conta criada com sucesso.');

    // limpa campos (feedback visual)
    $(IDS.contaNome).value = '';
    $(IDS.contaSaldo).value = '';
    $(IDS.contaDataSaldo).value = '';

    await App.reloadAll();

  } catch (e) {
    console.error('Erro ao criar conta', e);
    alert('Erro ao criar conta. Veja o console.');

  } finally {
    IS_CREATING_CONTA = false;
    btnAddConta.disabled = false;
    if (modalLoading) modalLoading.classList.add("hidden");
  }
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
   const label = c.nome;
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
  const li = document.createElement("li");
  li.style.display = "flex";
  li.style.justifyContent = "space-between";
  li.style.padding = "6px 0";

  // =========================// TEXTO DO LANÇAMENTO// =========================
      
  const left = document.createElement("div");
  left.textContent =
    `${fmtDateBR(item.data)} — ${item.descricao} — ${fmtMoney(item.valor)}` +
    (item.baixado ? " (BAIXADO)" : "");
      
// ================================// TRANSFERÊNCIA — AÇÃO ESPECIAL// ================================
if (item.transferencia_id) {

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "6px";

  const btnExcluir = document.createElement("button");
  btnExcluir.textContent = "Excluir transferência";
  btnExcluir.classList.add("btn-danger");

  btnExcluir.addEventListener("click", () => {
    excluirTransferencia(item.transferencia_id);
  });

  li.appendChild(left);
  right.appendChild(btnExcluir);
  li.appendChild(right);

  // 🔴 IMPORTANTE: NÃO executa Editar / Baixar
  return li;
}

  // ========================= // AÇÕES (SEM EXCLUIR)// =========================
  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "6px";

  // ✏️ EDITAR
  const btnEdit = document.createElement("button");
  btnEdit.textContent = "Editar";
  btnEdit.classList.add("edit");
  btnEdit.addEventListener("click", () => {
    UI.openModalEdit(item, tipo);
  });
  right.appendChild(btnEdit);

  // =========================// BAIXAR / CANCELAR BAIXA// =========================
  if (!item.baixado) {
    const btnBaixar = document.createElement("button");
    btnBaixar.textContent = "Baixar";
    btnBaixar.classList.add("download");
    btnBaixar.addEventListener("click", () => {
      UI.abrirModalBaixa(tipo, item);
    });
    right.appendChild(btnBaixar);
  } else {
    const btnCancelar = document.createElement("button");
    btnCancelar.textContent = "Cancelar Baixa";
    btnCancelar.addEventListener("click", async () => {
      if (!confirm("Cancelar baixa?")) return;

      const { data: movs } = await supabase
        .from("movimentacoes")
        .select("id")
        .eq("lancamento_id", item.id);

      if (!movs || movs.length === 0) {
        alert("Nenhuma movimentação encontrada.");
        return;
      }

      for (const m of movs) {
        await supabase
          .from("movimentacoes")
          .delete()
          .eq("id", m.id);
      }

      await supabase
        .from(tipo === "receita" ? "receitas" : "despesas")
        .update({
          baixado: false,
          data_baixa: null
        })
        .eq("id", item.id);

      await App.refreshLancamentos();
      await App.renderExtrato();
    });
    right.appendChild(btnCancelar);
  }

  li.appendChild(left);
  li.appendChild(right);
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
  const saveBtn = $(IDS.modalSave);
  if (saveBtn) {
    delete saveBtn.dataset.edit;
    delete saveBtn.dataset.editId;
    saveBtn.textContent = 'Salvar';
  }

  // 🔴 AQUI — ESCONDER BOTÃO EXCLUIR AO CRIAR
  const btnExcluir = document.getElementById("btn-excluir-lancamento");
  if (btnExcluir) btnExcluir.classList.add("hidden");

  // ensure selects are populated
  UI.populateSelects();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
},

abrirModalEscopo(item, tipo) {
  const modal = document.getElementById("modal-escopo-recorrencia");
  if (!modal) {
    alert("Modal de escopo não encontrado no HTML");
    return;
  }

  modal.classList.remove("hidden");

  const btnCancelar = document.getElementById("btn-cancelar-escopo");
  const btnConfirmar = document.getElementById("btn-confirmar-escopo");

  btnCancelar.onclick = () => {
    modal.classList.add("hidden");
  };

  btnConfirmar.onclick = () => {
    const escopo =
      document.querySelector('input[name="escopo-rec"]:checked')?.value || "one";

    modal.classList.add("hidden");

    // salvar escolha no botão Salvar
    const saveBtn = document.getElementById(IDS.modalSave);
    saveBtn.dataset.editScope = escopo;
    saveBtn.dataset.recorrenciaId = item.recorrencia_id;
    saveBtn.dataset.dataBase = item.data;

    // abrir modal normal (SEM escopo)
    UI.openModalEditSemEscopo(item, tipo);
  };
},
abrirModalExcluirRecorrencia(item, tipo) {
  const modal = document.getElementById("modal-excluir-recorrencia");
  if (!modal) return;

  modal.classList.remove("hidden");

  // resetar seleção
  const radios = modal.querySelectorAll('input[name="escopo-del"]');
  radios.forEach(r => r.checked = r.value === 'one');

  const btnCancelar = document.getElementById("btn-cancelar-del");
  const btnConfirmar = document.getElementById("btn-confirmar-del");

  btnCancelar.onclick = () => modal.classList.add("hidden");

  btnConfirmar.onclick = async () => {

    if (item.baixado) {
      alert('Este lançamento já foi baixado e não pode ser excluído.');
      return;
    }

    const escopo =
      document.querySelector('input[name="escopo-del"]:checked')?.value || "one";

    modal.classList.add("hidden");

    const tabela = tipo === "receita" ? "receitas" : "despesas";

    if (escopo === "one") {
      await LancService.delete(tipo, item.id);
    } 
    else if (escopo === "next") {
      await supabase
        .from(tabela)
        .delete()
        .eq("recorrencia_id", item.recorrencia_id)
        .gte("data", item.data);
    } 
    else if (escopo === "all") {
      await supabase
        .from(tabela)
        .delete()
        .eq("recorrencia_id", item.recorrencia_id);
    }

    await App.refreshLancamentos();
  };
},

  // open modal to edit (CORRIGIDO)
openModalEdit(item, tipo) {
  if (item.recorrencia_id) {
    UI.abrirModalEscopo(item, tipo);
    return;
  }

  UI.openModalEditSemEscopo(item, tipo);
},

openModalEditSemEscopo(item, tipo) {
  const modal = $(IDS.modalAdd);
  if (!modal) return;

  // =========================
  // PREENCHER CAMPOS
  // =========================
  $(IDS.modalTipo).value = tipo;

  $(IDS.modalDesc).value =
    (item.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '');

  $(IDS.modalValor).value = item.valor || '';
  $(IDS.modalData).value = item.data || isoToday();

  UI.populateSelects();

  if (item.conta_id) $(IDS.modalConta).value = item.conta_id;
  if (item.categoria_id) $(IDS.modalCategoria).value = item.categoria_id;

  // =========================
  // BOTÃO SALVAR (EDIÇÃO)
  // =========================
  const saveBtn = $(IDS.modalSave);
  saveBtn.dataset.edit = 'true';
  saveBtn.dataset.editId = item.id;
  saveBtn.textContent = 'Salvar alteração';

  // =========================
  // BOTÃO EXCLUIR (🔥 AQUI ESTÁ A CORREÇÃO)
  // =========================
  const btnExcluir = document.getElementById("btn-excluir-lancamento");

  if (btnExcluir) {
    btnExcluir.classList.remove("hidden");

    btnExcluir.onclick = async () => {

      // 🔒 não permite excluir se já baixado
      if (item.baixado) {
        alert("Este lançamento já foi baixado e não pode ser excluído.");
        return;
      }

      // 🔁 recorrente → escolher escopo
      if (item.recorrencia_id) {
        UI.abrirModalExcluirRecorrencia(item, tipo);
        return;
      }

      // ❌ simples
      if (!confirm("Deseja excluir este lançamento?")) return;

      try {
        await LancService.delete(tipo, item.id);
        UI.closeAddModal();
        await App.refreshLancamentos();
        await App.renderExtrato();
      } catch (e) {
        console.error("Erro ao excluir lançamento", e);
        alert("Erro ao excluir lançamento.");
      }
    };
  }

  // =========================// ABRIR MODAL// =========================
   
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
},

    closeAddModal() {
      const modal = $(IDS.modalAdd); if (!modal) return;
      modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
      const saveBtn = $(IDS.modalSave); if (saveBtn) { delete saveBtn.dataset.edit; delete saveBtn.dataset.editId; saveBtn.textContent = 'Salvar'; }
    },
     abrirModalBaixa(tipo, lancamento) {
  BAIXA_ATUAL = { tipo, lancamento };

  document.getElementById("data-baixa").value =
    lancamento.data || new Date().toISOString().slice(0, 10);

  document.getElementById("juros-baixa").value = "";
  document.getElementById("desconto-baixa").value = "";

  const selectConta = document.getElementById("conta-baixa-select");
selectConta.innerHTML = "";

// popular contas
(STATE.contas || []).forEach(c => {
  selectConta.appendChild(new Option(c.nome, c.id));
});

// ✅ selecionar automaticamente a conta do lançamento
if (lancamento.conta_id) {
  selectConta.value = lancamento.conta_id;
}

  const modal = document.getElementById("modal-baixa");
if (!modal) {
  alert("Modal de baixa não encontrado no HTML.");
  return;
}

modal.classList.remove("hidden");
modal.style.display = "flex";
modal.style.position = "fixed";
modal.style.inset = "0";
modal.style.zIndex = "1200";
modal.setAttribute("aria-hidden", "false");

},
     async handleSaveModal() {

  // 🔒 trava contra clique duplo
  if (IS_SAVING_LANCAMENTO) return;
  IS_SAVING_LANCAMENTO = true;

  const saveBtn = document.getElementById(IDS.modalSave); 
  const modalLoading = document.getElementById("modal-loading");

  try {
    // 🔒 UI bloqueada + loading
    if (saveBtn) saveBtn.disabled = true;
    if (modalLoading) modalLoading.classList.remove("hidden");

    const tipo = $(IDS.modalTipo).value;
    const descricao = $(IDS.modalDesc).value.trim();
    const valor = Number($(IDS.modalValor).value || 0);
    const data = $(IDS.modalData).value || isoToday();
    const conta_id = $(IDS.modalConta).value || null;
    const categoria_id = $(IDS.modalCategoria).value || null;
    const recorrencia = $(IDS.modalRecorrencia).value;
    const parcelas = Number($(IDS.modalParcelas).value || 1);

    if (!descricao || !valor || !data) {
      alert('Preencha descrição, valor e data.');
      return;
    }

     // ========================= // UX — aviso se lançamento já foi baixado // =========================
     
let avisoBaixado = false;

if (saveBtn && saveBtn.dataset.edit === 'true' && saveBtn.dataset.editId) {
  const tabelaLanc = tipo === 'receita' ? 'receitas' : 'despesas';

  const { data: lancCheck } = await supabase
    .from(tabelaLanc)
    .select('baixado')
    .eq('id', saveBtn.dataset.editId)
    .maybeSingle();

  avisoBaixado = lancCheck?.baixado === true;
}
// 🔔 UX — mostrar / esconder aviso visual no modal
const avisoBox = document.getElementById("aviso-baixado");

if (avisoBox) {
  if (avisoBaixado) {
    avisoBox.classList.remove("hidden");
  } else {
    avisoBox.classList.add("hidden");
  }
}
   
// ========================= // EDIÇÃO DE LANÇAMENTO // =========================
if (saveBtn && saveBtn.dataset.edit === 'true' && saveBtn.dataset.editId) {

  const editId = saveBtn.dataset.editId;
  const escopo = saveBtn.dataset.editScope || 'one';
  const recorrenciaId = saveBtn.dataset.recorrenciaId;
  const dataBase = saveBtn.dataset.dataBase;

  const tabelaLanc = tipo === "receita" ? "receitas" : "despesas";

  const patchBase = {
    descricao,
    valor,
    conta_id: conta_id || null,
    categoria_id: categoria_id || null
  };

  // 1️⃣ Atualiza lançamento(s)
  if (escopo === 'one' || !recorrenciaId) {
    await supabase
      .from(tabelaLanc)
      .update({ ...patchBase, data })
      .eq('id', editId);

  } else if (escopo === 'next') {
    await supabase
      .from(tabelaLanc)
      .update(patchBase)
      .eq('recorrencia_id', recorrenciaId)
      .gte('data', dataBase);

  } else if (escopo === 'all') {
    await supabase
      .from(tabelaLanc)
      .update(patchBase)
      .eq('recorrencia_id', recorrenciaId);
  }

  // ==================================================// 🔄 SINCRONIZA EXTRATO (SOMENTE SE FOR "ONE")// ==================================================
  if (escopo === 'one') {

    const { data: lancAtual } = await supabase
      .from(tabelaLanc)
      .select('baixado')
      .eq('id', editId)
      .maybeSingle();

    if (lancAtual?.baixado === true) {
      const { data: mov } = await supabase
        .from('movimentacoes')
        .select('*')
        .eq('lancamento_id', editId)
        .maybeSingle();

      if (mov) {
        await supabase
          .from('movimentacoes')
          .update({
            descricao,
            valor,
            data
          })
          .eq('id', mov.id);
      }
    }
  }

  UI.closeAddModal();
  await App.refreshLancamentos();
  await App.renderExtrato();
  return;
}

    // ========================= // RECORRÊNCIA// =========================
     
    if (recorrencia !== 'none' && parcelas > 1) {

      const recorrenciaId = crypto.randomUUID();
      const base = new Date(data + 'T00:00:00');

      for (let i = 1; i <= parcelas; i++) {
        const dt = new Date(base);

        if (i > 1) {
          if (recorrencia === 'monthly') dt.setMonth(dt.getMonth() + (i - 1));
          else if (recorrencia === 'weekly') dt.setDate(dt.getDate() + 7 * (i - 1));
          else if (recorrencia === 'fortnight') dt.setDate(dt.getDate() + 15 * (i - 1));
          else if (recorrencia === 'annual') dt.setFullYear(dt.getFullYear() + (i - 1));
        }

        const dISO = dt.toISOString().slice(0, 10);

        await LancService.insert({
          tipo,
          descricao: `${descricao} (${i}/${parcelas})`,
          valor: Number(valor),
          data: dISO,
          conta_id: conta_id || null,
          categoria_id: categoria_id || null,
          recorrencia_id: recorrenciaId
        });
      }

      UI.closeAddModal();
      await App.refreshLancamentos();
      return;
    }

    // ========================= // LANÇAMENTO SIMPLES // =========================
     
    await LancService.insert({
      tipo,
      descricao,
      valor,
      data,
      conta_id: conta_id || null,
      categoria_id: categoria_id || null
    });

    UI.closeAddModal();
    await App.refreshLancamentos();

  } catch (e) {
    console.error('handleSaveModal', e);
    alert('Erro ao salvar lançamento. Veja console.');

  } finally {
    // 🔓 sempre libera (mesmo com erro ou return)
    IS_SAVING_LANCAMENTO = false;
    if (saveBtn) saveBtn.disabled = false;
    if (modalLoading) modalLoading.classList.add("hidden");
   const avisoBox = document.getElementById("aviso-baixado");
if (avisoBox) avisoBox.classList.add("hidden");

  }
},
  };

  /* ============================ CHARTS ============================ */
   
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
async function transferirEntreContas({
  contaOrigem,
  contaDestino,
  valor,
  data,
  descricao
}) {
  if (!contaOrigem || !contaDestino) {
    alert("Selecione as duas contas.");
    return;
  }

  if (contaOrigem === contaDestino) {
    alert("A conta de origem e destino devem ser diferentes.");
    return;
  }

  if (!valor || valor <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  const transferenciaId = crypto.randomUUID();

  // 1️⃣ Registrar transferência
  await supabase.from("transferencias").insert([{
    id: transferenciaId,
    user_id: STATE.user.id,
    conta_origem: contaOrigem,
    conta_destino: contaDestino,
    valor: valor,
    data: data,
    descricao: descricao
  }]);

  // 2️⃣ Débito na conta origem
  await supabase.from("movimentacoes").insert([{
    id: crypto.randomUUID(),
    user_id: STATE.user.id,
    conta_id: contaOrigem,
    tipo: "debito",
    valor: valor,
    data: data,
    descricao: `Transferência enviada — ${descricao}`,
    transferencia_id: transferenciaId
  }]);

  // 3️⃣ Crédito na conta destino
  await supabase.from("movimentacoes").insert([{
    id: crypto.randomUUID(),
    user_id: STATE.user.id,
    conta_id: contaDestino,
    tipo: "credito",
    valor: valor,
    data: data,
    descricao: `Transferência recebida — ${descricao}`,
    transferencia_id: transferenciaId
  }]);

  // 4️⃣ Atualizar telas
   
await App.reloadAll();
await App.refreshLancamentos();

alert("Transferência realizada com sucesso.");

}
// ================================// EXCLUIR TRANSFERÊNCIA (NOVA) // ================================
async function excluirTransferencia(transferenciaId) {
  if (!confirm("Deseja excluir esta transferência?")) return;

  try {
    // 1️⃣ remove movimentações ligadas
    await supabase
      .from("movimentacoes")
      .delete()
      .eq("transferencia_id", transferenciaId);

    // 2️⃣ remove o registro principal
    await supabase
      .from("transferencias")
      .delete()
      .eq("id", transferenciaId);

    // 3️⃣ atualiza tudo
    await App.reloadAll();
    await App.refreshLancamentos();
    await App.renderExtrato();

    alert("Transferência excluída com sucesso.");

  } catch (err) {
    console.error(err);
    alert("Erro ao excluir transferência.");
  }
}

  /* ============================  APP CORE ============================ */
  const App = {
    async reloadAll() {
      await Promise.all([ CategoriasService.load(), ContasService.load() ]);
      UI.populateSelects();
      UI.renderCategorias();
    },

  async init() {
  // carregar dados base
  await this.reloadAll();
  this.showScreen('dashboard');

  // ================================// TRANSFERÊNCIA — abrir modal // ================================
     
const btnTransferir = document.getElementById("btn-transferir");

if (btnTransferir) {
  btnTransferir.onclick = () => {
    const modal = document.getElementById("modal-transferencia");
    if (!modal) return;

    modal.classList.remove("hidden");

    const selOrigem = document.getElementById("transf-origem");
    const selDestino = document.getElementById("transf-destino");

    selOrigem.innerHTML = "";
    selDestino.innerHTML = "";

    (STATE.contas || []).forEach(c => {
      selOrigem.appendChild(new Option(c.nome, c.id));
      selDestino.appendChild(new Option(c.nome, c.id));
    });

    document.getElementById("transf-valor").value = "";
    document.getElementById("transf-desc").value = "";
    document.getElementById("transf-data").value =
      new Date().toISOString().slice(0, 10);
  };
}

// ================================// TRANSFERÊNCIA — confirmar// ================================
     
const btnConfirmar = document.getElementById("btn-confirmar-transf");

if (btnConfirmar) {
  btnConfirmar.onclick = async () => {

    // 🔒 trava contra clique duplo / lag
    if (IS_TRANSFERINDO) return;
    IS_TRANSFERINDO = true;

    try {
      const contaOrigem = document.getElementById("transf-origem").value;
      const contaDestino = document.getElementById("transf-destino").value;
      const valor = Number(document.getElementById("transf-valor").value);
      const data = document.getElementById("transf-data").value;
      const descricao =
        document.getElementById("transf-desc").value ||
        "Transferência entre contas";

      if (!contaOrigem || !contaDestino) {
        alert("Selecione as contas de origem e destino.");
        return;
      }

      if (contaOrigem === contaDestino) {
        alert("Conta de origem e destino devem ser diferentes.");
        return;
      }

      if (!valor || valor <= 0) {
        alert("Informe um valor válido.");
        return;
      }

      await transferirEntreContas({
        contaOrigem,
        contaDestino,
        valor,
        data,
        descricao
      });

      document
        .getElementById("modal-transferencia")
        .classList.add("hidden");

      alert("Transferência realizada com sucesso!");

    } catch (err) {
      console.error("Erro ao confirmar transferência:", err);
      alert("Erro ao realizar a transferência. Veja o console.");
    } finally {
      // 🔓 libera a trava SEMPRE
      IS_TRANSFERINDO = false;
    }
  };
}

  // ================================
  // REALTIME
  // ================================
  this.subscribeRealtime();

  // ================================
  // RENDERIZAÇÕES INICIAIS
  // ================================
  await this.refreshLancamentos();

  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;

  await drawResumo(inicio, fim);
  await drawReceitasPorCategoria(inicio, fim);
  await drawDespesasPorCategoria(inicio, fim);
},

showScreen(name) {
  // Esconde todas as telas
  document.querySelectorAll(IDS.screens)
    .forEach(s => s.classList.add('hidden'));

  // Mostra a tela solicitada
  const target = document.querySelector(`[data-screen="${name}"]`);
  if (target) target.classList.remove('hidden');

  // Menu ativo
  $all(IDS.menuBtns).forEach(b =>
    b.classList.toggle('active', b.dataset.target === name)
  );

  // =========================/ LANÇAMENTOS — APENAS UI// =========================
  if (name === 'lanc') {
    if (!LANC_INIT) {
      modoPeriodoLanc = "mes";
      mesLancAtual = new Date();
      LANC_INIT = true;
    }

    renderMesLanc(); // 🔥 só atualiza o label
    // ❌ NÃO chama refresh aqui
  }

 // =========================// CONTAS// =========================
if (name === 'contas') {
  UI.populateSelects();

  const selExtr = document.getElementById("select-contas-extrato");

  // 🔥 se não houver valor, seleciona a primeira conta automaticamente
  if (selExtr && !selExtr.value && selExtr.options.length > 0) {
    selExtr.selectedIndex = 0;
  }

  // 🔥 agora renderiza o extrato sem depender de clique
  const tabExtrato = document.getElementById("tab-extrato");

if (selExtr && selExtr.value) {
  modoPeriodoExtrato = "mes";
  renderMesExtrato();
  App.renderExtrato();
}
},
 subscribeRealtime() {
      // we create channels per table; store refs on STATE.subs to unsubscribe if needed
      try {
        const chReceitas = supabase.channel('chan_receitas').on('postgres_changes', { event: '*', schema: 'public', table: 'receitas' }, payload => {
          console.debug('realtime receitas', payload);
          this.refreshLancamentos();
        }).subscribe();
        const chDespesas = supabase.channel('chan_despesas').on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, payload => { console.debug('realtime despesas', payload); this.refreshLancamentos(); }).subscribe();
      const chMov = supabase.channel('chan_mov')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'movimentacoes' },
    payload => {
      console.debug('realtime mov', payload);
      this.refreshLancamentos();
    }
  )
  .subscribe();

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
        let inicio, fim;
         
        if (modoPeriodoLanc === "custom") {
  inicio = document.getElementById("lanc-inicio")?.value;
  fim = document.getElementById("lanc-fim")?.value;

if (!inicio || !fim) {
  alert("Informe a data inicial e final.");
  return;
}
}
 else {
  const ano = mesLancAtual.getFullYear();
  const mes = mesLancAtual.getMonth();
  inicio = new Date(ano, mes, 1).toISOString().slice(0,10);
  fim = new Date(ano, mes + 1, 0).toISOString().slice(0,10);
}
         const [r, d] = await Promise.all([
  LancService.fetch('receita', conta_id, inicio, fim),
  LancService.fetch('despesa', conta_id, inicio, fim)
]);

STATE.receitas = r;
STATE.despesas = d;

// ================================// LANÇAMENTOS — FILTRO POR MENU// ================================
         
const filtrar = (lista, tipo) => {
  return lista.filter(item => {
    switch (FILTRO_LANCAMENTOS) {

      case "receitas":
        return tipo === "receita" && !item.baixado;

      case "despesas":
        return tipo === "despesa" && !item.baixado;

      case "recebidos":
        return tipo === "receita" && item.baixado;

      case "pagos":
        return tipo === "despesa" && item.baixado;

      case "pendencias":
      default:
        return !item.baixado; // 🔥 CORREÇÃO AQUI
    }
  });
};

const receitasFiltradas = filtrar(r, "receita");
const despesasFiltradas = filtrar(d, "despesa");

// ================================// RENDER FINAL// ================================
         
UI.renderLancamentos({
  receitas: receitasFiltradas,
  despesas: despesasFiltradas
});
// ================================ VISIBILIDADE DOS BLOCOS (UX) // ================================

const boxReceitas = document.getElementById("box-receitas");
const boxDespesas = document.getElementById("box-despesas");
const listas = document.querySelector(".listas");

if (boxReceitas && boxDespesas && listas) {

  // RESET GERAL (sempre começa limpo)
  boxReceitas.style.display = "";
  boxDespesas.style.display = "";
  listas.classList.remove("single-column");

  // ================================
  // FILTROS QUE MOSTRAM APENAS UM TIPO
  // ================================

  // Receitas / Recebidos → mostra só receitas
  if (
    FILTRO_LANCAMENTOS === "receitas" ||
    FILTRO_LANCAMENTOS === "recebidos"
  ) {
    boxDespesas.style.display = "none";
    listas.classList.add("single-column");
  }

  // Despesas / Pagos → mostra só despesas
  if (
    FILTRO_LANCAMENTOS === "despesas" ||
    FILTRO_LANCAMENTOS === "pagos"
  ) {
    boxReceitas.style.display = "none";
    listas.classList.add("single-column");
  }

  // Pendências → mostra os dois (layout padrão)
}

// ================================// SALDO DO PERÍODO — SOMENTE BAIXADOS// ================================
         
const totalReceitas = (r || [])
  .filter(i => i.baixado === true)
  .reduce((s, i) => s + Number(i.valor || 0), 0);

const totalDespesas = (d || [])
  .filter(i => i.baixado === true)
  .reduce((s, i) => s + Number(i.valor || 0), 0);

const saldoPeriodo = totalReceitas - totalDespesas;

safeText($(IDS.saldoAtual), fmtMoney(saldoPeriodo));


       } catch (e) {
        console.error('refreshLancamentos', e);
      }
    },

async renderExtrato() {
  try {
    const conta_id = document.getElementById("select-contas-extrato")?.value;
    if (!conta_id || conta_id === "all") return;


    // =========================// EXTRATO — DEFINIÇÃO DE DATAS // =========================
let inicio, fim;

if (modoPeriodoExtrato === "custom") {
  inicio = document.getElementById("extrato-inicio")?.value;
  fim = document.getElementById("extrato-fim")?.value;

  if (!inicio || !fim) {
    alert("Informe a data inicial e final.");
    return;
  }
} else {
  const ano = mesExtratoAtual.getFullYear();
  const mes = mesExtratoAtual.getMonth();

  inicio = new Date(ano, mes, 1).toISOString().slice(0, 10);
  fim = new Date(ano, mes + 1, 0).toISOString().slice(0, 10);
}


    // =========================// SALDO ANTES DO PERÍODO // =========================
    let qAntes = supabase
      .from("movimentacoes")
      .select("tipo,valor")
      .eq("conta_id", conta_id);

    if (inicio) qAntes = qAntes.lt("data", inicio);

    const { data: movsAntes } = await qAntes;

    let saldo = 0;
    (movsAntes || []).forEach(m => {
      saldo += m.tipo === "credito"
        ? Number(m.valor)
        : -Number(m.valor);
    });

    // =========================// MOVIMENTAÇÕES DO PERÍODO// =========================
     
    let qPeriodo = supabase
      .from("movimentacoes")
      .select("*")
      .eq("conta_id", conta_id)
      .order("data", { ascending: true });

    if (inicio) qPeriodo = qPeriodo.gte("data", inicio);
    if (fim) qPeriodo = qPeriodo.lte("data", fim);

    const { data: movsPeriodo, error } = await qPeriodo;
    if (error) {
      console.error("Erro extrato:", error);
      return;
    }

    // =========================// RENDER // =========================
     
    const tbody = document.querySelector("#table-extrato tbody");
    tbody.innerHTML = "";

    let totalCred = 0;
    let totalDeb = 0;

   (movsPeriodo || []).forEach(m => {
  if (m.tipo === "credito") {
    saldo += Number(m.valor);
    totalCred += Number(m.valor);
  } else {
    saldo -= Number(m.valor);
    totalDeb += Number(m.valor);
  }

  const tr = document.createElement("tr");

  const tdAcoes = document.createElement("td");

  // 🔥 AÇÃO EXCLUSIVA PARA TRANSFERÊNCIA
  if (m.transferencia_id) {
    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "Excluir";
    btnExcluir.classList.add("btn-danger");

    btnExcluir.onclick = () => {
      excluirTransferencia(m.transferencia_id);
    };

    tdAcoes.appendChild(btnExcluir);
  }

  tr.innerHTML = `
    <td>${new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
    <td>${m.descricao}</td>
    <td class="${m.tipo === "credito" ? "extrato-credito" : "extrato-debito"}">
      ${m.tipo === "credito" ? "Crédito" : "Débito"}
    </td>
    <td class="${m.tipo === "credito" ? "extrato-credito" : "extrato-debito"}">
      ${Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
    </td>
    <td class="${saldo >= 0 ? "extrato-saldo-positivo" : "extrato-saldo-negativo"}">
      ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
    </td>
  `;

  tr.appendChild(tdAcoes);
  tbody.appendChild(tr);
});

    document.getElementById("total-receitas-extrato").textContent =
      totalCred.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    document.getElementById("total-despesas-extrato").textContent =
      totalDeb.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    document.getElementById("saldo-periodo-extrato").textContent =
      (totalCred - totalDeb).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

    document.getElementById("saldo-atual-conta-extrato").textContent =
      saldo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

  } catch (e) {
    console.error("renderExtrato", e);
  }
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
   // =========================// await supabase.from("movimentacoes").insert([{// =========================
   
document.getElementById("confirmar-baixa")?.addEventListener("click", async () => {
  // 🔒 trava clique duplo
  if (IS_BAIXANDO) return;
  IS_BAIXANDO = true;

  try {
    if (!BAIXA_ATUAL) {
      alert("Nenhum lançamento selecionado para baixa.");
      return;
    }

    const { tipo, lancamento } = BAIXA_ATUAL;

    const dataBaixa = document.getElementById("data-baixa").value;
    const juros = Number(document.getElementById("juros-baixa").value || 0);
    const desconto = Number(document.getElementById("desconto-baixa").value || 0);
    const contaId = document.getElementById("conta-baixa-select").value;

    if (!dataBaixa || !contaId) {
      alert("Informe a data e a conta.");
      return;
    }

    const valorOriginal = Number(lancamento.valor);
    const valorFinal = valorOriginal + juros - desconto;
     // 🔒 bloqueia baixa duplicada no banco
const { data: jaBaixado } = await supabase
  .from("movimentacoes")
  .select("id")
  .eq("lancamento_id", lancamento.id)
  .limit(1);

if (jaBaixado && jaBaixado.length > 0) {
  alert("Este lançamento já foi baixado.");
  return;
}

    // 🔹 cria movimentação (extrato)
const { error: insertErr } = await supabase
  .from("movimentacoes")
  .insert([{
    id: crypto.randomUUID(),
    user_id: STATE.user.id,
    conta_id: contaId,
    tipo: tipo === "receita" ? "credito" : "debito",
    valor: valorFinal,
    descricao:
      lancamento.descricao +
      (juros ? ` (+Juros ${fmtMoney(juros)})` : "") +
      (desconto ? ` (-Desc ${fmtMoney(desconto)})` : ""),
    data: dataBaixa,
    lancamento_id: lancamento.id
  }]);

// 🔒 trata erro de duplicidade do UNIQUE no banco
if (insertErr) {
  if (insertErr.code === "23505") {
    alert("Este lançamento já foi baixado.");
    return;
  }
  throw insertErr;
}

    // 🔹 marca lançamento como baixado
    await supabase
      .from(tipo === "receita" ? "receitas" : "despesas")
      .update({
        baixado: true,
        data_baixa: dataBaixa
      })
      .eq("id", lancamento.id);

    // 🔹 fecha modal e limpa estado
    document.getElementById("modal-baixa").classList.add("hidden");
    BAIXA_ATUAL = null;

    // 🔹 atualiza telas
    await App.refreshLancamentos();
    await App.renderExtrato();

  } catch (err) {
    console.error("Erro ao confirmar baixa:", err);
    alert("Erro ao realizar a baixa.");
  } finally {
    // 🔓 libera trava SEMPRE
    IS_BAIXANDO = false;
  }
});

// ================================// LANÇAMENTOS — EVENTOS (DELEGAÇÃO)// ================================
   
document.addEventListener("click", (e) => {

 if (e.target.closest("#lanc-prev")) {
  modoPeriodoLanc = "mes";

  const ano = mesLancAtual.getFullYear();
  const mes = mesLancAtual.getMonth() - 1;

  mesLancAtual = new Date(ano, mes, 1); // 🔥 dia SEMPRE 1

  renderMesLanc();
  App.refreshLancamentos();
  return;
}

if (e.target.closest("#lanc-next")) {
  modoPeriodoLanc = "mes";

  const ano = mesLancAtual.getFullYear();
  const mes = mesLancAtual.getMonth() + 1;

  mesLancAtual = new Date(ano, mes, 1); // 🔥 dia SEMPRE 1

  renderMesLanc();
  App.refreshLancamentos();
  return;
}

  if (e.target.closest("#btn-periodo-custom")) {
    document.getElementById("periodo-custom-box")?.classList.remove("hidden");
    return;
  }

  if (e.target.closest("#cancelar-periodo")) {
    document.getElementById("periodo-custom-box")?.classList.add("hidden");
    return;
  }

  if (e.target.closest("#aplicar-periodo")) {
    modoPeriodoLanc = "custom";
    document.getElementById("periodo-custom-box")?.classList.add("hidden");
    App.refreshLancamentos();
    return;
  }
   if (e.target.closest("#extrato-prev")) {
    modoPeriodoExtrato = "mes";
    mesExtratoAtual.setMonth(mesExtratoAtual.getMonth() - 1);
    renderMesExtrato();
    App.renderExtrato();
    return;
  }

  if (e.target.closest("#extrato-next")) {
    modoPeriodoExtrato = "mes";
    mesExtratoAtual.setMonth(mesExtratoAtual.getMonth() + 1);
    renderMesExtrato();
    App.renderExtrato();
    return;
  }

  if (e.target.closest("#btn-extrato-periodo-custom")) {
    document
      .getElementById("extrato-periodo-custom-box")
      ?.classList.remove("hidden");
    return;
  }

  if (e.target.closest("#extrato-cancelar-periodo")) {
    document
      .getElementById("extrato-periodo-custom-box")
      ?.classList.add("hidden");
    return;
  }

  if (e.target.closest("#extrato-aplicar-periodo")) {
    modoPeriodoExtrato = "custom";
    document
      .getElementById("extrato-periodo-custom-box")
      ?.classList.add("hidden");
    App.renderExtrato();
    return;
  }

});

  /* ============================ BOOTSTRAP / START ============================ */
   
(async function bootstrap() {
  try {
    await requireSessionOrRedirect();


    UI.attachHandlers();

    await Promise.all([
      CategoriasService.load(),
      ContasService.load()
    ]);

    UI.populateSelects();
    UI.renderCategorias();

    await App.init();
  } catch (e) {
    console.error('bootstrap error', e);
  }
})();
// ================================ // EXTRATO — ATUALIZAR AO TROCAR CONTA // ================================
   
document.getElementById("select-contas-extrato")
  ?.addEventListener("change", () => {
    modoPeriodoExtrato = "mes";
    renderMesExtrato();
    App.renderExtrato();
  });
})();


