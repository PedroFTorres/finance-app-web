// cartao.js — Versão atualizada com modal de escolha de conta ao fechar fatura
// Mantém todas as funcionalidades: CRUD cartões, faturas, lançamentos parcelados,
// edição de parcelas, antecipação, pagamento antecipado, fechar/pagar/reabrir fatura,
// histórico, toasts, modais.
// Observação: supabase deve estar disponível em window.supabase (carregado antes).

function initCartaoPage() {
  if (window.__cartaoPageInitialized) return;
  window.__cartaoPageInitialized = true;

  // ===========================// TOAST SIMPLES // ===========================
  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) { alert(message); return; }

    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "error") toast.classList.add("error");
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function createTextElement(tag, text, className = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = String(text ?? "");
    return el;
  }

  function isContaInvestimento(conta) {
    return String(conta?.tipo_conta || "").toLowerCase() === "investimento";
  }

  function contaPagamentoLabel(conta, todas = []) {
    const nome = String(conta?.nome || "");
    const nomeRepetido = (todas || []).filter(c => String(c.nome || "") === nome).length > 1;
    const tipo = String(conta?.tipo_conta || "corrente").toLowerCase();

    if (tipo === "investimento") return `${nome} (Investimento)`;
    if (!nomeRepetido) return nome;
    if (tipo === "poupanca" || tipo === "poupança") return `${nome} (Poupança)`;
    return `${nome} (Conta corrente)`;
  }

  const BANK_CATALOG = [
    { code: 'santander', name: 'Santander', aliases: ['santander'], initials: 'S', logo: 'assets/banks/santander.svg', color: '#e1251b', bg: '#fff1f1' },
    { code: 'bb', name: 'Banco do Brasil', aliases: ['banco do brasil', 'bb'], initials: 'BB', logo: 'assets/banks/bb.svg', color: '#f8d117', bg: '#fff8cc' },
    { code: 'caixa', name: 'Caixa Econômica Federal', aliases: ['caixa', 'cef', 'caixa economica'], initials: 'CX', logo: 'assets/banks/caixa.svg', color: '#005ca9', bg: '#eaf5ff' },
    { code: 'itau', name: 'Itaú', aliases: ['itau', 'itaú'], initials: 'IT', color: '#ec7000', bg: '#fff2e8' },
    { code: 'bradesco', name: 'Bradesco', aliases: ['bradesco'], initials: 'BR', color: '#cc092f', bg: '#fff0f3' },
    { code: 'nubank', name: 'Nubank', aliases: ['nubank', 'nu bank', 'nu'], initials: 'NU', color: '#820ad1', bg: '#f7edff' },
    { code: 'inter', name: 'Inter', aliases: ['inter', 'banco inter'], initials: 'IN', color: '#ff7a00', bg: '#fff3e6' },
    { code: 'wallet', name: 'Carteira', aliases: ['carteira', 'dinheiro', 'cash'], initials: '💵', color: '#16a34a', bg: '#ecfdf3' },
    { code: 'other', name: 'Outro banco', aliases: [], initials: '🏦', color: '#7c4dff', bg: '#f4f0ff' }
  ];

  function normalizeBankText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function detectBankFromName(name) {
    const normalized = normalizeBankText(name);
    return BANK_CATALOG.find(bank => bank.aliases.some(alias => normalized.includes(normalizeBankText(alias))))
      || BANK_CATALOG[BANK_CATALOG.length - 1];
  }

  function createBankLogo(bank) {
    const logo = document.createElement('span');
    logo.className = 'bank-logo';
    logo.style.setProperty('--bank-color', bank.color || '#7c4dff');
    logo.style.setProperty('--bank-bg', bank.bg || '#f4f0ff');
    logo.textContent = bank.initials || '🏦';

    if (bank.logo) {
      const img = document.createElement('img');
      img.src = bank.logo;
      img.alt = `Logo ${bank.name}`;
      img.loading = 'lazy';
      img.addEventListener('load', () => {
        logo.textContent = '';
        logo.classList.add('bank-logo-with-image');
        logo.appendChild(img);
      }, { once: true });
    }

    logo.setAttribute('aria-hidden', 'true');
    return logo;
  }

  function createContaOptionContent(conta, todas = []) {
    const frag = document.createDocumentFragment();
    const bank = detectBankFromName(conta?.nome);
    frag.appendChild(createBankLogo(bank));

    const text = document.createElement('span');
    text.className = 'conta-logo-select-text';

    const nome = document.createElement('strong');
    nome.textContent = contaPagamentoLabel(conta, todas);
    text.appendChild(nome);

    const detalhe = document.createElement('small');
    detalhe.textContent = bank.name;
    text.appendChild(detalhe);

    frag.appendChild(text);
    return frag;
  }

  function renderContaLogoSelect({ selectId, containerId, contas, emptyText = 'Nenhuma conta de pagamento disponível' }) {
    const select = document.getElementById(selectId);
    const container = document.getElementById(containerId);
    if (!select || !container) return;

    select.classList.add('hidden');
    container.innerHTML = '';
    container.classList.add('conta-logo-select');

    if (!contas || contas.length === 0) {
      container.innerHTML = `<p class="conta-logo-select-empty">${emptyText}</p>`;
      return;
    }

    if (!select.value || !contas.some(conta => conta.id === select.value)) {
      select.value = contas[0].id;
    }

    const selected = contas.find(conta => conta.id === select.value) || contas[0];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conta-logo-select-button';
    button.appendChild(createContaOptionContent(selected, contas));

    const arrow = document.createElement('span');
    arrow.className = 'conta-logo-select-arrow';
    arrow.textContent = '▾';
    button.appendChild(arrow);

    const menu = document.createElement('div');
    menu.className = 'conta-logo-select-menu hidden';

    contas.forEach(conta => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'conta-logo-select-option';
      if (conta.id === select.value) option.classList.add('selected');
      option.appendChild(createContaOptionContent(conta, contas));
      option.addEventListener('click', () => {
        select.value = conta.id;
        menu.classList.add('hidden');
        renderContaLogoSelect({ selectId, containerId, contas, emptyText });
      });
      menu.appendChild(option);
    });

    button.addEventListener('click', () => {
      document.querySelectorAll('.conta-logo-select-menu').forEach(item => {
        if (item !== menu) item.classList.add('hidden');
      });
      menu.classList.toggle('hidden');
    });

    container.appendChild(button);
    container.appendChild(menu);
  }

  function popularSelectContasPagamento(select, contas = [], { mostrarSaldo = false } = {}) {
    if (!select) return [];

    const contasPagamento = (contas || []).filter(c => !isContaInvestimento(c));
    select.innerHTML = "";

    contasPagamento.forEach(c => {
      const saldo = mostrarSaldo ? ` - ${formatReal(c.saldo_atual || 0)}` : "";
      select.appendChild(new Option(`${contaPagamentoLabel(c, contasPagamento)}${saldo}`, c.id));
    });

    if (contasPagamento.length === 0) {
      select.appendChild(new Option("Nenhuma conta de pagamento disponível", ""));
    }

    return contasPagamento;
  }

  // ===========================// ESTADO // ===========================
  const state = {
    user: null,
    profile: null,
    cards: [],
    categories: [],
    editingPurchaseFull: null,       // para edição parcelada
    editingPurchaseParcels: [],      // parcelas em edição
    faturaAtual: null,
  };

  // ===========================// ELEMENTOS DO DOM // ===========================
  
  const btnBack = document.getElementById("btn-back");
  const btnLogout = document.getElementById("btn-logout");
  const userEmail = document.getElementById("user-email");
  const cardsList = document.getElementById("cards-list");
  const btnNewCard = document.getElementById("btn-new-card");
  let IS_SAVING_CARD = false;

  const viewNewCard = document.getElementById("view-new-card");
  const viewFaturas = document.getElementById("view-faturas");
  const viewLancamento = document.getElementById("view-lancamento");
  const viewHistorico = document.getElementById("view-historico");
  const boxPagAntecipado = document.getElementById("box-pag-antecipado");
  const modalEditarCompra = document.getElementById("modal-editar-compra");
  let viewEditarAvista = document.getElementById("view-editar-avista"); // pode ser criado dinamicamente
  let activeCardId = null;

 
  const btnSaveCard = document.getElementById("btn-save-card");
  const btnCancelCard = document.getElementById("btn-cancel-card");
  const btnLancarCompra = document.getElementById("btn-lancar-compra");

  const cardNome = document.getElementById("card-nome");
  const cardLimite = document.getElementById("card-limite");
  const cardDiaFechamento = document.getElementById("card-dia-fechamento");
  const cardDiaVencimento = document.getElementById("card-dia-vencimento");

 
  const selectMesFaturas = document.getElementById("select-mes-faturas");
  const faturaTitulo = document.getElementById("fatura-titulo");
  const faturaPeriodo = document.getElementById("fatura-periodo");
  const faturaTotal = document.getElementById("fatura-total");
  const listaComprasFatura = document.getElementById("lista-fatura");

  const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");
  const cartDesc = document.getElementById("cart-desc");
  const cartValor = document.getElementById("cart-valor");
  const cartData = document.getElementById("cart-data");
  const cartParcelas = document.getElementById("cart-parcelas");

  
  const btnFatPrev = document.getElementById("fat-prev");
  const btnFatNext = document.getElementById("fat-next");
  const fatDisplay = document.getElementById("fat-display");

  const selectFaturaInicial = document.getElementById("select-fatura-inicial");

  const selectContaPagamento = document.getElementById("conta-pagamento");
  const dataVencimentoFatura = document.getElementById("conta-fatura-vencimento");
  const btnFecharFatura = document.getElementById("btn-fechar-fatura");
  if (btnFecharFatura) {
  btnFecharFatura.onclick = () => {
    console.log("FECHAR FATURA CLICADO");
  };
}
  const btnPagarFatura = document.getElementById("btn-pagar-fatura");

  const btnAddPurchase = document.getElementById("btn-add-purchase");
  const btnCancelPurchase = document.getElementById("btn-cancel-purchase");
 document.addEventListener("click", (event) => {
  if (!event.target.closest(".conta-logo-select")) {
    document
      .querySelectorAll(".conta-logo-select-menu")
      .forEach(menu => menu.classList.add("hidden"));
  }
});
 if (btnCancelPurchase) {
  btnCancelPurchase.onclick = () => {

    // limpar campos
    if (cartDesc) cartDesc.value = "";
    if (cartValor) cartValor.value = "";
    if (cartParcelas) cartParcelas.value = 1;
    if (cartData) cartData.value = "";

    // fechar modal
    document
      .getElementById("modal-lancamento")
      .classList.add("hidden");
  };
}

  const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
  const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
  const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
  const dataPagAntecipado = document.getElementById("data-pag-antecipado");
  const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");

  const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

  const modalEditarParcela = document.getElementById("modal-editar-parcela");
  const modalParcelaValor = document.getElementById("modal-parcela-valor");
  const modalParcelaData = document.getElementById("modal-parcela-data");
  const modalParcelaSalvar = document.getElementById("modal-parcela-salvar");
  const modalParcelaCancelar = document.getElementById("modal-parcela-cancelar");

  // Modal de escolha de conta para fechar fatura (assumindo que você adicionou no HTML)
  const modalContaFatura = document.getElementById("modal-conta-fatura");
  const contaFaturaSelect = document.getElementById("conta-fatura-select");
  const contaFaturaCancelar = document.getElementById("conta-fatura-cancelar");
  const contaFaturaConfirmar = document.getElementById("conta-fatura-confirmar");

