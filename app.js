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
    cartaoPrevistos: [],
    movimentacoes: [],
    charts: { recCat: null, desCat: null, resumo: null, investimentos: null },
    subs: [] // para armazenar channels se quiser unsub later
  };
     function isPro() {
  return STATE.profile?.plano === "pro";
}
   function isVip() {
  return STATE.profile?.plano === "vip";
}
   function hasPremiumAccess() {
  const plano = String(STATE.profile?.plano || "").toLowerCase();
  const status = String(STATE.profile?.subscription_status || "").toLowerCase();
  const premiumPlan = plano === "pro" || plano === "vip";
  return premiumPlan && status === "active";
}
  let BAIXA_ATUAL = null;
let mesDashboardAtual = new Date();
   function renderMesDashboard() {
  const el = document.getElementById("dash-mes-label");

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  el.textContent =
    `${meses[mesDashboardAtual.getMonth()]} ${mesDashboardAtual.getFullYear()}`;
}

async function atualizarDashboardPorMes() {
  const ano = mesDashboardAtual.getFullYear();
  const mes = mesDashboardAtual.getMonth();

  const inicio = new Date(ano, mes, 1).toISOString().slice(0,10);
  const fim = new Date(ano, mes + 1, 0).toISOString().slice(0,10);

  const dadosDashboard = await carregarDadosDashboard(inicio, fim);

  drawResumo(dadosDashboard);
  drawReceitasPorCategoria(dadosDashboard);
  drawDespesasPorCategoria(dadosDashboard);
  drawInvestimentosDashboard(dadosDashboard);

  renderMesDashboard();
}
   
   function atualizarValorFinalBaixa() {
  if (!BAIXA_ATUAL) return;

  const valor = Number(BAIXA_ATUAL.lancamento.valor || 0);
  const juros = Number(document.getElementById("juros-baixa").value || 0);
  const desconto = Number(document.getElementById("desconto-baixa").value || 0);

  const final = valor + juros - desconto;

  document.getElementById("valor-final-baixa").textContent =
    final.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
}

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
    chartInvestimentos: 'chart-investimentos-dashboard',
    dashPeriod: 'dash-period',
    dashReceber: 'dash-receber',
    dashPagar: 'dash-pagar',
    dashSaldoAtual: 'dash-saldo-atual',
    dashSaldoPrevisto: 'dash-saldo-previsto',
    dashInvestAplicado: 'dash-invest-aplicado',
    dashInvestResgatado: 'dash-invest-resgatado',
    dashInvestLiquido: 'dash-invest-liquido',

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
    modalConta: 'modal-conta-select',
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
  function createTextElement(tag, text, className = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = String(text ?? '');
    return el;
  }
  function fmtMoney(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDateBR(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; }
  function contaLabel(conta) {
    if (!conta) return '';
    return conta.tipo_conta === 'investimento'
      ? `💼 ${conta.nome} (Investimento)`
      : conta.nome;
  }
  function getContaNome(id) {
    return STATE.contas.find(c => c.id === id)?.nome || '';
  }
  function getCategoriaNome(id) {
    return STATE.categorias.find(c => c.id === id)?.nome || 'Sem categoria';
  }
  function isFaturaCartaoLancamento(item) {
    const descricao = String(item?.descricao || "").toLowerCase();
    return Boolean(item?.provisorio_cartao) || descricao.startsWith("fatura ") || descricao.includes("fatura aberta");
  }
  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function isoToday() { return new Date().toISOString().slice(0,10); }
 function uid() { if (typeof crypto !== "undefined" && crypto.randomUUID) {return crypto.randomUUID();}
  // fallback seguro (gera UUID válido)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
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

    if (window.ArolixSecurity) {
      const securityOk =
        await window.ArolixSecurity.requireMfaForProtectedPage();

      if (!securityOk) {
        return false;
      }
    }

    // ✅ usuário autenticado
    STATE.user = data.session.user;

 STATE.profile = await loadUserProfile();

// 🔥 CONTROLE DO BOTÃO UPGRADE (AQUI É O LUGAR CERTO)
const btnUpgrade = document.querySelector('[onclick*="upgrade.html"]');

if (btnUpgrade && STATE.profile) {
  if (hasPremiumAccess()) {
    btnUpgrade.style.display = "none";
  } else {
    btnUpgrade.style.display = "inline-block";
  }
}
// 🔥 deixar STATE global para outros scripts
window.STATE = STATE;
     
     // =========================// UPGRADE FLOW (GLOBAL)// =========================

function goToUpgrade(msg) {
  alert(msg + "\n\n👉 Faça upgrade para liberar.");

  // pequeno delay pra UX melhor
  setTimeout(() => {
    window.location.href = "upgrade.html";
  }, 500);
}

// deixa global (importante!)
window.goToUpgrade = goToUpgrade;
     
     // ===================== AVATAR HEADER =====================

const headerAvatar = document.getElementById("header-avatar");

if (headerAvatar) {
  if (STATE.profile?.avatar_url) {
    headerAvatar.src = STATE.profile.avatar_url + "?t=" + Date.now();
  } else {
    headerAvatar.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  }

  // 🔥 só mostra depois que definir a imagem correta
  headerAvatar.style.display = "block";
}
     // Mostrar nome no header
if (STATE.profile?.nome) {
  const el = document.getElementById("user-email");
  if (el) el.textContent = STATE.profile.nome;
}

    // fallback de segurança
    if (!STATE.profile) {
      STATE.profile = {
        plan: "free",
        onboarding_completed: false
      };
    }

    // Mostrar nome se existir, senão email
const emailEl = document.getElementById(IDS.userEmail);

if (emailEl) {
  emailEl.textContent =
    STATE.profile?.nome || STATE.user.email;
}

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
         const { data: conta } = await supabase
          .from('contas_bancarias')
          .select('saldo_inicial,data_saldo')
          .eq('id', conta_id)
          .eq('user_id', STATE.user.id)
          .maybeSingle();
        const si = Number(conta?.saldo_inicial || 0);
         const dataSaldo = conta?.data_saldo || null;

        const { data: movs } = await supabase
          .from('movimentacoes')
          .select('tipo,valor,descricao,data')
          .eq('conta_id', conta_id)
          .eq('user_id', STATE.user.id);

        let saldo = si;
        let saldoInicialJaDescontado = false;
         const moneyEq = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.000001;
        

        (movs || []).forEach(m => {
          const valor = Number(m.valor || 0);
          const isSaldoInicialDuplicado =
            !saldoInicialJaDescontado &&
             m.tipo === 'credito' &&
            (m.descricao || '').trim().toLowerCase() === 'saldo inicial' &&
            moneyEq(valor, si) &&
            (!dataSaldo || m.data === dataSaldo);

          if (isSaldoInicialDuplicado) {
            saldoInicialJaDescontado = true;
            return;
          }

          if (m.tipo === 'credito') saldo += valor;
          else saldo -= valor;
        });

        await supabase
          .from('contas_bancarias')
          .update({ saldo_atual: saldo })
          .eq('id', conta_id)
          .eq('user_id', STATE.user.id);
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
    async fetchBaixadosComValorReal(tipo, conta_id='all', inicio, fim) {
      try {
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        let q = supabase
          .from(tabela)
          .select('*')
          .eq('user_id', STATE.user.id)
          .eq('baixado', true)
          .gte('data_baixa', inicio)
          .lte('data_baixa', fim)
          .order('data_baixa', { ascending: true });

        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);

        const { data, error } = await q;
        if (error) throw error;

        const lancamentos = data || [];
        if (lancamentos.length === 0) return [];

        const ids = lancamentos.map(item => item.id).filter(Boolean);
        const { data: movs, error: errMovs } = await supabase
          .from('movimentacoes')
          .select('lancamento_id, valor, descricao, data')
          .eq('user_id', STATE.user.id)
          .in('lancamento_id', ids);

        if (errMovs) throw errMovs;

        const movPorLancamento = new Map((movs || []).map(m => [m.lancamento_id, m]));

        return lancamentos.map(item => {
          const mov = movPorLancamento.get(item.id);
          if (!mov) return item;

          const valorOriginal = Number(item.valor || 0);
          const valorReal = Number(mov.valor || valorOriginal);

          return {
            ...item,
            valor_original_lancamento: valorOriginal,
            valor: valorReal,
            descricao_baixa: mov.descricao,
            ajuste_baixa: Number((valorReal - valorOriginal).toFixed(2))
          };
        });
      } catch (e) {
        console.error('LancService.fetchBaixadosComValorReal', e);
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
        const { error } = await supabase
          .from(tabela)
          .update(patch)
          .eq('id', id)
          .eq('user_id', STATE.user.id);
        if (error) throw error;
        return true;
      } catch (e) { console.error('LancService.update', e); throw e; }
    },
    async delete(tipo, id) {
      try {
        const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
        const { error } = await supabase
          .from(tabela)
          .delete()
          .eq('id', id)
          .eq('user_id', STATE.user.id);
        if (error) throw error;
        return true;
      } catch (e) { console.error('LancService.delete', e); throw e; }
    },
    async fetchPrevisoesCartao(conta_id = 'all', inicio, fim) {
      try {
        // A fatura aberta ainda não pertence a uma conta bancária.
        // Por isso ela aparece só na visão "Todas as contas", evitando ruído
        // quando o usuário filtra uma conta específica.
        if (conta_id && conta_id !== 'all') return [];

        const { data: lancamentos, error: errLanc } = await supabase
          .from('cartao_lancamentos')
          .select('id, cartao_id, descricao, valor, data_compra, data_fatura, tipo')
          .eq('user_id', STATE.user.id)
          .gte('data_fatura', inicio)
          .lte('data_fatura', fim)
          .order('data_fatura', { ascending: true });

        if (errLanc) throw errLanc;
        if (!lancamentos || lancamentos.length === 0) return [];

        const cartaoIds = [...new Set(lancamentos.map(l => l.cartao_id).filter(Boolean))];

        const [{ data: cartoes, error: errCartoes }, { data: faturas, error: errFaturas }] = await Promise.all([
          cartaoIds.length
            ? supabase
                .from('cartoes_credito')
                .select('id, nome')
                .eq('user_id', STATE.user.id)
                .in('id', cartaoIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('cartao_faturas')
            .select('id, cartao_id, mes, ano, status, pago')
            .eq('user_id', STATE.user.id)
        ]);

        if (errCartoes) throw errCartoes;
        if (errFaturas) throw errFaturas;

        const cartoesPorId = new Map((cartoes || []).map(c => [c.id, c]));
        const faturasPorChave = new Map(
          (faturas || []).map(f => [`${f.cartao_id}:${f.ano}-${String(f.mes).padStart(2, '0')}`, f])
        );
        const grupos = new Map();

        lancamentos.forEach(lanc => {
          if (!lanc.cartao_id || !lanc.data_fatura) return;

          const data = new Date(`${lanc.data_fatura}T00:00:00`);
          const ano = data.getFullYear();
          const mes = data.getMonth() + 1;
          const chave = `${lanc.cartao_id}:${ano}-${String(mes).padStart(2, '0')}`;
          const fatura = faturasPorChave.get(chave);

          // Se já fechou ou pagou, a despesa real da fatura assume o lugar.
          if (fatura && (fatura.status === 'fechada' || fatura.pago === true)) return;

          const grupo = grupos.get(chave) || {
            id: `cartao-previsto-${chave}`,
            user_id: STATE.user.id,
            descricao: '',
            valor: 0,
            data: lanc.data_fatura,
            baixado: false,
            provisorio_cartao: true,
            cartao_id: lanc.cartao_id,
            movimentos: 0
          };

          grupo.valor += Number(lanc.valor || 0);
          grupo.movimentos += 1;
          grupo.nome_cartao = cartoesPorId.get(lanc.cartao_id)?.nome || 'Cartão';
          grupo.mes = mes;
          grupo.ano = ano;
          grupos.set(chave, grupo);
        });

        return [...grupos.values()]
          .filter(g => Math.abs(Number(g.valor || 0)) > 0.009)
          .map(g => ({
            ...g,
            valor: Number(Number(g.valor || 0).toFixed(2)),
            descricao: `Fatura aberta ${g.nome_cartao} — ${String(g.mes).padStart(2, '0')}/${g.ano}`
          }))
          .sort((a, b) => new Date(a.data) - new Date(b.data));
      } catch (e) {
        console.error('LancService.fetchPrevisoesCartao', e);
        return [];
      }
    }
  };

  async function calcularResumoFinanceiroPeriodo({ conta_id = 'all', inicio, fim } = {}) {
    const [
      receitasPeriodo,
      despesasPeriodo,
      receitasRecebidas,
      despesasPagas,
      cartoesAbertos
    ] = await Promise.all([
      LancService.fetch('receita', conta_id, inicio, fim),
      LancService.fetch('despesa', conta_id, inicio, fim),
      LancService.fetchBaixadosComValorReal('receita', conta_id, inicio, fim),
      LancService.fetchBaixadosComValorReal('despesa', conta_id, inicio, fim),
      LancService.fetchPrevisoesCartao(conta_id, inicio, fim)
    ]);

    const sum = (lista) => (lista || []).reduce((s, item) => s + Number(item.valor || 0), 0);
    const pendentesReceita = (receitasPeriodo || []).filter(item => item.baixado !== true);
    const pendentesDespesa = (despesasPeriodo || []).filter(item => item.baixado !== true);
    const cartoesAbertosLista = (cartoesAbertos || []).map(item => ({
      ...item,
      categoria_nome: item.categoria_nome || 'Cartão de crédito aberto'
    }));

    const totalRecebido = sum(receitasRecebidas);
    const totalPago = sum(despesasPagas);
    const totalAReceber = sum(pendentesReceita);
    const totalDespesasPendentes = sum(pendentesDespesa);
    const totalCartoesAbertos = sum(cartoesAbertosLista);
    const totalAPagar = totalDespesasPendentes + totalCartoesAbertos;
    const investimentosPeriodo = await fetchResumoInvestimentosPeriodo(inicio, fim);
    const saldoRealizado = totalRecebido - totalPago;
    const saldoPendencias = totalAReceber - totalAPagar;
    const saldoDisponivelRealizado = saldoRealizado - investimentosPeriodo.netInvestido;

    return {
      receitasPeriodo: receitasPeriodo || [],
      despesasPeriodo: despesasPeriodo || [],
      receitasRecebidas: receitasRecebidas || [],
      despesasPagas: despesasPagas || [],
      pendentesReceita,
      pendentesDespesa,
      cartoesAbertos: cartoesAbertosLista,
      despesasComPrevisao: [...(despesasPeriodo || []), ...cartoesAbertosLista],
      totalRecebido,
      totalPago,
      totalAReceber,
      totalDespesasPendentes,
      totalCartoesAbertos,
      totalAPagar,
      totalReceitas: totalRecebido + totalAReceber,
      totalDespesas: totalPago + totalAPagar,
      saldoRealizado,
      saldoDisponivelRealizado,
      saldoPendencias,
      investimentosPeriodo,
      saldoPrevisto: saldoDisponivelRealizado + saldoPendencias
    };
  }

  async function fetchResumoInvestimentosPeriodo(inicio, fim) {
    const empty = {
      aplicacoes: [],
      resgates: [],
      totalAplicado: 0,
      totalResgatado: 0,
      rendimentoBruto: 0,
      iof: 0,
      ir: 0,
      netInvestido: 0
    };

    try {
      const [{ data: aplicacoes, error: errAplicacoes }, { data: resgates, error: errResgates }] = await Promise.all([
        supabase
          .from('investimentos')
          .select('id,nome,valor_aplicado,data_aplicacao,status')
          .eq('user_id', STATE.user.id)
          .neq('status', 'cancelado')
          .gte('data_aplicacao', inicio)
          .lte('data_aplicacao', fim),
        supabase
          .from('investimento_resgates')
          .select('id,valor_liquido,rendimento_bruto,iof,ir,data_resgate')
          .eq('user_id', STATE.user.id)
          .gte('data_resgate', inicio)
          .lte('data_resgate', fim)
      ]);

      if (errAplicacoes || errResgates) throw (errAplicacoes || errResgates);

      const aplicacoesLista = aplicacoes || [];
      const resgatesLista = resgates || [];
      const totalAplicado = aplicacoesLista.reduce((s, item) => s + Number(item.valor_aplicado || 0), 0);
      const totalResgatado = resgatesLista.reduce((s, item) => s + Number(item.valor_liquido || 0), 0);
      const rendimentoBruto = resgatesLista.reduce((s, item) => s + Number(item.rendimento_bruto || 0), 0);
      const iof = resgatesLista.reduce((s, item) => s + Number(item.iof || 0), 0);
      const ir = resgatesLista.reduce((s, item) => s + Number(item.ir || 0), 0);

      return {
        aplicacoes: aplicacoesLista,
        resgates: resgatesLista,
        totalAplicado,
        totalResgatado,
        rendimentoBruto,
        iof,
        ir,
        netInvestido: totalAplicado - totalResgatado
      };
    } catch (e) {
      console.warn('fetchResumoInvestimentosPeriodo', e);
      return empty;
    }
  }

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
        let q = supabase
          .from('movimentacoes')
          .select('*')
          .eq('user_id', STATE.user.id)
          .gte('data', inicio)
          .lte('data', fim)
          .order('data', { ascending: true });
        if (conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('ExtratoService.fetch', e); return []; }
    }
  };

