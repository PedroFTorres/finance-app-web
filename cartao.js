// CARTAO.JS — versão completa com seletor mês-a-mês e parcelamento real

(async () => {

// -------------------------------- VARIÁVEIS --------------------------------

if (typeof supabase === "undefined") {
  alert("Erro: supabase.js não carregado.");
  return;
}

const state = {
  user: null,
  cards: [],
  categories: [],
  editingPurchase: null,
};

const btnBack = document.getElementById("btn-back");
const btnLogout = document.getElementById("btn-logout");
const userEmail = document.getElementById("user-email");

const cardsList = document.getElementById("cards-list");
const btnNewCard = document.getElementById("btn-new-card");

const viewNewCard = document.getElementById("view-new-card");
const viewFaturas = document.getElementById("view-faturas");
const viewLancamento = document.getElementById("view-lancamento");
const viewHistorico = document.getElementById("view-historico");
const boxPagAntecipado = document.getElementById("box-pag-antecipado");

const btnSaveCard = document.getElementById("btn-save-card");
const btnCancelCard = document.getElementById("btn-cancel-card");
const cardNome = document.getElementById("card-nome");
const cardLimite = document.getElementById("card-limite");
const cardDiaFechamento = document.getElementById("card-dia-fechamento");
const cardDiaVencimento = document.getElementById("card-dia-vencimento");

const selectCartaoFaturas = document.getElementById("select-cartao-faturas");
const selectMesFaturas = document.getElementById("select-mes-faturas");
const mesDisplay = document.getElementById("mes-display");
const btnMesPrev = document.getElementById("mes-prev");
const btnMesNext = document.getElementById("mes-next");

const faturaSummary = document.getElementById("fatura-summary");
const listaComprasFatura = document.getElementById("lista-compras-fatura");

const selectContaPagamento = document.getElementById("select-conta-pagamento");
const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");
const btnFecharFatura = document.getElementById("btn-fechar-fatura");
const btnPagarFatura = document.getElementById("btn-pagar-fatura");

const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
const dataPagAntecipado = document.getElementById("data-pag-antecipado");
const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");

const selectCartaoLanc = document.getElementById("select-cartao-lanc");
const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");
const cartDesc = document.getElementById("cart-desc");
const cartValor = document.getElementById("cart-valor");
const cartData = document.getElementById("cart-data");
const cartParcelas = document.getElementById("cart-parcelas");

const fatDisplay = document.getElementById("fat-display");
const btnFatPrev = document.getElementById("fat-prev");
const btnFatNext = document.getElementById("fat-next");
const selectFaturaInicial = document.getElementById("select-fatura-inicial");
const parcelaInicialInput = document.getElementById("parcela-inicial");

const btnAddPurchase = document.getElementById("btn-add-purchase");
const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

let mesFatura = new Date();
let mesLanc = new Date();

// -------------------------------- HELPERS --------------------------------

function hideAllViews() {
  viewNewCard.classList.add("hidden");
  viewFaturas.classList.add("hidden");
  viewLancamento.classList.add("hidden");
  viewHistorico.classList.add("hidden");
  boxPagAntecipado.classList.add("hidden");
}

function showView(v) {
  hideAllViews();
  v.classList.remove("hidden");
}

function formatReal(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateShort(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("pt-BR");
}

function formatISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function formatYM(dt) {
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
}

function displayMes(dt) {
  return dt.toLocaleString("pt-BR", { month: "long" }) + " " + dt.getFullYear();
}

// -------------------------------- LOGIN --------------------------------

const sessionResp = await supabase.auth.getSession();
if (!sessionResp.data.session) {
  window.location.href = "login.html";
  return;
}

state.user = sessionResp.data.session.user;
userEmail.textContent = state.user.email;

// -------------------------------- NAV --------------------------------

btnBack.onclick = () => (window.location.href = "app.html");
btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

document.getElementById("nav-fatura").onclick = () => {
  showView(viewFaturas);
  loadFaturasSelect();
};

document.getElementById("nav-lancamento").onclick = () => {
  showView(viewLancamento);
  loadSelectsForLanc();
  popularFaturasLancamento();
};

document.getElementById("nav-historico").onclick = () => {
  showView(viewHistorico);
  loadHistoricoFaturas();
};

// -------------------------------- CARTÕES --------------------------------

btnNewCard.onclick = () => {
  showView(viewNewCard);
  cardNome.value = "";
  cardLimite.value = "0";
  cardDiaFechamento.value = "5";
  cardDiaVencimento.value = "25";
};

btnCancelCard.onclick = () => showView(viewFaturas);

btnSaveCard.onclick = async () => {
  const nome = cardNome.value.trim();
  const limite = Number(cardLimite.value || 0);
  const diaFech = Number(cardDiaFechamento.value);
  const diaVenc = Number(cardDiaVencimento.value);

  if (!nome) return alert("Informe o nome do cartão.");

  await supabase.from("cartoes_credito").insert([{
    user_id: state.user.id,
    nome,
    limite,
    dia_fechamento: diaFech,
    dia_vencimento: diaVenc,
  }]);

  await loadCards();
  showView(viewFaturas);
};

async function loadCards() {
  const { data } = await supabase
    .from("cartoes_credito")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  state.cards = data || [];
  renderCards();
  populateCardSelects();
}

function renderCards() {
  cardsList.innerHTML = "";

  state.cards.forEach((c) => {
    const el = document.createElement("div");
    el.className = "card-item";
    el.innerHTML = `
      <div class="card-meta">
        <div class="card-name">${c.nome}</div>
        <div class="card-balance">Limite: ${formatReal(c.limite)}</div>
        <div class="card-balance">Fecha dia: ${c.dia_fechamento} • Venc: ${c.dia_vencimento}</div>
      </div>
      <div class="card-actions">
        <button class="btn-view-faturas" data-id="${c.id}">Faturas</button>
        <button class="btn-lancar" data-id="${c.id}">Lançar</button>
        <button class="btn-delete" data-id="${c.id}">Excluir</button>
      </div>
    `;
    cardsList.appendChild(el);
  });

  document.querySelectorAll(".btn-view-faturas").forEach((btn) => {
    btn.onclick = () => {
      selectCartaoFaturas.value = btn.dataset.id;
      loadFaturasSelect();
      showView(viewFaturas);
    };
  });

  document.querySelectorAll(".btn-lancar").forEach((btn) => {
    btn.onclick = () => {
      selectCartaoLanc.value = btn.dataset.id;
      loadSelectsForLanc();
      popularFaturasLancamento();
      showView(viewLancamento);
    };
  });
}

function populateCardSelects() {
  selectCartaoFaturas.innerHTML = "";
  selectCartaoLanc.innerHTML = "";

  (state.cards || []).forEach((card) => {
    selectCartaoFaturas.appendChild(new Option(card.nome, card.id));
    selectCartaoLanc.appendChild(new Option(card.nome, card.id));
  });
}

// -------------------------------- CATEGORIAS --------------------------------

async function loadCategorias() {
  const { data } = await supabase.from("categorias").select("*").order("nome");

  state.categories = data || [];
  selectCategoriaLancCartao.innerHTML = "";

  (data || []).forEach((cat) => {
    selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id));
  });
}

// -------------------------------- SELECTOR MÊS-A-MÊS FATURA --------------------------------

function popularMesFatura() {
  mesDisplay.textContent = displayMes(mesFatura);
  selectMesFaturas.value = formatYM(mesFatura);
}

btnMesPrev.onclick = () => {
  mesFatura.setMonth(mesFatura.getMonth() - 1);
  popularMesFatura();
  loadFaturaForSelected();
};

btnMesNext.onclick = () => {
  mesFatura.setMonth(mesFatura.getMonth() + 1);
  popularMesFatura();
  loadFaturaForSelected();
};

// -------------------------------- SELECTOR MÊS-A-MÊS PARA LANÇAMENTO --------------------------------

function popularFaturasLancamento() {
  fatDisplay.textContent = displayMes(mesLanc);
  selectFaturaInicial.value = formatYM(mesLanc);
}

btnFatPrev.onclick = () => {
  mesLanc.setMonth(mesLanc.getMonth() - 1);
  popularFaturasLancamento();
};

btnFatNext.onclick = () => {
  mesLanc.setMonth(mesLanc.getMonth() + 1);
  popularFaturasLancamento();
};

// -------------------------------- CARREGAR FATURAS --------------------------------

async function loadFaturasSelect() {
  await loadCards();
  popularMesFatura();
  await loadCategorias();
  await loadSelectsForLanc();

  if (selectCartaoFaturas.options.length > 0) {
    await loadFaturaForSelected();
  } else {
    showView(viewNewCard);
  }
}

async function loadFaturaForSelected() {
  const cartao_id = selectCartaoFaturas.value;
  const ym = selectMesFaturas.value;

  if (!cartao_id) return;

  const [ano, mes] = ym.split("-").map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .order("data_compra");

  const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);
  const card = state.cards.find((x) => x.id === cartao_id);

  faturaSummary.innerHTML = `
    <div class="big">${card?.nome || "Cartão"}</div>
    <div>${ym}</div>
    <div class="big">${formatReal(total)}</div>
  `;

  listaComprasFatura.innerHTML = "";

  (compras || []).forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${formatDateShort(c.data_compra)} — ${c.descricao}</span>
      <span>${formatReal(c.valor)}</span>
    `;
    listaComprasFatura.appendChild(li);
  });

  if (card) {
    const venc = new Date(ano, mes - 1, card.dia_vencimento);
    dataVencimentoFatura.value = formatISO(venc);
  }
}

// -------------------------------- LANÇAMENTO DE COMPRA --------------------------------

btnAddPurchase.onclick = async () => {
  if (state.editingPurchase) return;

  const cartao_id = selectCartaoLanc.value;
  const descricao = cartDesc.value.trim();
  const valor = Number(cartValor.value || 0);
  const parcelas = Number(cartParcelas.value || 1);
  const parcelaInicial = Number(parcelaInicialInput.value || 1);

  if (!cartao_id || !descricao || !valor) return alert("Preencha tudo.");

  const [anoIni, mesIni] = selectFaturaInicial.value.split("-").map(Number);

  for (let p = parcelaInicial; p <= parcelas; p++) {
    const dt = new Date(anoIni, mesIni - 1 + (p - parcelaInicial), 1);
    const dataISO = formatISO(dt);

    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id,
      descricao: `${descricao} (${p}/${parcelas})`,
      valor: Number(valor / parcelas),
      data_compra: dataISO,
      parcelas,
      parcela_atual: p,
      tipo: "compra",
      billed: false
    }]);
  }

  cartDesc.value = "";
  cartValor.value = "";
  cartParcelas.value = 1;
  parcelaInicialInput.value = 1;

  await loadFaturaForSelected();
  alert("Compra lançada.");
};

// -------------------------------- PAGAMENTO ANTECIPADO --------------------------------

btnPagamentoAntecipado.onclick = async () => {
  await loadSelectsForLanc();
  contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
  valorPagAntecipado.value = "";
  dataPagAntecipado.value = new Date().toISOString().slice(0,10);
  showView(boxPagAntecipado);
};

btnConfirmarPagAntecipado.onclick = async () => {
  const conta_id = contaPagAntecipado.value;
  const valor = Number(valorPagAntecipado.value || 0);
  const dataPag = dataPagAntecipado.value;
  const cartao_id = selectCartaoFaturas.value;

  if (!conta_id || !valor || !dataPag) return alert("Preencha tudo.");

  await supabase.from("cartao_lancamentos").insert([{
    user_id: state.user.id,
    cartao_id,
    tipo: "pagamento",
    descricao: "Pagamento antecipado",
    valor: -Math.abs(valor),
    data_compra: dataPag,
    parcelas: 1,
    parcela_atual: 1,
    billed: false
  }]);

  await supabase.from("despesas").insert([{
    descricao: "Pagamento antecipado - Cartão",
    valor,
    data: dataPag,
    conta_id,
    user_id: state.user.id,
    baixado: false
  }]);

  alert("Pagamento antecipado registrado.");
  showView(viewFaturas);
  await loadFaturaForSelected();
};

// -------------------------------- HISTÓRICO --------------------------------

async function loadHistoricoFaturas() {
  const { data } = await supabase
    .from("cartao_faturas")
    .select("*, cartoes_credito(nome)")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  listaFaturasHistorico.innerHTML = "";

  (data || []).forEach((f) => {
    const li = document.createElement("li");
    li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(
      f.valor_total || 0
    )} — ${f.pago ? "Paga" : f.status}`;
    listaFaturasHistorico.appendChild(li);
  });
}

// -------------------------------- CONTAS --------------------------------

async function loadSelectsForLanc() {
  await loadCategorias();

  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", state.user.id);

  selectContaPagamento.innerHTML = "";

  (contas || []).forEach((c) => {
    selectContaPagamento.appendChild(
      new Option(`${c.nome} (${formatReal(c.saldo_atual || c.saldo_inicial)})`, c.id)
    );
  });
}

// -------------------------------- INIT --------------------------------

await loadCards();
await loadCategorias();

popularMesFatura();
popularFaturasLancamento();

showView(viewFaturas);

})(); // fim