if (contaFaturaCancelar) {
  contaFaturaCancelar.onclick = () => {
    modalContaFatura.classList.add("hidden");
  };
}

if (contaFaturaConfirmar) {
  contaFaturaConfirmar.onclick = async () => {
    const contaId = contaFaturaSelect.value;

    if (!contaId) {
      showToast("Selecione uma conta.", "error");
      return;
    }

    modalContaFatura.classList.add("hidden");
    await fecharFaturaComConta(contaId);
  };
}


  const toastContainer = document.getElementById("toast-container");

  let mesFatura = new Date();
  let mesLanc = new Date();
 
  // =========================== // HELPERS // ===========================
  function formatReal(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDateBR(value) {
    if (!value) return "-";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  }

  function limparDescricaoParcela(descricao = "") {
    return String(descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
  }

  function distribuirValorEmParcelas(total, quantidade) {
    const totalCentavos = Math.round(Number(total || 0) * 100);
    const qtd = Math.max(Number(quantidade || 1), 1);
    const base = Math.floor(totalCentavos / qtd);
    const resto = totalCentavos - base * qtd;

    return Array.from({ length: qtd }, (_, index) => {
      const centavos = base + (index < resto ? 1 : 0);
      return Number((centavos / 100).toFixed(2));
    });
  }

  function atualizarTotalEdicaoAPartirParcelas() {
    const elValor = document.getElementById("edit-valor-total");
    if (!elValor) return;
    const total = (state.editingPurchaseParcels || []).reduce((s, p) => s + Number(p.valor || 0), 0);
    elValor.value = total.toFixed(2);
  }

  function recalcularParcelasPeloTotal() {
    const elValor = document.getElementById("edit-valor-total");
    const parcelas = state.editingPurchaseParcels || [];
    if (!elValor || parcelas.length <= 1) return;

    const novosValores = distribuirValorEmParcelas(elValor.value, parcelas.length);
    state.editingPurchaseParcels = parcelas.map((p, index) => ({
      ...p,
      valor: novosValores[index] ?? 0
    }));
    renderParcelasEdicao();
  }

  function formatISO(d) {
    return new Date(d).toISOString().slice(0,10);
  }

  function hasPremiumAccess(profile) {
    const plano = String(profile?.plano || "").toLowerCase();
    const status = String(profile?.subscription_status || "").toLowerCase();
    return (plano === "pro" || plano === "vip") && status === "active";
  }

  async function requirePremiumAccess() {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("plano, subscription_status")
      .eq("id", state.user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao validar acesso premium:", error);
      alert("Nao foi possivel validar seu plano agora. Tente novamente.");
      window.location.href = "app.html";
      return false;
    }

    state.profile = profile;

    if (!hasPremiumAccess(profile)) {
      alert("Cartao disponivel apenas no plano PRO.");
      window.location.href = "upgrade.html";
      return false;
    }

    return true;
  }

  function getCardGradient(i) {
  const gradients = [
    // roxo premium (principal)
    "linear-gradient(135deg, #5f4dff, #7b6dff)",

    // azul escuro elegante
    "linear-gradient(135deg, #1f3c88, #3a6df0)",

    // cinza grafite (corporativo)
    "linear-gradient(135deg, #2c2c2c, #4b4b4b)",

    // verde escuro discreto
    "linear-gradient(135deg, #1f7a63, #2ea98c)"
  ];

  return gradients[i % gradients.length];
}

  // get or create categoria helper
 async function getOrCreateCategoria(nome) {
  const { data } = await supabase
    .from("categorias")
    .select("id")
    .eq("nome", nome)
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (data) return data.id;

  const { data: created, error } = await supabase
    .from("categorias")
    .insert([{
      id: crypto.randomUUID(),
      nome,
      user_id: state.user.id
    }])
    .select("id")
    .single();

  if (error) throw error;

  return created.id;
}

function computeContaBalance(conta, movs = []) {
  const saldoInicial = Number(conta?.saldo_inicial || 0);
  const dataSaldo = conta?.data_saldo || null;
  const moneyEq = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.000001;
  let saldo = saldoInicial;
  let saldoInicialJaRepresentadoNoCampo = false;

  (movs || []).forEach(m => {
    const valor = Number(m.valor || 0);
    const isSaldoInicialDuplicado =
      !saldoInicialJaRepresentadoNoCampo &&
      m.tipo === "credito" &&
      String(m.descricao || "").trim().toLowerCase() === "saldo inicial" &&
      moneyEq(valor, saldoInicial) &&
      (!dataSaldo || m.data === dataSaldo);

    if (isSaldoInicialDuplicado) {
      saldoInicialJaRepresentadoNoCampo = true;
      return;
    }

    saldo += m.tipo === "credito" ? valor : -valor;
  });

  return saldo;
}

async function recalcularSaldoConta(contaId) {
  if (!contaId) return null;

  const { data: conta, error: errConta } = await supabase
    .from("contas_bancarias")
    .select("saldo_inicial,data_saldo")
    .eq("id", contaId)
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (errConta) throw errConta;

  const { data: movs, error: errMovs } = await supabase
    .from("movimentacoes")
    .select("tipo,valor,descricao,data")
    .eq("conta_id", contaId)
    .eq("user_id", state.user.id);

  if (errMovs) throw errMovs;

  const saldo = computeContaBalance(conta, movs || []);

  const { error: errUpdate } = await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: saldo })
    .eq("id", contaId)
    .eq("user_id", state.user.id);

  if (errUpdate) throw errUpdate;

  return saldo;
}

  function hideAllViews() {
  [
    viewNewCard,
    viewFaturas,
    viewLancamento,
    viewHistorico,
    boxPagAntecipado,
    viewEditarAvista
  ].forEach(v => v?.classList.add("hidden"));
}