/* ============================ UI FUNCTIONS ============================ */
const UI = {

  attachHandlers() {

  // ================================// MENU SUPERIOR// ================================
  $all(IDS.menuBtns).forEach(b => {
    b.addEventListener('click', () => {
      const t = b.dataset.target;
      if (t) App.showScreen(t);
    });
  });

  document.querySelectorAll("[data-dashboard-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.dashboardTab;
      document.querySelectorAll("[data-dashboard-tab]").forEach(item => item.classList.remove("active"));
      document.querySelectorAll("[data-dashboard-panel]").forEach(panel => panel.classList.add("hidden"));
      btn.classList.add("active");
      document.querySelector(`[data-dashboard-panel="${tab}"]`)?.classList.remove("hidden");
      setTimeout(() => {
        Object.values(STATE.charts || {}).forEach(chart => {
          try { chart?.resize?.(); } catch (e) {}
        });
      }, 80);
    });
  });

  // ================================// LANÇAMENTOS — MENU LATERAL// ================================
  document.querySelectorAll("[data-lanc-tab]").forEach(btn => {
    btn.addEventListener("click", () => {

      document
        .querySelectorAll("[data-lanc-tab]")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      FILTRO_LANCAMENTOS = btn.dataset.lancTab;

      App.refreshLancamentos();
    });
  });

    // ===================== MODAL CONTA =====================

    const modal = document.getElementById("modal-conta");

    const btnOpen = document.getElementById("btn-open-modal-conta");
    const btnCancel = document.getElementById("btn-cancelar-conta");
    const btnSave = document.getElementById("btn-salvar-conta");

   document.addEventListener("click", function (e) {

  if (e.target.closest("#btn-open-modal-conta")) {

    e.stopPropagation();

    const modal = document.getElementById("modal-conta");

    // 🔓 MODO CRIAÇÃO — libera todos os campos
    document.getElementById("modal-conta-nome").disabled = false;
    document.getElementById("modal-conta-agencia").disabled = false;
    document.getElementById("modal-conta-numero").disabled = false;
    document.getElementById("modal-conta-gerente").disabled = false;
    document.getElementById("modal-conta-contato").disabled = false;
    document.getElementById("modal-conta-saldo").disabled = false;
    document.getElementById("modal-conta-data").disabled = false;

    // remove modo edição
    delete document.getElementById("btn-salvar-conta").dataset.editId;

    document.querySelector("#modal-conta h3").textContent = "Cadastrar conta";

    modal.classList.remove("hidden");
    modal.style.display = "flex";
    modal.style.zIndex = "999999";
  }

});


  document.addEventListener("click", function (e) {

  if (e.target.closest("#btn-cancelar-conta")) {
    const modal = document.getElementById("modal-conta");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.removeProperty("display"); // 🔥 remove display inline
    }
  }
});

   if (btnSave) {
  btnSave.addEventListener("click", async function () {
     // 🔥 BLOQUEIO PLANO FREE
if (!hasPremiumAccess() && STATE.contas.length >= 2) {
  goToUpgrade("Plano Free permite até 2 contas.");
  return;
}
    const editId = btnSave.dataset.editId;

    const conta = {
      nome: document.getElementById("modal-conta-nome").value,
      agencia: document.getElementById("modal-conta-agencia").value,
      numero_conta: document.getElementById("modal-conta-numero").value,
      gerente: document.getElementById("modal-conta-gerente").value,
      contato: document.getElementById("modal-conta-contato").value,
      saldo_inicial: Number(document.getElementById("modal-conta-saldo").value || 0),
      data_saldo: document.getElementById("modal-conta-data").value
    };

    if (!conta.nome) {
      alert("Informe o nome da conta.");
      return;
    }

    if (editId) {

     await supabase
  .from("contas_bancarias")
  .update({
    nome: conta.nome,
    agencia: conta.agencia,
    numero_conta: conta.numero_conta,
    gerente: conta.gerente,
    contato: conta.contato
  })
  .eq("id", editId)
  .eq("user_id", STATE.user.id);


      delete btnSave.dataset.editId;

    } else {

      // 🔥 MODO CRIAÇÃO
      await ContasService.create(conta);
    }

    document.getElementById("modal-conta").classList.add("hidden");

    await App.reloadAll();
  });
}

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
     // 🔥 BLOQUEIO DO CARTÃO