function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}
function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}


  // =========================== // SESSÃO // ===========================
(async () => {
  const sessionResp = await supabase.auth.getSession();

  if (!sessionResp.data.session) {
    window.location.href = "login.html";
    return;
  }

  state.user = sessionResp.data.session.user;

  if (userEmail)
    userEmail.textContent = state.user.email;

  const canAccessCartao = await requirePremiumAccess();
  if (!canAccessCartao) return;

 try {
  await loadCards();
  renderCardsSidebar(); // 🔥 FALTAVA ISSO
  await loadCategorias();

  mesFatura = new Date();
  await definirMesInicialAberto();
  await loadFaturaForSelected(); // 🔥 importante também


  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar dados.", "error");
  }
})();


  // ===========================// NAV / BOTÕES - Back e Logout // ===========================
  if (btnBack) btnBack.onclick = () => {
    if (history.length > 1) history.back();
    else window.location.href = "app.html";
  };
  if (btnLogout) btnLogout.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  };

  // atalhos no painel esquerdo
  const navFatura = document.getElementById("nav-fatura");
  const navLancamento = document.getElementById("nav-lancamento");
  const navHistorico = document.getElementById("nav-historico");

  if (navFatura) navFatura.onclick = async () => { await loadFaturaForSelected(); };
  if (navLancamento) navLancamento.onclick = async () => { await loadSelectsForLanc(); popularFaturasLancamento(); showView(viewLancamento); };
  if (navHistorico) navHistorico.onclick = async () => { await loadHistoricoFaturas(); showView(viewHistorico); };
  const btnVoltarEdicao = document.getElementById("btn-voltar-edicao");
if (btnVoltarEdicao) {
  btnVoltarEdicao.onclick = () => {
  };
}

  // =========================== // CARDS — carregar / renderizar / excluir// ===========================
  
  async function loadCards() {
    const { data } = await supabase.from("cartoes_credito")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false });

    state.cards = data || [];
    
  }

function renderCardsSidebar() {

  if (!cardsList) return;

  cardsList.innerHTML = "";

  if (!state.cards || state.cards.length === 0) {
    cardsList.innerHTML = "<p>Nenhum cartão cadastrado</p>";
    return;
  }

  if (!activeCardId) {
    activeCardId = state.cards[0].id;
  }

  state.cards.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "card-tile" + (c.id === activeCardId ? " active" : "");
    el.style.background = getCardGradient(i);

    el.appendChild(createTextElement("div", c.nome, "nome"));
    el.appendChild(createTextElement("div", `Limite: ${formatReal(c.limite)}`, "info"));
    el.appendChild(createTextElement(
      "div",
      `Fecha ${c.dia_fechamento} • Venc ${c.dia_vencimento}`,
      "info"
    ));

 el.onclick = async () => {
  activeCardId = c.id;

  renderCardsSidebar();

  // 🔥 CARREGAR A FATURA DO CARTÃO SELECIONADO
  mesFatura = new Date();
  await definirMesInicialAberto();
  await loadFaturaForSelected();
};

    cardsList.appendChild(el);
  });
}
  // ===========================// CATEGORIAS // ===========================
async function loadCategorias() {
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .eq("user_id", state.user.id)
    .order("nome");

  state.categories = data || [];

  if (selectCategoriaLancCartao) {
    selectCategoriaLancCartao.innerHTML = "";
    state.categories.forEach(cat => {
      selectCategoriaLancCartao.appendChild(
        new Option(cat.nome, cat.id)
      );
    });
  }
}

// ========================= // MES NAV // =========================

function popularMesFatura() {
  if (!fatDisplay) return;

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];

  fatDisplay.textContent =
    `${meses[mesFatura.getMonth()]} ${mesFatura.getFullYear()}`;
}

function atualizarEstadoBotoesMes() {
  if (btnFatPrev) btnFatPrev.disabled = false;
  if (btnFatNext) btnFatNext.disabled = false;
}
async function definirMesInicialAberto() {
  // garante cartão ativo
  if (!activeCardId) {
    if (state.cards && state.cards.length > 0) {
      activeCardId = state.cards[0].id;
    } else {
      return;
    }
  }

  // começa no mês atual
  let cursor = new Date(
    mesFatura.getFullYear(),
    mesFatura.getMonth(),
    1
  );

  // segurança: até 24 meses
  for (let i = 0; i < 24; i++) {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth() + 1;

    // 1️⃣ busca a fatura
    const { data: fatura } = await supabase
      .from("cartao_faturas")
      .select("id, status")
      .eq("user_id", state.user.id)
      .eq("cartao_id", activeCardId)
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle();

    // 👉 se não existe fatura, é mês válido
   if (!fatura) {
  mesFatura = new Date(ano, mes - 1, 1);
  popularMesFatura();
  return;
}


    // 2️⃣ se fatura está FECHADA, verifica se já virou despesa
    if (fatura.status === "fechada") {
      const { data: despesa } = await supabase
        .from("despesas")
        .select("id")
        .eq("cartao_fatura_id", fatura.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

      // 👉 fechada + despesa gerada → PULA
      if (despesa) {
        cursor.setMonth(cursor.getMonth() + 1);
        continue;
      }
    }

    // 👉 qualquer outro caso: este mês é o principal
    mesFatura = new Date(ano, mes - 1, 1);
    popularMesFatura();
    return;
  }
}

// =========================// NAVEGAÇÃO DE FATURA (MÊS)// =========================
  
// ◀ mês anterior
if (btnFatPrev) {
  btnFatPrev.onclick = async () => {
    mesFatura.setMonth(mesFatura.getMonth() - 1);
    popularMesFatura();
atualizarEstadoBotoesMes();
await loadFaturaForSelected();

  };
}

// ▶ próximo mês
if (btnFatNext) {
  btnFatNext.onclick = async () => {
    mesFatura.setMonth(mesFatura.getMonth() + 1);
    popularMesFatura();
    atualizarEstadoBotoesMes();
    await loadFaturaForSelected();
  };
}

  // =========================== // CARREGAR FATURA / RENDER (USANDO data_fatura) // ===========================
  
async function loadFaturaForSelected() {
  if (!activeCardId && state.cards?.length) {
    activeCardId = state.cards[0].id;
  }
  if (!activeCardId) return;

  const cartao_id = activeCardId;

  // 🔥 REGRA: se a fatura do mês atual estiver PAGA,
  // pula automaticamente para a próxima ABERTA
  while (true) {
    const ano = mesFatura.getFullYear();
    const mesZero = mesFatura.getMonth();
    const mes = mesZero + 1;

    const { data: faturaDB } = await supabase
      .from("cartao_faturas")
      .select("*")
      .eq("user_id", state.user.id)
      .eq("cartao_id", cartao_id)
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle();

    // 👉 se NÃO existe fatura ou ela NÃO está paga → usar esse mês
    if (!faturaDB || !faturaDB.pago) {
      state.faturaAtual = faturaDB || {
        ano,
        mes,
        status: "aberta",
        pago: false
      };
      break;
    }

    // 👉 se está PAGA, pula para o próximo mês
    mesFatura.setMonth(mesFatura.getMonth() + 1);
  }

  const ano = mesFatura.getFullYear();
  const mesZero = mesFatura.getMonth();
  const mes = mesZero + 1;

  const inicio = new Date(ano, mesZero, 1).toISOString().slice(0, 10);
  const fim = new Date(ano, mesZero + 1, 0).toISOString().slice(0, 10);

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .eq("user_id", state.user.id)
    .gte("data_fatura", inicio)
    .lte("data_fatura", fim)
    .order("data_compra", { ascending: true })
    .order("data_fatura", { ascending: true });

  const card = state.cards.find(c => c.id === cartao_id);

  const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);

  faturaTitulo.textContent = card?.nome || "Cartão";
  faturaPeriodo.textContent = `${String(mes).padStart(2, "0")}/${ano}`;
  faturaTotal.textContent = total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  listaComprasFatura.innerHTML = "";

  if (!compras || compras.length === 0) {
    listaComprasFatura.innerHTML = `
      <li class="fatura-empty">
        Nenhuma compra lançada nesta fatura
      </li>
    `;
  } else {
   compras.forEach(c => {

  const li = document.createElement("li");
  li.className = c.tipo === "pagamento" ? "fatura-row fatura-row-pagamento" : "fatura-row";

  const valorFormatado = Number(c.valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const valorClasse = c.tipo === "pagamento"
    ? "valor-pagamento"
    : "fatura-valor";

  const dataCompra = formatDateBR(c.data_compra || c.data_fatura);
  const dataFatura = formatDateBR(c.data_fatura);
  const descricaoBase = limparDescricaoParcela(c.descricao);
  const parcelaLabel = Number(c.parcelas || 1) > 1
    ? `${c.parcela_atual || 1}/${c.parcelas}`
    : "À vista";

  const dataEl = createTextElement("span", dataCompra, "fatura-data");

  const infoEl = document.createElement("span");
  infoEl.className = "fatura-info";
  infoEl.appendChild(createTextElement("strong", descricaoBase, "fatura-desc"));
  const meta = c.tipo === "pagamento"
    ? "Pagamento / abatimento na fatura"
    : `Compra em ${dataCompra}${dataFatura !== dataCompra ? ` • Fatura ${dataFatura}` : ""}`;
  infoEl.appendChild(createTextElement("small", meta, "fatura-meta"));

  const parcelaEl = createTextElement("span", parcelaLabel, "fatura-parcela");
  const valorEl = createTextElement("strong", valorFormatado, valorClasse);

  li.append(dataEl, infoEl, parcelaEl, valorEl);

  li.onclick = () => abrirFluxoEdicaoCompra(c);

  listaComprasFatura.appendChild(li);
});
  }

  popularMesFatura();
  updateButtonsForFatura();
}
  // ===========================// UPDATE BUTTONS FOR FATURA // ===========================
  function updateButtonsForFatura() {
    const existingReabrir = document.getElementById("btn-reabrir-fatura");
    if (existingReabrir) existingReabrir.remove();
    const statusEl = document.getElementById("status-fatura");

    if (state.faturaAtual) {
     
      if (state.faturaAtual.pago) {
        if (btnPagarFatura) { btnPagarFatura.disabled = true; btnPagarFatura.textContent = "Fatura Paga"; }
        if (statusEl) statusEl.textContent = "FATURA PAGA";
        return;
      }

      if (btnPagarFatura) { btnPagarFatura.disabled = false; btnPagarFatura.textContent = "Pagar Fatura"; }
      if (statusEl) statusEl.textContent = "FATURA FECHADA";

      if (btnFecharFatura && btnFecharFatura.parentNode && !document.getElementById("btn-reabrir-fatura")) {
        const btn = document.createElement("button");
        btn.id = "btn-reabrir-fatura";
        btn.className = "btn-secondary";
        btn.style.marginLeft = "8px";
        btn.textContent = "Reabrir Fatura";
        btn.onclick = reabrirFatura;
        btnFecharFatura.parentNode.appendChild(btn);
      }

    } else {
      if (btnPagarFatura) { btnPagarFatura.disabled = false; btnPagarFatura.textContent = "Gerar Despesa"; }
      if (statusEl) statusEl.textContent = "";
    }
  }

  // ===========================// Funções auxiliares para modal de escolha de conta ao fechar fatura (OPÇÃO B) // ===========================
  
  async function carregarContasModal() {
  if (!contaFaturaSelect) return;

  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("id, nome, tipo_conta")
    .eq("user_id", state.user.id)
    .order("nome");

  const contasPagamento = popularSelectContasPagamento(contaFaturaSelect, contas || []);
  renderContaLogoSelect({
    selectId: "conta-fatura-select",
    containerId: "conta-fatura-select-ui",
    contas: contasPagamento
  });
}

async function fecharFaturaComConta(conta_id) {
  try {
    if (!activeCardId) {
      showToast("Selecione um cartão.", "error");
      return;
    }

    const ano = mesFatura.getFullYear();
    const mesZero = mesFatura.getMonth();
    const mes = mesZero + 1;

    const inicio = new Date(ano, mesZero, 1)
      .toISOString()
      .slice(0, 10);

    const fim = new Date(ano, mesZero + 1, 0)
      .toISOString()
      .slice(0, 10);

    const venc = document.getElementById("conta-fatura-vencimento")?.value;

    if (!venc) {
      showToast("Informe o vencimento.", "error");
      return;
    }

    // 🔹 buscar compras do mês
    const { data: compras, error: errCompras } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", activeCardId)
      .eq("user_id", state.user.id)
      .gte("data_fatura", inicio)
      .lte("data_fatura", fim);

    if (errCompras) throw errCompras;

    const total = (compras || []).reduce(
      (s, c) => s + Number(c.valor || 0),
      0
    );

    // 🔹 cria registro da fatura
    const { data: fData, error: errFatura } = await supabase
      .from("cartao_faturas")
      .insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        cartao_id: activeCardId,
        mes,
        ano,
        data_vencimento: venc,
        valor_total: total,
        status: "fechada"
      }])
      .select()
      .single();

    if (errFatura) throw errFatura;

    // 🔹 categoria padrão
    const categoriaId = await getOrCreateCategoria("Cartão de Crédito");

    const card =
      state.cards.find(c => c.id === activeCardId) || { nome: "Cartão" };

    // 🔹 cria despesa
    await supabase.from("despesas").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      conta_id: conta_id,
      descricao: `Fatura ${card.nome} — ${String(mes).padStart(2, "0")}/${ano}`,
      valor: total,
      data: venc,
      categoria_id: categoriaId,
      baixado: false,
      cartao_fatura_id: fData.id
    }]);

        showToast("Fatura fechada com sucesso!", "success");

    // 🔥 Avança para o próximo mês
    mesFatura.setMonth(mesFatura.getMonth() + 1);
    popularMesFatura();
    await loadFaturaForSelected();

  } catch (err) {
    console.error("Erro ao fechar fatura:", err);
    showToast("Erro ao fechar fatura.", "error");
  }
}


 // ===========================// FECHAR FATURA → apenas abre o modal// ===========================
  
if (btnFecharFatura) {
  btnFecharFatura.onclick = async () => {
    console.log("CLICOU EM FECHAR FATURA");

    if (!activeCardId) {
      showToast("Selecione um cartão.", "error");
      return;
    }

    if (state.faturaAtual?.status === "fechada") {
      showToast("Esta fatura já está fechada.", "error");
      return;
    }

    // 🔽 carrega contas no select do modal
    await carregarContasModal();

    // 🔽 abre o modal (SEM validar vencimento aqui)
    modalContaFatura.classList.remove("hidden");
  };
}

  // ===========================// PAGAR FATURA → baixa a despesa vinculada, cria movimentação e atualiza saldo// ===========================