const btnCartao = document.getElementById("btn-cartao");

if (btnCartao) {
  btnCartao.addEventListener("click", () => {

    if (!hasPremiumAccess()) {
      goToUpgrade("Cartão disponível apenas no plano PRO.");
      return;
    }

    window.location.href = "cartao.html";
  });
}
},
  
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
      selModalConta.appendChild(new Option(contaLabel(c), c.id));
    });
  }

  // ✔ Popular contas nos filtros normalmente
  (STATE.contas || []).forEach(c => {
   const label = contaLabel(c);
    if (selFilter) selFilter.appendChild(new Option(label, c.id));
    if (selExtr) selExtr.appendChild(new Option(label, c.id));
    if (selLista) selLista.appendChild(new Option(label, c.id));
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
          await supabase
            .from('categorias')
            .delete()
            .eq('id', cat.id)
            .eq('user_id', STATE.user.id);
          // remove referencia em receitas/despesas
          await supabase
            .from('receitas')
            .update({ categoria_id: null })
            .eq('categoria_id', cat.id)
            .eq('user_id', STATE.user.id);
          await supabase
            .from('despesas')
            .update({ categoria_id: null })
            .eq('categoria_id', cat.id)
            .eq('user_id', STATE.user.id);
          await App.reloadAll();
        });
        li.appendChild(span); li.appendChild(btn); ul.appendChild(li);
      });
    },
   