if (btnPagarFatura) {
  btnPagarFatura.onclick = async () => {
    try {
      if (!state.faturaAtual) {
        showToast("Nenhuma fatura selecionada.", "error");
        return;
      }

      if (state.faturaAtual.pago) {
        showToast("Esta fatura já está paga.", "warning");
        return;
      }

      const contaId = selectContaPagamento.value;
      const venc = dataVencimentoFatura.value;

      if (!contaId || !venc) {
        showToast("Informe conta e data.", "error");
        return;
      }

      const total = Number(state.faturaAtual.valor_total || 0);
      if (total <= 0) {
        showToast("Fatura sem valor.", "error");
        return;
      }

      // 🔹 localizar despesa vinculada
      const { data: desp } = await supabase
        .from("despesas")
        .select("*")
        .eq("cartao_fatura_id", state.faturaAtual.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

      if (!desp) {
        showToast("Despesa da fatura não encontrada.", "error");
        return;
      }

      const categoriaId = desp.categoria_id || await getOrCreateCategoria("Cartão de Crédito");

      // 🔹 baixa despesa
      await supabase
        .from("despesas")
        .update({
          baixado: true,
          conta_id: contaId,
          data_baixa: venc,
          categoria_id: categoriaId
        })
        .eq("id", desp.id)
        .eq("user_id", state.user.id);

      // 🔹 movimentação
      await supabase.from("movimentacoes").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        conta_id: contaId,
        tipo: "debito",
        valor: total,
        descricao: `Pagamento fatura ${state.faturaAtual.mes}/${state.faturaAtual.ano}`,
        data: venc,
        lancamento_id: desp.id
      }]);

      await recalcularSaldoConta(contaId);

      // 🔹 marcar fatura como PAGA
      await supabase
        .from("cartao_faturas")
        .update({
          pago: true,
          status: "paga"
        })
        .eq("id", state.faturaAtual.id)
        .eq("user_id", state.user.id);

      showToast("Fatura paga com sucesso!", "success");

      // ======================================================// 🔥 REGRA PRINCIPAL (FINAL)// após PAGAR, mostrar a próxima fatura ABERTA// ======================================================

      let proximo = new Date(
        state.faturaAtual.ano,
        state.faturaAtual.mes,
        1
      );

      while (true) {
        const a = proximo.getFullYear();
        const m = proximo.getMonth() + 1;

        const { data: fatura } = await supabase
          .from("cartao_faturas")
          .select("status")
          .eq("user_id", state.user.id)
          .eq("cartao_id", activeCardId)
          .eq("ano", a)
          .eq("mes", m)
          .maybeSingle();

        // só para quando achar ABERTA ou inexistente
        if (!fatura || fatura.status === "aberta") {
          mesFatura = new Date(a, m - 1, 1);
          break;
        }

        proximo.setMonth(proximo.getMonth() + 1);
      }

      popularMesFatura();
      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      showToast("Erro ao pagar fatura.", "error");
    }
  };
}

  // ===========================// REABRIR FATURA// ===========================
  async function reabrirFatura() {
    if (!state.faturaAtual) return showToast("Nenhuma fatura selecionada.", "error");
    if (state.faturaAtual.pago) return showToast("Não é possível reabrir fatura paga.", "error");
    if (!confirm("Deseja realmente reabrir esta fatura?")) return;

    try {
      const { error } = await supabase
        .from("cartao_faturas")
        .delete()
        .eq("id", state.faturaAtual.id)
        .eq("user_id", state.user.id);
      if (error) {
        console.error(error);
        return showToast("Erro ao reabrir fatura.", "error");
      }

      state.faturaAtual = null;
      await loadFaturaForSelected();
      showToast("Fatura reaberta com sucesso.");

    } catch (err) {
      console.error(err);
      showToast("Erro ao reabrir fatura.", "error");
    }
  }

 // ====================== LANÇAR COMPRA (PARCELADA) ======================
let IS_SAVING_PURCHASE = false;

if (btnAddPurchase) {
  btnAddPurchase.onclick = async () => {

    // evita duplo clique
    if (IS_SAVING_PURCHASE) return;
    IS_SAVING_PURCHASE = true;

    const originalText = btnAddPurchase.textContent;
    btnAddPurchase.textContent = "Processando...";
    btnAddPurchase.disabled = true;

    try {
      // ================= VALIDAÇÕES =================
      if (!state.cartaoLancamentoAtual) {
        showToast("Selecione um cartão primeiro.", "warning");
        return;
      }

      const descricao = cartDesc?.value?.trim();
      const valor = Number(cartValor?.value);
      const dataCompra = cartData?.value;
      const parcelas = Number(cartParcelas?.value || 1);
      const categoriaId = selectCategoriaLancCartao?.value || null;
      const faturaInicial = selectFaturaInicial?.value;

      if (!descricao || !valor || !dataCompra) {
        showToast("Preencha todos os campos obrigatórios.", "warning");
        return;
      }

      if (valor <= 0) {
        showToast("O valor deve ser maior que zero.", "warning");
        return;
      }

      // ================= CÁLCULOS =================
      const valorParcela = Number((valor / parcelas).toFixed(2));
      // fatura inicial vem no formato YYYY-MM
const [anoFatura, mesFatura] = faturaInicial.split("-").map(Number);

// base da fatura (sempre dia 01)
let dataBase = new Date(anoFatura, mesFatura - 1, 1);

      // ================= INSERT =================
    for (let p = 1; p <= parcelas; p++) {

  const dataFatura = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + (p - 1),
    1
  );

  const dataFaturaISO = dataFatura.toISOString().slice(0, 10);

  await supabase.from("cartao_lancamentos").insert([{
    id: crypto.randomUUID(),
    user_id: state.user.id,
    cartao_id: state.cartaoLancamentoAtual,
    descricao: parcelas > 1
      ? `${descricao} (${p}/${parcelas})`
      : descricao,
    valor: valorParcela,
    data_compra: dataCompra,
    data_fatura: dataFaturaISO, // ✅ AGORA CORRETO
    parcelas,
    parcela_atual: parcelas > 1 ? p : 0,
    categoria_id: categoriaId,
    tipo: "compra",
    billed: false
  }]);
}

      // ================= LIMPEZA =================
      if (cartDesc) cartDesc.value = "";
      if (cartValor) cartValor.value = "";
      if (cartParcelas) cartParcelas.value = 1;
      if (cartData) cartData.value = "";

      showToast("Compra lançada com sucesso!");

   document
  .getElementById("modal-lancamento")
  .classList.add("hidden");


      // recarrega fatura
      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      showToast("Erro ao lançar compra.", "error");

    } finally {
      IS_SAVING_PURCHASE = false;
      btnAddPurchase.disabled = false;
      btnAddPurchase.textContent = originalText;
    }
  };
}

 // ===========================// PAGAMENTO PARCIAL COMPLETO (PROFISSIONAL)// ===========================

const btnPagParcial = document.getElementById("btn-pagamento-parcial");
const modalPagParcial = document.getElementById("modal-pagamento-parcial");
const btnConfirmarPagParcial = document.getElementById("btn-confirmar-pag-parcial");
const btnCancelarPagParcial = document.getElementById("btn-cancelar-pag-parcial");

// 🔹 ABRIR MODAL
if (btnPagParcial) {
  btnPagParcial.onclick = async () => {

    if (!activeCardId) {
      showToast("Selecione um cartão.", "error");
      return;
    }

    const selectConta = document.getElementById("pag-parcial-conta");

    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("id, nome, tipo_conta")
      .eq("user_id", state.user.id)
      .order("nome");

    const contasPagamento = popularSelectContasPagamento(selectConta, contas || []);
    renderContaLogoSelect({
      selectId: "pag-parcial-conta",
      containerId: "pag-parcial-conta-ui",
      contas: contasPagamento
    });

    document.getElementById("pag-parcial-valor").value = "";
    document.getElementById("pag-parcial-data").value =
      new Date().toISOString().slice(0,10);

    modalPagParcial.classList.remove("hidden");
  };
}

// 🔹 CANCELAR
if (btnCancelarPagParcial) {
  btnCancelarPagParcial.onclick = () => {
    modalPagParcial.classList.add("hidden");
  };
}