renderContasCards() {
  const container = document.getElementById("lista-contas");
  if (!container) return;

  container.innerHTML = "";

  if (!STATE.contas || STATE.contas.length === 0) {
    container.innerHTML = "<p>Nenhuma conta cadastrada.</p>";
    return;
  }

  STATE.contas.forEach(conta => {
    const div = document.createElement("div");
    div.className = "conta-card";

    const info = document.createElement("div");
    info.className = "conta-info";
    const title = document.createElement("div");
    title.className = "conta-title-line";
    title.appendChild(createTextElement("strong", conta.nome));
    if (conta.tipo_conta === "investimento") {
      title.appendChild(createTextElement("span", "Investimento", "conta-tipo-badge"));
      div.classList.add("conta-card-investimento");
    }
    info.appendChild(title);
    info.appendChild(createTextElement("small", `Agência: ${conta.agencia || "-"}`));
    info.appendChild(createTextElement("small", `Conta: ${conta.numero_conta || "-"}`));
    info.appendChild(createTextElement("small", `Gerente: ${conta.gerente || "-"}`));
    info.appendChild(createTextElement("small", `Contato: ${conta.contato || "-"}`));

    const actions = document.createElement("div");
    actions.className = "conta-actions";
    const editButton = createTextElement("button", "Editar", "btn-secondary btn-edit-conta");
    editButton.type = "button";
    actions.appendChild(editButton);
    info.appendChild(actions);
    div.appendChild(info);

    // 🔥 ATIVA O BOTÃO EDITAR
    editButton.addEventListener("click", () => {
      abrirModalEditarConta(conta);
    });

    container.appendChild(div);
  });
},

    // renders the lists of receipts and expenses in the lanc screen
    renderLancamentos({ receitas, despesas, totais }) {
      const ulR = $(IDS.listReceitas); const ulD = $(IDS.listDespesas);
      const ulP = document.getElementById("list-pendencias");
      if (ulR) ulR.innerHTML = '';
      if (ulD) ulD.innerHTML = '';
      if (ulP) ulP.innerHTML = '';

      let totalR = 0, totalD = 0;

      (receitas || []).forEach(r => {
        totalR += Number(r.valor || 0);
        if (ulR && FILTRO_LANCAMENTOS !== "pendencias") ulR.appendChild(UI._createLancItem(r, 'receita'));
      });

      (despesas || []).forEach(d => {
        totalD += Number(d.valor || 0);
        if (ulD && FILTRO_LANCAMENTOS !== "pendencias") ulD.appendChild(UI._createLancItem(d, 'despesa'));
      });

      if (ulP && FILTRO_LANCAMENTOS === "pendencias") {
        const pendencias = [
          ...(receitas || []).map(item => ({ ...item, __tipo_lancamento: "receita" })),
          ...(despesas || []).map(item => ({ ...item, __tipo_lancamento: "despesa" }))
        ].sort((a, b) => new Date(a.data_baixa || a.data) - new Date(b.data_baixa || b.data));

        pendencias.forEach(item => {
          ulP.appendChild(UI._createLancItem(item, item.__tipo_lancamento));
        });

        if (pendencias.length === 0) {
          ulP.appendChild(UI._createEmptyLancItem('Nenhuma pendência neste período.'));
        }
      }

      if (ulR && FILTRO_LANCAMENTOS !== "pendencias" && (!receitas || receitas.length === 0)) {
        ulR.appendChild(UI._createEmptyLancItem('Nenhuma receita neste filtro.'));
      }

      if (ulD && FILTRO_LANCAMENTOS !== "pendencias" && (!despesas || despesas.length === 0)) {
        ulD.appendChild(UI._createEmptyLancItem('Nenhuma despesa neste filtro.'));
      }

      if (totais) {
        totalR = Number(totais.receitas || 0);
        totalD = Number(totais.despesas || 0);
      }

      const tr = $(IDS.totalReceitas); const td = $(IDS.totalDespesas);
      if (tr) tr.textContent = fmtMoney(totalR);
      if (td) td.textContent = fmtMoney(totalD);

      safeText($(IDS.saldoAtual), fmtMoney(totalR - totalD));
    },

   _createEmptyLancItem(text) {
    const li = document.createElement("li");
    li.className = "lanc-empty";
    li.textContent = text;
    return li;
   },

   _createLancItem(item, tipo) {
  const li = document.createElement("li");
  li.className = `lanc-item lanc-${tipo}`;

  // =========================// TEXTO DO LANÇAMENTO// =========================
      
 const left = document.createElement("div");
 left.className = "lanc-item-main";

if (item.provisorio_cartao) {
  li.classList.add("lanc-provisorio-cartao");
  li.title = "Previsão da fatura aberta. O lançamento real será criado quando a fatura for fechada.";

  left.appendChild(createTextElement("span", fmtDateBR(item.data), "lanc-date"));

  const body = document.createElement("div");
  body.className = "lanc-body";
  body.appendChild(createTextElement("strong", item.descricao, "lanc-title"));
  body.appendChild(createTextElement("small", `${item.movimentos || 0} movimento(s) do cartão`, "lanc-subtitle"));
  left.appendChild(body);

  const valueEl = createTextElement("strong", fmtMoney(item.valor), "lanc-value lanc-value-card");

  const badge = document.createElement("span");
  badge.className = "lanc-badge-provisorio";
  badge.textContent = "Fatura aberta";

  const right = document.createElement("div");
  right.className = "lanc-provisorio-info";
  right.appendChild(badge);

  li.append(left, valueEl, right);
  return li;
}

const dataReferencia = item.data_baixa || item.data;
const statusLabel = item.baixado
  ? (tipo === "receita" ? "Recebido" : "Pago")
  : (tipo === "receita" ? "A receber" : "A pagar");
const statusClass = item.baixado ? "lanc-status-done" : "lanc-status-open";
const valueClass = tipo === "receita" ? "lanc-value-income" : "lanc-value-expense";
const ajuste = item.ajuste_baixa
  ? `Ajuste na baixa ${item.ajuste_baixa > 0 ? "+" : ""}${fmtMoney(item.ajuste_baixa)}`
  : "";

left.appendChild(createTextElement("span", fmtDateBR(dataReferencia), "lanc-date"));

const body = document.createElement("div");
body.className = "lanc-body";
body.appendChild(createTextElement("strong", item.descricao, "lanc-title"));

const meta = document.createElement("div");
meta.className = "lanc-meta";
meta.appendChild(createTextElement("span", getCategoriaNome(item.categoria_id), "lanc-chip"));
const contaNome = getContaNome(item.conta_id);
if (contaNome) meta.appendChild(createTextElement("span", contaNome, "lanc-chip lanc-chip-muted"));
meta.appendChild(createTextElement("span", statusLabel, `lanc-chip ${statusClass}`));
if (ajuste) meta.appendChild(createTextElement("span", ajuste, "lanc-chip lanc-chip-adjust"));
body.appendChild(meta);
left.appendChild(body);

const valueEl = createTextElement("strong", fmtMoney(item.valor), `lanc-value ${valueClass}`);
const bloqueiaEdicaoCartao = isFaturaCartaoLancamento(item);
      
// ================================// TRANSFERÊNCIA — AÇÃO ESPECIAL// ================================
if (item.transferencia_id) {

  const right = document.createElement("div");
  right.className = "lanc-actions";

  const btnExcluir = document.createElement("button");
  btnExcluir.textContent = "Excluir transferência";
  btnExcluir.classList.add("btn-danger");

  btnExcluir.addEventListener("click", () => {
    excluirTransferencia(item.transferencia_id);
  });

  li.append(left, valueEl);
  right.appendChild(btnExcluir);
  li.appendChild(right);

  // 🔴 IMPORTANTE: NÃO executa Editar / Baixar
  return li;
}

  // ========================= // AÇÕES (SEM EXCLUIR)// =========================
  const right = document.createElement("div");
  right.className = "lanc-actions";

  // ✏️ EDITAR
  if (!bloqueiaEdicaoCartao) {
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.classList.add("edit");
    btnEdit.addEventListener("click", () => {
      UI.openModalEdit(item, tipo);
    });
    right.appendChild(btnEdit);
  } else {
    meta.appendChild(createTextElement("span", "Editar no cartão", "lanc-chip lanc-chip-card-lock"));
  }

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
        .eq("lancamento_id", item.id)
        .eq("user_id", STATE.user.id);

      if (!movs || movs.length === 0) {
        alert("Nenhuma movimentação encontrada.");
        return;
      }

      for (const m of movs) {
        await supabase
          .from("movimentacoes")
          .delete()
          .eq("id", m.id)
          .eq("user_id", STATE.user.id);
      }

      await supabase
        .from(tipo === "receita" ? "receitas" : "despesas")
        .update({
          baixado: false,
          data_baixa: null
        })
        .eq("id", item.id)
        .eq("user_id", STATE.user.id);

      await App.refreshLancamentos();
      await App.renderExtrato();
    });
    right.appendChild(btnCancelar);
  }

  li.append(left, valueEl, right);
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
        .eq("user_id", STATE.user.id)
        .gte("data", item.data);
    } 
    else if (escopo === "all") {
      await supabase
        .from(tabela)
        .delete()
        .eq("recorrencia_id", item.recorrencia_id)
        .eq("user_id", STATE.user.id);
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

  // =========================// PREENCHER CAMPOS// =========================
  $(IDS.modalTipo).value = tipo;

  $(IDS.modalDesc).value =
    (item.descricao || '').replace(/\s*\(\d+\/\d+\)$/, '');

  $(IDS.modalValor).value = item.valor || '';
  $(IDS.modalData).value = item.data || isoToday();

  UI.populateSelects();

  if (item.conta_id) $(IDS.modalConta).value = item.conta_id;
  if (item.categoria_id) $(IDS.modalCategoria).value = item.categoria_id;

  // ========================= // BOTÃO SALVAR (EDIÇÃO)// =========================
  const saveBtn = $(IDS.modalSave);
  saveBtn.dataset.edit = 'true';
  saveBtn.dataset.editId = item.id;
  saveBtn.textContent = 'Salvar alteração';

  // =========================// BOTÃO EXCLUIR // =========================
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

 document.getElementById("valor-original-baixa").textContent =
  Number(lancamento.valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
 atualizarValorFinalBaixa();

  const selectConta = document.getElementById("conta-baixa-select");
selectConta.innerHTML = "";

// popular contas
(STATE.contas || []).forEach(c => {
  selectConta.appendChild(new Option(contaLabel(c), c.id));
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
     // 🔥 BLOQUEIO DE LANÇAMENTOS (PLANO FREE)
if (!hasPremiumAccess()) {
  const totalLanc = (STATE.receitas?.length || 0) + (STATE.despesas?.length || 0);

  if (totalLanc >= 50 && !saveBtn?.dataset?.editId) {
    goToUpgrade("Plano Free permite até 50 lançamentos.");
    return;
  }
}
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
    .eq('user_id', STATE.user.id)
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
      .eq('id', editId)
      .eq('user_id', STATE.user.id);

  } else if (escopo === 'next') {
    await supabase
      .from(tabelaLanc)
      .update(patchBase)
      .eq('recorrencia_id', recorrenciaId)
      .eq('user_id', STATE.user.id)
      .gte('data', dataBase);

  } else if (escopo === 'all') {
    await supabase
      .from(tabelaLanc)
      .update(patchBase)
      .eq('recorrencia_id', recorrenciaId)
      .eq('user_id', STATE.user.id);
  }

  // ==================================================// 🔄 SINCRONIZA EXTRATO (SOMENTE SE FOR "ONE")// ==================================================
  if (escopo === 'one') {

    const { data: lancAtual } = await supabase
      .from(tabelaLanc)
      .select('baixado')
      .eq('id', editId)
      .eq('user_id', STATE.user.id)
      .maybeSingle();

    if (lancAtual?.baixado === true) {
      const { data: mov } = await supabase
        .from('movimentacoes')
        .select('*')
        .eq('lancamento_id', editId)
        .eq('user_id', STATE.user.id)
        .maybeSingle();

     if (mov) {
  await supabase
    .from('movimentacoes')
    .update({
      descricao,
      valor,
      data,
      conta_id: conta_id || null   // 🔥 ESSA LINHA RESOLVE
    })
    .eq('id', mov.id)
    .eq('user_id', STATE.user.id);
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

      const recorrenciaId =uid();
      const base = new Date (data + 'T00:00:00');

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
function abrirModalEditarConta(conta) {

  const modal = document.getElementById("modal-conta");

  // Preenche campos
  document.getElementById("modal-conta-nome").value = conta.nome || "";
  document.getElementById("modal-conta-agencia").value = conta.agencia || "";
  document.getElementById("modal-conta-numero").value = conta.numero_conta || "";
  document.getElementById("modal-conta-gerente").value = conta.gerente || "";
  document.getElementById("modal-conta-contato").value = conta.contato || "";
  document.getElementById("modal-conta-saldo").value = conta.saldo_inicial || 0;
  document.getElementById("modal-conta-data").value = conta.data_saldo || "";

  // 🔒 BLOQUEIA SOMENTE SALDO E DATA
  document.getElementById("modal-conta-saldo").disabled = true;
  document.getElementById("modal-conta-data").disabled = true;

  // 🔓 Libera os demais campos
  document.getElementById("modal-conta-nome").disabled = false;
  document.getElementById("modal-conta-agencia").disabled = false;
  document.getElementById("modal-conta-numero").disabled = false;
  document.getElementById("modal-conta-gerente").disabled = false;
  document.getElementById("modal-conta-contato").disabled = false;

  const btnSalvar = document.getElementById("btn-salvar-conta");
  btnSalvar.dataset.editId = conta.id;

  document.querySelector("#modal-conta h3").textContent = "Editar conta";

  modal.classList.remove("hidden");
}

  /* ============================ CHARTS ============================ */
   
  const DASH_COLORS = [
    '#7a4dff',
    '#22c55e',
    '#f97316',
    '#06b6d4',
    '#ec4899',
    '#f59e0b',
    '#14b8a6',
    '#6366f1',
    '#ef4444',
    '#84cc16'
  ];

  function categoriaNome(categoriaId) {
    return STATE.categorias.find(c => c.id === categoriaId)?.nome || 'Sem categoria';
  }

  function agruparPorCategoria(lista, fallback = 'Sem categoria') {
    const grupos = {};
    (lista || []).forEach(item => {
      const nome = item.categoria_nome || categoriaNome(item.categoria_id) || fallback;
      grupos[nome] = (grupos[nome] || 0) + Number(item.valor || 0);
    });
    return grupos;
  }

  function prepararSerieGrafico(grupos) {
    const itens = Object.entries(grupos || {})
      .filter(([, valor]) => Math.abs(Number(valor || 0)) > 0.009)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    if (itens.length === 0) {
      return {
        labels: ['Sem dados'],
        values: [1],
        colors: ['#e5e7eb'],
        vazio: true
      };
    }

    const top = itens.slice(0, 7);
    const restante = itens.slice(7).reduce((s, [, valor]) => s + Number(valor || 0), 0);

    if (restante > 0) top.push(['Outros', restante]);

    return {
      labels: top.map(([label]) => label),
      values: top.map(([, valor]) => Number(Number(valor || 0).toFixed(2))),
      colors: top.map((_, i) => DASH_COLORS[i % DASH_COLORS.length]),
      vazio: false
    };
  }

  function chartMoneyTooltip(context) {
    if (context.dataset?.metaVazio) return 'Sem dados no período';
    const label = context.label || context.dataset?.label || '';
    const value = context.parsed?.y ?? context.parsed ?? 0;
    return `${label}: ${fmtMoney(value)}`;
  }

  async function carregarDadosDashboard(inicio, fim) {
    try {
      const resumo = await calcularResumoFinanceiroPeriodo({ conta_id: 'all', inicio, fim });

      return {
        inicio,
        fim,
        receitas: resumo.receitasPeriodo,
        despesas: resumo.despesasPeriodo,
        receitasBaixadas: resumo.receitasRecebidas,
        despesasBaixadas: resumo.despesasPagas,
        previsoesCartao: resumo.cartoesAbertos,
        despesasComPrevisao: resumo.despesasComPrevisao,
        totalReceitas: resumo.totalReceitas,
        totalDespesas: resumo.totalDespesas,
        totalRecebido: resumo.totalRecebido,
        totalPago: resumo.totalPago,
        totalAReceber: resumo.totalAReceber,
        totalAPagar: resumo.totalAPagar,
        saldoRealizado: resumo.saldoRealizado,
        saldoDisponivelRealizado: resumo.saldoDisponivelRealizado,
        investimentosPeriodo: resumo.investimentosPeriodo,
        saldoPrevisto: resumo.saldoPrevisto
      };
    } catch (e) {
      console.error('carregarDadosDashboard', e);
      return {
        inicio,
        fim,
        receitas: [],
        despesas: [],
        previsoesCartao: [],
        despesasComPrevisao: [],
        totalReceitas: 0,
        totalDespesas: 0,
        totalRecebido: 0,
        totalPago: 0,
        totalAReceber: 0,
        totalAPagar: 0,
        saldoRealizado: 0,
        saldoDisponivelRealizado: 0,
        investimentosPeriodo: {
          aplicacoes: [],
          resgates: [],
          totalAplicado: 0,
          totalResgatado: 0,
          rendimentoBruto: 0,
          iof: 0,
          ir: 0,
          netInvestido: 0
        },
        saldoPrevisto: 0
      };
    }
  }

  function drawReceitasPorCategoria(dados) {
    try {
      const serie = prepararSerieGrafico(agruparPorCategoria(dados.receitas));
      const ctx = document.getElementById(IDS.chartRecCat);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.recCat) STATE.charts.recCat.destroy(); } catch (e) {}
      STATE.charts.recCat = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: serie.labels,
          datasets: [{
            label: 'Receitas',
            data: serie.values,
            backgroundColor: serie.colors,
            borderColor: '#ffffff',
            borderWidth: 3,
            metaVazio: serie.vazio
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: { callbacks: { label: chartMoneyTooltip } }
          }
        }
      });
    } catch (e) { console.error('drawReceitasPorCategoria', e); }
  }

  function drawDespesasPorCategoria(dados) {
    try {
      const serie = prepararSerieGrafico(agruparPorCategoria(dados.despesasComPrevisao));
      const ctx = document.getElementById(IDS.chartDesCat);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.desCat) STATE.charts.desCat.destroy(); } catch (e) {}
      STATE.charts.desCat = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: serie.labels,
          datasets: [{
            label: 'Despesas',
            data: serie.values,
            backgroundColor: serie.colors,
            borderColor: '#ffffff',
            borderWidth: 3,
            metaVazio: serie.vazio
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: { callbacks: { label: chartMoneyTooltip } }
          }
        }
      });
    } catch (e) { console.error('drawDespesasPorCategoria', e); }
  }

  function drawResumo(dados) {
    try {
      safeText($(IDS.dashPeriod), `${fmtDateBR(dados.inicio)} a ${fmtDateBR(dados.fim)}`);
      safeText($(IDS.dashReceber), fmtMoney(dados.totalAReceber));
      safeText($(IDS.dashPagar), fmtMoney(dados.totalAPagar));
      safeText($(IDS.dashSaldoAtual), fmtMoney(dados.saldoDisponivelRealizado ?? dados.saldoRealizado));
      safeText($(IDS.dashSaldoPrevisto), fmtMoney(dados.saldoPrevisto));

      const ctx = document.getElementById(IDS.chartResumo);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.resumo) STATE.charts.resumo.destroy(); } catch (e) {}
      STATE.charts.resumo = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Realizado disponível', 'A receber', 'A pagar', 'Saldo previsto'],
          datasets: [{
            label: 'Resumo do período',
            data: [dados.saldoDisponivelRealizado ?? dados.saldoRealizado, dados.totalAReceber, dados.totalAPagar, dados.saldoPrevisto],
            backgroundColor: ['#6366f1', '#22c55e', '#ef4444', dados.saldoPrevisto >= 0 ? '#14b8a6' : '#f97316'],
            borderRadius: 10,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => `${context.label}: ${fmtMoney(context.parsed.y || 0)}`
              }
            }
          },
          scales: {
            y: {
              ticks: {
                callback: value => fmtMoney(Number(value)).replace('R$', 'R$ ')
              },
              grid: { color: '#eef0f4' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    } catch (e) { console.error('drawResumo', e); }
  }

  function drawInvestimentosDashboard(dados) {
    try {
      const inv = dados.investimentosPeriodo || {};
      const aplicado = Number(inv.totalAplicado || 0);
      const resgatado = Number(inv.totalResgatado || 0);
      const liquido = Number(inv.netInvestido || 0);

      safeText($(IDS.dashInvestAplicado), fmtMoney(aplicado));
      safeText($(IDS.dashInvestResgatado), fmtMoney(resgatado));
      safeText($(IDS.dashInvestLiquido), fmtMoney(liquido));

      const ctx = document.getElementById(IDS.chartInvestimentos);
      if (!ctx || !window.Chart) return;
      try { if (STATE.charts.investimentos) STATE.charts.investimentos.destroy(); } catch (e) {}

      STATE.charts.investimentos = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Aplicado', 'Resgatado', 'Investido líquido'],
          datasets: [{
            label: 'Investimentos no período',
            data: [aplicado, resgatado, liquido],
            backgroundColor: ['#7c4dff', '#14b8a6', liquido >= 0 ? '#6366f1' : '#f97316'],
            borderRadius: 12,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: context => `${context.label}: ${fmtMoney(context.parsed.y || 0)}` } }
          },
          scales: {
            y: {
              ticks: { callback: value => fmtMoney(Number(value)).replace('R$', 'R$ ') },
              grid: { color: '#eef0f4' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    } catch (e) { console.error('drawInvestimentosDashboard', e); }
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

  const transferenciaId = uid();

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
    id: uid(),
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
    id:uid() ,
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
await App.renderExtrato(); // 🔥 ADICIONE ESTA LINHA

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
      .eq("transferencia_id", transferenciaId)
      .eq("user_id", STATE.user.id);

    // 2️⃣ remove o registro principal
    await supabase
      .from("transferencias")
      .delete()
      .eq("id", transferenciaId)
      .eq("user_id", STATE.user.id);

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
  UI.renderContasCards(); 
},

async init() {
  await this.reloadAll();
  this.showScreen('dashboard');

  // 🔥 REALTIME
  this.subscribeRealtime();

  // 🔥 PRIMEIRO RENDER
  await this.refreshLancamentos();

  await atualizarDashboardPorMes();
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

  const selectExtrato = document.getElementById("select-contas-extrato");

  if (selectExtrato && !selectExtrato.value) {
    if (STATE.contas.length > 0) {
      selectExtrato.value = STATE.contas[0].id;
    }
  }

  App.renderExtrato();
}

},

    subscribeRealtime() {
      // we create channels per table; store refs on STATE.subs to unsubscribe if needed
      try {
        const chReceitas = supabase.channel('chan_receitas').on('postgres_changes', { event: '*', schema: 'public', table: 'receitas' }, payload => {
          console.debug('realtime receitas', payload);
          this.refreshLancamentos();
          atualizarDashboardPorMes();
        }).subscribe();
        const chDespesas = supabase.channel('chan_despesas').on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, payload => { console.debug('realtime despesas', payload); this.refreshLancamentos(); atualizarDashboardPorMes(); }).subscribe();
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
        const chCartaoLanc = supabase.channel('chan_cartao_lancamentos').on('postgres_changes', { event: '*', schema: 'public', table: 'cartao_lancamentos' }, payload => {
          console.debug('realtime cartao_lancamentos', payload);
          this.refreshLancamentos();
          atualizarDashboardPorMes();
        }).subscribe();
        const chCartaoFaturas = supabase.channel('chan_cartao_faturas').on('postgres_changes', { event: '*', schema: 'public', table: 'cartao_faturas' }, payload => {
          console.debug('realtime cartao_faturas', payload);
          this.refreshLancamentos();
          atualizarDashboardPorMes();
        }).subscribe();

        const chCats = supabase.channel('chan_cats').on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, payload => { console.debug('realtime categorias', payload); this.reloadCatsContas(); }).subscribe();
        const chContas = supabase.channel('chan_contas').on('postgres_changes', { event: '*', schema: 'public', table: 'contas_bancarias' }, payload => { console.debug('realtime contas', payload); this.reloadCatsContas(); }).subscribe();
        STATE.subs.push(chReceitas, chDespesas, chMov, chCartaoLanc, chCartaoFaturas, chCats, chContas);
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

        const resumoPeriodo = await calcularResumoFinanceiroPeriodo({ conta_id, inicio, fim });

        setTextById("lanc-resumo-recebido", fmtMoney(resumoPeriodo.totalRecebido));
        setTextById("lanc-resumo-pago", fmtMoney(resumoPeriodo.totalPago));
        setTextById("lanc-resumo-pendente", fmtMoney(resumoPeriodo.saldoPendencias));
        setTextById("lanc-resumo-cartao", fmtMoney(resumoPeriodo.totalCartoesAbertos));

        setTextById("count-receitas", String(resumoPeriodo.pendentesReceita.length));
        setTextById("count-despesas", String(resumoPeriodo.pendentesDespesa.length + resumoPeriodo.cartoesAbertos.length));
        setTextById("count-recebidos", String(resumoPeriodo.receitasRecebidas.length));
        setTextById("count-pagos", String(resumoPeriodo.despesasPagas.length));
        setTextById("count-pendencias", String(
          resumoPeriodo.pendentesReceita.length + resumoPeriodo.pendentesDespesa.length + resumoPeriodo.cartoesAbertos.length
        ));

        let r, d;
        let previsoesCartao = [];

if (FILTRO_LANCAMENTOS === "pagos" || FILTRO_LANCAMENTOS === "recebidos") {

  // 🔥 FILTRA PELO PERÍODO DA BAIXA E USA O VALOR REAL DO EXTRATO
  [r, d] = await Promise.all([
    LancService.fetchBaixadosComValorReal('receita', conta_id, inicio, fim),
    LancService.fetchBaixadosComValorReal('despesa', conta_id, inicio, fim)
  ]);

} else {

  // 🔵 FILTRA PELO VENCIMENTO (COMPORTAMENTO NORMAL)
  [r, d, previsoesCartao] = await Promise.all([
    LancService.fetch('receita', conta_id, inicio, fim),
    LancService.fetch('despesa', conta_id, inicio, fim),
    LancService.fetchPrevisoesCartao(conta_id, inicio, fim)
  ]);
}


STATE.receitas = r;
STATE.despesas = d;
STATE.cartaoPrevistos = previsoesCartao || [];

const despesasPeriodo = [
  ...(d || []),
  ...((FILTRO_LANCAMENTOS === "pagos" || FILTRO_LANCAMENTOS === "recebidos") ? [] : STATE.cartaoPrevistos)
];
         
// 🔥 ORDENAR DEPENDENDO DO FILTRO ATIVO

if (FILTRO_LANCAMENTOS === "pagos" || FILTRO_LANCAMENTOS === "recebidos") {

  r.sort((a, b) => new Date(a.data_baixa) - new Date(b.data_baixa));
  d.sort((a, b) => new Date(a.data_baixa) - new Date(b.data_baixa));

} else {

  r.sort((a, b) => new Date(a.data) - new Date(b.data));
  despesasPeriodo.sort((a, b) => new Date(a.data) - new Date(b.data));

}

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
const despesasFiltradas = filtrar(despesasPeriodo, "despesa");

const totalReceitasPeriodo = (receitasFiltradas || [])
  .reduce((s, i) => s + Number(i.valor || 0), 0);

const totalDespesasPeriodo = (despesasFiltradas || [])
  .reduce((s, i) => s + Number(i.valor || 0), 0);

// ================================// RENDER FINAL// ================================
         
UI.renderLancamentos({
  receitas: receitasFiltradas,
  despesas: despesasFiltradas,
  totais: {
    receitas: totalReceitasPeriodo,
    despesas: totalDespesasPeriodo
  }
});
// ================================ VISIBILIDADE DOS BLOCOS (UX) // ================================

const boxReceitas = document.getElementById("box-receitas");
const boxDespesas = document.getElementById("box-despesas");
const boxPendencias = document.getElementById("box-pendencias");
const listas = document.querySelector(".listas");

if (boxReceitas && boxDespesas && listas) {

  // RESET GERAL (sempre começa limpo)
  if (boxPendencias) boxPendencias.style.display = "none";
  boxReceitas.style.display = "";
  boxDespesas.style.display = "";
  listas.classList.remove("single-column");

  if (FILTRO_LANCAMENTOS === "pendencias") {
    if (boxPendencias) boxPendencias.style.display = "";
    boxReceitas.style.display = "none";
    boxDespesas.style.display = "none";
    listas.classList.add("single-column");
  }

  // ================================// FILTROS QUE MOSTRAM APENAS UM TIPO// ================================

  // Receitas / Recebidos → mostra só receitas
  else if (
    FILTRO_LANCAMENTOS === "receitas" ||
    FILTRO_LANCAMENTOS === "recebidos"
  ) {
    boxDespesas.style.display = "none";
    listas.classList.add("single-column");
  }

  // Despesas / Pagos → mostra só despesas
  else if (
    FILTRO_LANCAMENTOS === "despesas" ||
    FILTRO_LANCAMENTOS === "pagos"
  ) {
    boxReceitas.style.display = "none";
    listas.classList.add("single-column");
  }

}

       } catch (e) {
        console.error('refreshLancamentos', e);
      }
    },