// 🔹 CONFIRMAR PAGAMENTO
if (btnConfirmarPagParcial) {
  btnConfirmarPagParcial.onclick = async () => {

    const valor = Number(document.getElementById("pag-parcial-valor").value);
    const data = document.getElementById("pag-parcial-data").value;
    const contaId = document.getElementById("pag-parcial-conta").value;

    if (!valor || valor <= 0) {
      showToast("Informe um valor válido.", "error");
      return;
    }

    if (!contaId) {
      showToast("Selecione a conta.", "error");
      return;
    }

    const ano = mesFatura.getFullYear();
    const mes = mesFatura.getMonth() + 1;
    const categoriaId = await getOrCreateCategoria("Cartão de Crédito");

    // 🔥 1️⃣ Criar DESPESA real
    const { data: despesa, error: erroDesp } = await supabase
      .from("despesas")
      .insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        conta_id: contaId,
        descricao: "Pagamento parcial cartão",
        valor: valor,
        data: data,
        categoria_id: categoriaId,
        baixado: true,
        data_baixa: data,
        cartao_pagamento_parcial: true
      }])
      .select()
      .single();

    if (erroDesp) {
      console.error(erroDesp);
      return showToast("Erro ao criar despesa.", "error");
    }

    // 🔥 2️⃣ Criar movimentação vinculada
    await supabase.from("movimentacoes").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      conta_id: contaId,
      tipo: "debito",
      valor: valor,
      descricao: "Pagamento parcial cartão",
      data: data,
      lancamento_id: despesa.id
    }]);

    await recalcularSaldoConta(contaId);

    // 🔥 4️⃣ Inserir abatimento na fatura
    await supabase.from("cartao_lancamentos").insert([{
  id: crypto.randomUUID(),
  user_id: state.user.id,
  cartao_id: activeCardId,
  descricao: "Pagamento parcial da fatura",
  valor: -Math.abs(valor),
  data_compra: data,
  data_fatura: new Date(
    mesFatura.getFullYear(),
    mesFatura.getMonth(),
    1
  ).toISOString().slice(0,10),
  parcelas: 1,
  parcela_atual: 0,
  tipo: "pagamento",
  billed: false,
  despesa_id: despesa.id
}]);

    modalPagParcial.classList.add("hidden");

    await loadFaturaForSelected();

    showToast("Pagamento parcial realizado com sucesso.");
  };
}

  // ===========================// HISTÓRICO DE FATURAS// ===========================
  async function loadHistoricoFaturas() {
    const { data } = await supabase.from("cartao_faturas").select("*, cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at", { ascending: false });
    listaFaturasHistorico.innerHTML = "";
    (data || []).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(f.valor_total || 0)} — ${f.pago ? "Paga" : f.status}`;
      listaFaturasHistorico.appendChild(li);
    });
  }
  
  // ===========================// FATURAS — SELECT DO LANÇAMENTO// ===========================
  
function popularFaturasLancamento() {
  if (!selectFaturaInicial) return;

  selectFaturaInicial.innerHTML = "";

  const base = new Date();

  // gera faturas do mês atual + próximos 24 meses
  for (let i = 0; i < 24; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);

    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    });

    const opt = new Option(label, value);

    // seleciona automaticamente a fatura atual
    if (i === 0) opt.selected = true;

    selectFaturaInicial.appendChild(opt);
  }
}

  // ===========================// SELECTS AUXILIARES// ===========================
  async function loadSelectsForLanc() {
    await loadCategorias();
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

    popularSelectContasPagamento(selectContaPagamento, contas || [], { mostrarSaldo: true });
  }

  // ===========================// EDIÇÃO À VISTA DINÂMICA// ===========================
  function ensureAvistaViewExists() {
    if (viewEditarAvista) return;
    const right = document.querySelector(".right-column") || document.body;

    const div = document.createElement("div");
    div.id = "view-editar-avista";
    div.className = "panel view hidden";
    div.innerHTML = `
      <div class="panel-header">
        <h2>Editar Compra (À vista)</h2>
        <button id="btn-avista-voltar" class="btn-secondary">Voltar</button>
      </div>
      <div class="form">
        <label>Descrição</label><input id="avista-desc">
        <label>Valor</label><input id="avista-valor" type="number" step="0.01">
        <label>Data</label><input id="avista-data" type="date">
        <label>Categoria</label><select id="avista-categoria"></select>
        <label>Cartão</label><select id="avista-cartao"></select>
        <div class="actions-row">
          <button id="btn-avista-salvar" class="btn-primary">Salvar</button>
          <button id="btn-avista-excluir" class="btn-danger">Excluir</button>
        </div>
      </div>`;

    right.appendChild(div);
    viewEditarAvista = div;

   
    document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
    document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
     }

async function abrirEdicaoAvista(l) {
  try {
    const modal = document.getElementById("modal-editar-compra");
    if (!modal) {
      showToast("Modal de edição não encontrado.", "error");
      return;
    }

    // descrição
    document.getElementById("edit-desc").value =
      (l.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

    // valor
    document.getElementById("edit-valor-total").value = Number(l.valor);

    // data da compra
    document.getElementById("edit-data-inicial").value =
      l.data_compra || l.data || "";

    // compra à vista = 1 parcela
    document.getElementById("edit-total-parcelas").value = 1;

    // selects
    await popularSelectCategoriaEdicao(l.categoria_id);
    await popularSelectCartaoEdicao(l.cartao_id);

    // limpa lista de parcelas (não existe para compra à vista)
    const listaParcelas = document.getElementById("lista-parcelas-editar");
    if (listaParcelas) listaParcelas.innerHTML = "";

    // guarda estado
    state.editingPurchaseFull = l;
    state.editingPurchaseParcels = [l];

    // abre modal
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

  } catch (err) {
    console.error(err);
    showToast("Erro ao abrir edição da compra.", "error");
  }
}

  async function popularSelectCategoriaAvista(id) {
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .eq("user_id", state.user.id)
      .order("nome");
    const sel = document.getElementById("avista-categoria");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === id) op.selected = true;
      sel.appendChild(op);
    });
  }

  async function popularSelectCartaoAvista(id) {
    const { data } = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id);
    const sel = document.getElementById("avista-cartao");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === id) op.selected = true;
      sel.appendChild(op);
    });
  }

  async function salvarEdicaoAvista() {
    const id = viewEditarAvista.dataset.lancId;
    const desc = document.getElementById("avista-desc").value.trim();
    const valor = Number(document.getElementById("avista-valor").value || 0);
    const data = document.getElementById("avista-data").value;
    const cat = document.getElementById("avista-categoria").value;
    const cartao = document.getElementById("avista-cartao").value;

    if (!desc || !valor || !data) return showToast("Preencha tudo!", "error");

    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({
        descricao: desc,
        valor,
        data_compra: data,
        categoria_id: cat,
        cartao_id: cartao,
      })
      .eq("id", id)
      .eq("user_id", state.user.id);

    if (error) {
      console.error(error);
      return showToast("Erro ao salvar.", "error");
    }

    showToast("Compra salva!");
    await loadFaturaForSelected();
    
  }

  async function excluirCompraAvista() {
    const id = viewEditarAvista.dataset.lancId;
    if (!confirm("Excluir compra?")) return;

    await supabase
      .from("cartao_lancamentos")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);

    showToast("Compra excluída.");
    await loadFaturaForSelected();
 
  }

  // ===========================// EDIÇÃO PARCELADA // ===========================
   async function abrirEdicaoCompraParcelada(c) {
  try {
    const modal = document.getElementById("modal-editar-compra");
    if (!modal) {
      showToast("Modal de edição não encontrado.", "error");
      return;
    }

    const elDesc = document.getElementById("edit-desc");
    const elValor = document.getElementById("edit-valor-total");
    const elData = document.getElementById("edit-data-inicial");
    const elParcelas = document.getElementById("edit-total-parcelas");

    if (!elDesc || !elValor || !elData || !elParcelas) {
      showToast("Campos da edição parcelada não encontrados.", "error");
      return;
    }

    // descrição base (remove "(x/y)") para encontrar todas as parcelas da mesma compra
    const base = limparDescricaoParcela(c.descricao);

    const { data: parcelas, error } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", c.cartao_id)
      .eq("user_id", state.user.id)
      .eq("data_compra", c.data_compra)
      .eq("parcelas", c.parcelas)
      .order("parcela_atual", { ascending: true });

    if (error) {
      console.error(error);
      showToast("Erro ao carregar parcelas.", "error");
      return;
    }

    const parcelasDaCompra = (parcelas || []).filter((p) => limparDescricaoParcela(p.descricao) === base);

    if (!parcelasDaCompra || parcelasDaCompra.length === 0) {
      showToast("Nenhuma parcela disponível para edição.", "warning");
      return;
    }

    // estado global
    state.editingPurchaseParcels = parcelasDaCompra;
    state.editingPurchaseFull = parcelasDaCompra[0];

    // preencher campos principais
    elDesc.value = base;
    elValor.value = parcelasDaCompra.reduce((s, p) => s + Number(p.valor || 0), 0).toFixed(2);
    elData.value = parcelasDaCompra[0].data_compra || "";
    elParcelas.value = parcelasDaCompra.length;

    // popular selects
    await popularSelectCategoriaEdicao(parcelasDaCompra[0].categoria_id);
    await popularSelectCartaoEdicao(parcelasDaCompra[0].cartao_id);

    // renderizar parcelas (somente atuais + futuras)
    renderParcelasEdicao();

    // abrir modal
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

  } catch (err) {
    console.error(err);
    showToast("Erro ao abrir edição parcelada.", "error");
  }
}


 function renderParcelasEdicao() {
  const lista = document.getElementById("lista-parcelas-editar");
  if (!lista) return;

  lista.innerHTML = "";

  const parcelas = state.editingPurchaseParcels || [];
  const total = parcelas.length;

  parcelas.forEach((p, index) => {
    const li = document.createElement("li");
    li.className = "parcela-item";
    li.dataset.parcelaId = p.id;

    const info = document.createElement("div");
    info.className = "parcela-info";
    info.appendChild(createTextElement("strong", `Parcela ${p.parcela_atual || index + 1}/${total}`, "parcela-title"));
    info.appendChild(createTextElement("small", `Compra: ${formatDateBR(p.data_compra)}`, "parcela-meta"));

    const fields = document.createElement("div");
    fields.className = "parcela-fields";

    const valorWrap = document.createElement("label");
    valorWrap.textContent = "Valor";
    const valorInput = document.createElement("input");
    valorInput.type = "number";
    valorInput.step = "0.01";
    valorInput.min = "0";
    valorInput.value = Number(p.valor || 0).toFixed(2);
    valorInput.addEventListener("focus", () => valorInput.select());
    valorInput.addEventListener("input", () => {
      state.editingPurchaseParcels[index].valor = Number(valorInput.value || 0);
      atualizarTotalEdicaoAPartirParcelas();
    });
    valorWrap.appendChild(valorInput);

    const dataWrap = document.createElement("label");
    dataWrap.textContent = "Fatura";
    const dataInput = document.createElement("input");
    dataInput.type = "date";
    dataInput.value = p.data_fatura || p.data_compra || "";
    dataInput.addEventListener("change", () => {
      state.editingPurchaseParcels[index].data_fatura = dataInput.value;
    });
    dataWrap.appendChild(dataInput);

    fields.append(valorWrap, dataWrap);

    const actions = document.createElement("div");
    actions.className = "parcela-actions";
    const deleteButton = createTextElement("button", "Excluir", "btn-danger btn-del");
    const anticipateButton = createTextElement("button", "Antecipar", "btn-primary btn-ant");
    deleteButton.type = "button";
    anticipateButton.type = "button";
    deleteButton.onclick = () => excluirParcela(p.id);
    anticipateButton.onclick = () => anteciparParcela(p.id);
    actions.append(deleteButton, anticipateButton);
    li.append(info, fields, actions);

    lista.appendChild(li);
  });
}


  // ===========================// MODAL EDITAR PARCELA// ===========================
  let parcelaEditandoId = null;

 function abrirModalEditarParcela(c) {
  if (!modalEditarParcela || !modalParcelaValor || !modalParcelaData) {
    console.error("Modal de edição de parcela não encontrado no DOM");
    showToast("Erro interno ao editar parcela.", "error");
    return;
  }

  parcelaEditandoId = c.id;

  modalParcelaValor.value = Number(c.valor || 0);
  modalParcelaData.value =
    c.data_fatura ||
    c.data_compra ||
    new Date().toISOString().slice(0, 10);

  modalEditarParcela.classList.remove("hidden");
}


  function fecharModalEditarParcela() {
    parcelaEditandoId = null;
    modalEditarParcela.classList.add("hidden");
  }

if (modalParcelaCancelar) {
  modalParcelaCancelar.onclick = () => {
    modalEditarParcela.classList.add("hidden");
    parcelaEditandoId = null;
  };
}

  if (modalParcelaSalvar) modalParcelaSalvar.onclick = async () => {
    const novoValor = Number(modalParcelaValor.value);
    const novaData = modalParcelaData.value;

    if (!novaData || !novoValor)
      return showToast("Preencha todos os campos.", "error");

    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({ valor: novoValor, data_fatura: novaData })
      .eq("id", parcelaEditandoId)
      .eq("user_id", state.user.id);

    if (error) {
      console.error(error);
      return showToast("Erro ao salvar parcela.", "error");
    }

    fecharModalEditarParcela();
    await loadFaturaForSelected();
    showToast("Parcela atualizada.");
  };

  // ===========================// EXCLUIR PARCELA// ===========================
  async function excluirParcela(id) {
    if (!confirm("Excluir somente esta parcela?")) return;

    const { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);

    if (error) {
      console.error(error);
      return showToast("Erro ao excluir parcela.", "error");
    }

    state.editingPurchaseParcels = (state.editingPurchaseParcels || []).filter((p) => p.id !== id);
    atualizarTotalEdicaoAPartirParcelas();
    renderParcelasEdicao();
    await loadFaturaForSelected();
    showToast("Parcela excluída.");
  }

  // ===========================// ANTECIPAR PARCELA// ===========================
  async function anteciparParcela(id) {
    const parcela = state.editingPurchaseParcels.find((p) => p.id === id);
    if (!parcela)
      return showToast("Parcela não encontrada.", "error");

    if (!confirm(`Antecipar parcela de ${formatReal(parcela.valor)}?`))
      return;

    const hoje = formatISO(new Date());

    await supabase.from("cartao_lancamentos").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      cartao_id: parcela.cartao_id,
      descricao: `Antecipação ${parcela.descricao}`,
      valor: -Math.abs(parcela.valor),
      data_compra: hoje,
      data_fatura: hoje,
      parcelas: 1,
      parcela_atual: 1,
      tipo: "pagamento",
      billed: false
    }]);

    showToast("Parcela antecipada.");
    await loadFaturaForSelected();
  }

  // ===========================// POPULAR SELECTS PARA EDIÇÃO// ===========================
  async function popularSelectCategoriaEdicao(id) {
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .eq("user_id", state.user.id)
      .order("nome");
    const sel = document.getElementById("edit-categoria");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === id) op.selected = true;
      sel.appendChild(op);
    });
  }

  async function popularSelectCartaoEdicao(id) {
    const { data } = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id);
    const sel = document.getElementById("edit-cartao");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === id) op.selected = true;
      sel.appendChild(op);
    });
  }

  // ===========================// SALVAR/EXCLUIR EDIÇÃO PARCELADA// ===========================
  const editValorTotalInput = document.getElementById("edit-valor-total");
  if (editValorTotalInput) {
    editValorTotalInput.addEventListener("focus", () => editValorTotalInput.select());
    editValorTotalInput.addEventListener("input", recalcularParcelasPeloTotal);
  }

  if (document.getElementById("btn-salvar-edicao"))
    document.getElementById("btn-salvar-edicao").onclick = async () => {
      try {
        const desc = document.getElementById("edit-desc").value.trim();
        const total = Number(document.getElementById("edit-valor-total").value || 0);
        const dataIni = document.getElementById("edit-data-inicial").value;
        const totalParcelas = Number(document.getElementById("edit-total-parcelas").value || 1);
        const categoria = document.getElementById("edit-categoria").value;
        const cartao = document.getElementById("edit-cartao").value;
        const parcelas = state.editingPurchaseParcels || [];

        if (!desc || !total || !dataIni || !parcelas.length) {
          return showToast("Preencha os dados da compra antes de salvar.", "warning");
        }

        // limpar "(x/y)" da descrição
        const descLimpa = limparDescricaoParcela(desc);

        const updates = parcelas.map((parcela, index) => {
          const numeroParcela = Number(parcela.parcela_atual || index + 1);
          const descricaoParcela = totalParcelas > 1
            ? `${descLimpa} (${numeroParcela}/${totalParcelas})`
            : descLimpa;

          return supabase
            .from("cartao_lancamentos")
            .update({
              descricao: descricaoParcela,
              valor: Number(parcela.valor || 0),
              data_compra: dataIni,
              data_fatura: parcela.data_fatura || dataIni,
              categoria_id: categoria || null,
              cartao_id: cartao
            })
            .eq("id", parcela.id)
            .eq("user_id", state.user.id);
        });

        const results = await Promise.all(updates);
        const error = results.find((r) => r.error)?.error;

        if (error) {
          console.error(error);
          return showToast("Erro ao salvar edição.", "error");
        }

        showToast("Compra e parcelas atualizadas.");
        modalEditarCompra.classList.add("hidden");
        await loadFaturaForSelected();
       

      } catch (err) {
        console.error(err);
        showToast("Erro ao salvar edição.", "error");
      }
    };

  if (document.getElementById("btn-excluir-compra"))
    document.getElementById("btn-excluir-compra").onclick = async () => {
      try {
        if (!state.editingPurchaseParcels || state.editingPurchaseParcels.length === 0) return;
        if (!confirm("Excluir esta compra (todas parcelas)?")) return;

        const ids = state.editingPurchaseParcels.map(p => p.id);
        await supabase
          .from("cartao_lancamentos")
          .delete()
          .in("id", ids)
          .eq("user_id", state.user.id);

        showToast("Compra parcelada excluída.");
        await loadFaturaForSelected();
        
      } catch (err) {
        console.error(err);
        showToast("Erro ao excluir compra.", "error");
      }
    };

  // ===========================// SELECT CHANGES// ===========================
  
  if (selectMesFaturas) selectMesFaturas.addEventListener("change", loadFaturaForSelected);

  // ===========================// LOAD SELECTS FOR LANCAMENTO // ===========================
  async function loadSelectsForLanc() {
    await loadCategorias();
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

   popularSelectContasPagamento(selectContaPagamento, contas || []);

    // popular selectFaturaInicial com base no mesLanc atual e próximos 24 meses (exemplo)
    if (selectFaturaInicial) {
      selectFaturaInicial.innerHTML = "";
      const base = new Date();
      base.setMonth(base.getMonth() - 1);
      for (let i = 0; i < 36; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        const label = `${d.toLocaleString("pt-BR", { month: "long" })} ${d.getFullYear()}`;
        const opt = new Option(label, val);
        if (i === 1) opt.selected = true; // por padrão selecionar próximo mês
        selectFaturaInicial.appendChild(opt);
      }
      // ajustar para fatDisplay atual
      popularFaturasLancamento();
    }
  }

  // ===========================// HISTÓRICO & LOADS INICIAIS// ===========================
  async function loadHistoricoFaturas() {
    const { data } = await supabase.from("cartao_faturas").select("*, cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at", { ascending: false });
    listaFaturasHistorico.innerHTML = "";
    (data || []).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(f.valor_total || 0)} — ${f.pago ? "Paga" : f.status}`;
      listaFaturasHistorico.appendChild(li);
    });
  }
  
// ===========================// NOVO CARTÃO — abrir formulário// ===========================
if (btnNewCard) {
  btnNewCard.onclick = () => {

    // limpa campos
    document.getElementById("card-nome").value = "";
    document.getElementById("card-limite").value = "";
    document.getElementById("card-dia-fechamento").value = "";
    document.getElementById("card-dia-vencimento").value = "";

    // abre modal
    document
      .getElementById("modal-new-card")
      .classList.remove("hidden");
  };
}

  // ================================//  LANÇAR COMPRA// ================================
btnLancarCompra.onclick = async () => {

  if (!activeCardId) {
    showToast("Selecione um cartão primeiro.", "warning");
    return;
  }

  state.cartaoLancamentoAtual = activeCardId;

  // 👇 ISSO É O QUE FAZ O SELECT FUNCIONAR
  await loadSelectsForLanc();

  popularFaturasLancamento();

  document
    .getElementById("modal-lancamento")
    .classList.remove("hidden");
};

// ================================// GERAR DESPESA // ================================
const btnGerarDespesa = document.getElementById("btn-gerar-despesa");

if (btnGerarDespesa) {
  btnGerarDespesa.onclick = async () => {
    try {
      if (!activeCardId) {
        showToast("Selecione um cartão.", "error");
        return;
      }

      if (!state.faturaAtual) {
        showToast("Fatura não encontrada.", "error");
        return;
      }

      if (state.faturaAtual.status !== "fechada") {
        showToast("Feche a fatura antes de gerar a despesa.", "error");
        return;
      }

      // 🔹 evita gerar despesa duas vezes
      const { data: despExistente } = await supabase
        .from("despesas")
        .select("id")
        .eq("cartao_fatura_id", state.faturaAtual.id)
        .eq("user_id", state.user.id)
        .maybeSingle();

      if (despExistente) {
        showToast("Despesa já foi gerada para esta fatura.", "warning");
        return;
      }

      // 🔹 dados da fatura atual (janeiro, por exemplo)
      const { mes, ano, valor_total, id: faturaId } = state.faturaAtual;

      const contaId = document.getElementById("conta-fatura-select")?.value;
      const venc = document.getElementById("conta-fatura-vencimento")?.value;

      if (!contaId || !venc) {
        showToast("Conta ou vencimento não informado.", "error");
        return;
      }

      // 🔹 categoria padrão
      const categoriaId = await getOrCreateCategoria("Cartão de Crédito");

      const card =
        state.cards.find(c => c.id === activeCardId) || { nome: "Cartão" };

      // 🔹 cria a despesa
      await supabase.from("despesas").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        conta_id: contaId,
        descricao: `Fatura ${card.nome} — ${String(mes).padStart(2, "0")}/${ano}`,
        valor: valor_total,
        data: venc,
        categoria_id: categoriaId,
        baixado: false,
        cartao_fatura_id: faturaId
      }]);

      showToast("Despesa gerada com sucesso.", "success");

      // ======================================================// 🔥 REGRA PRINCIPAL (A QUE VOCÊ PEDIU)// depois de janeiro acabar, mostrar a PRÓXIMA fatura aberta// ======================================================

      let proximo = new Date(ano, mes, 1); // começa no mês seguinte

      while (true) {
        const a = proximo.getFullYear();
        const m = proximo.getMonth() + 1;

        const { data: fatura } = await supabase
          .from("cartao_faturas")
          .select("id, status")
          .eq("user_id", state.user.id)
          .eq("cartao_id", activeCardId)
          .eq("ano", a)
          .eq("mes", m)
          .maybeSingle();

       // se NÃO existir OU estiver ABERTA → usar esse mês
if (!fatura || fatura.status === "aberta") {
  mesFatura = new Date(a, m - 1, 1);
  break;
}

        // senão, pula para o próximo
        proximo.setMonth(proximo.getMonth() + 1);
      }

      popularMesFatura();
      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      showToast("Erro ao gerar despesa.", "error");
    }
  };
}