async renderExtrato() {
  try {
   const selectExtrato = document.getElementById("select-contas-extrato");

if (!selectExtrato) return;

const conta_id = selectExtrato.value;

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
      .eq("conta_id", conta_id)
      .eq("user_id", STATE.user.id);

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
      .eq("user_id", STATE.user.id)
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

  const movementClass = m.tipo === "credito" ? "extrato-credito" : "extrato-debito";
  tr.appendChild(createTextElement(
    "td",
    new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")
  ));
  tr.appendChild(createTextElement("td", m.descricao));
  tr.appendChild(createTextElement(
    "td",
    m.tipo === "credito" ? "Crédito" : "Débito",
    movementClass
  ));
  tr.appendChild(createTextElement(
    "td",
    Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    movementClass
  ));
  tr.appendChild(createTextElement(
    "td",
    saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    saldo >= 0 ? "extrato-saldo-positivo" : "extrato-saldo-negativo"
  ));

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
  .eq("user_id", STATE.user.id)
  .limit(1);

if (jaBaixado && jaBaixado.length > 0) {
  alert("Este lançamento já foi baixado.");
  return;
}

    // 🔹 cria movimentação (extrato)
const { error: insertErr } = await supabase
  .from("movimentacoes")
  .insert([{
    id:uid() ,
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
      .eq("id", lancamento.id)
      .eq("user_id", STATE.user.id);

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
   
   document.getElementById("juros-baixa")
  ?.addEventListener("input", atualizarValorFinalBaixa);

document.getElementById("desconto-baixa")
  ?.addEventListener("input", atualizarValorFinalBaixa);

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
      selOrigem.appendChild(new Option(contaLabel(c), c.id));
      selDestino.appendChild(new Option(contaLabel(c), c.id));
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
/* ============================ BOOTSTRAP / START ============================ */

(async function bootstrap() {
  try {

    const hasSession = await requireSessionOrRedirect();
    if (!hasSession) return;

    // 🔥 Anexa todos os eventos
    UI.attachHandlers();

    // 🔥 GARANTE que o modal começa escondido
    const modalConta = document.getElementById("modal-conta");
    if (modalConta) {
      modalConta.classList.add("hidden");
    }

    // 🔥 Carrega dados iniciais
    await Promise.all([
      CategoriasService.load(),
      ContasService.load()
    ]);

    UI.populateSelects();
    UI.renderCategorias();
    UI.renderContasCards();

    // 🔥 Inicializa aplicação
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
   
   document.getElementById("dash-prev")?.addEventListener("click", async () => {
  mesDashboardAtual.setMonth(mesDashboardAtual.getMonth() - 1);
  await atualizarDashboardPorMes();
});

document.getElementById("dash-next")?.addEventListener("click", async () => {
  mesDashboardAtual.setMonth(mesDashboardAtual.getMonth() + 1);
  await atualizarDashboardPorMes();
});

})(); 