// ===========================// NOVO CARTÃO — salvar (com trava)// ===========================

if (btnSaveCard) {
  btnSaveCard.onclick = async () => {

    // 🔒 trava contra clique duplo
    if (IS_SAVING_CARD) return;
    IS_SAVING_CARD = true;

    const originalText = btnSaveCard.textContent;
    btnSaveCard.disabled = true;
    btnSaveCard.textContent = "Salvando...";

    try {
      const nome = cardNome.value.trim();
      const limite = Number(cardLimite.value || 0);
      const diaFechamento = Number(cardDiaFechamento.value);
      const diaVencimento = Number(cardDiaVencimento.value);

      if (!nome || !limite || !diaFechamento || !diaVencimento) {
        showToast("Preencha todos os campos.", "error");
        return;
      }

      if (
        diaFechamento < 1 || diaFechamento > 31 ||
        diaVencimento < 1 || diaVencimento > 31
      ) {
        showToast("Dias devem estar entre 1 e 31.", "error");
        return;
      }

      await supabase.from("cartoes_credito").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        nome,
        limite,
        dia_fechamento: diaFechamento,
        dia_vencimento: diaVencimento
      }]);

      showToast("Cartão criado com sucesso!");
     await loadCards();
renderCardsSidebar();
await loadFaturaForSelected();


    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar cartão.", "error");

    } finally {
      // 🔓 sempre libera
      IS_SAVING_CARD = false;
      btnSaveCard.disabled = false;
      btnSaveCard.textContent = originalText;
    }
  };
}

// ===========================// NOVO CARTÃO — cancelar// ===========================
if (btnCancelCard) {
  btnCancelCard.onclick = () => {
    document
      .getElementById("modal-new-card")
      .classList.add("hidden");
  };
}

  // -----------------------------------------------------------------------------------
  
  async function abrirFluxoEdicaoCompra(c) {
  // Se não for parcelada, usa o modal simples (JÁ EXISTENTE)
if (!c.parcelas || c.parcelas <= 1) {
  await abrirEdicaoAvista(c);
  return;
}

  // Compra parcelada → abrir edição completa (JÁ EXISTENTE)
  await abrirEdicaoCompraParcelada(c);
}
const btnFecharEdicao = document.getElementById("btn-fechar-edicao-compra");

if (btnFecharEdicao) {
  btnFecharEdicao.onclick = () => {
    modalEditarCompra.classList.add("hidden");
  };
}
} // fim initCartaoPage

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCartaoPage);
} else {
  initCartaoPage();
}

// ==================================================================================// FIM do arquivo cartao.js// ==================================================================================
