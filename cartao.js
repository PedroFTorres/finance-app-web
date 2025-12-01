// cartao.js — módulo completo e independente
// (c) Pedro — Finance App

(async () => {

if (typeof supabase === "undefined") {
  alert("Erro: supabase.js não está carregado.");
  return;
}

const state = {
  user: null,
  cards: [],
  categories: [],
  editingPurchase: null, // <<< para edição de compras
};

// --------------------------- ELEMENTOS ---------------------------

const btnBack = document.getElementById("btn-back");
const btnLogout = document.getElementById("btn-logout");
const userEmail = document.getElementById("user-email");

const cardsList = document.getElementById("cards-list");
const btnNewCard = document.getElementById("btn-new-card");

const viewNewCard = document.getElementById("view-new-card");
const viewFaturas = document.getElementById("view-faturas");
const viewLancamento = document.getElementById("view-lancamento");
const viewHistorico = document.getElementById("view-historico");

const btnSaveCard = document.getElementById("btn-save-card");
const btnCancelCard = document.getElementById("btn-cancel-card");

const cardNome = document.getElementById("card-nome");
const cardLimite = document.getElementById("card-limite");
const cardDiaFechamento = document.getElementById("card-dia-fechamento");
const cardDiaVencimento = document.getElementById("card-dia-vencimento");

const selectCartaoFaturas = document.getElementById("select-cartao-faturas");
const selectMesFaturas = document.getElementById("select-mes-faturas");
const btnRefreshFaturas = document.getElementById("btn-refresh-faturas");

const faturaSummary = document.getElementById("fatura-summary");
const listaComprasFatura = document.getElementById("lista-compras-fatura");

const selectContaPagamento = document.getElementById("select-conta-pagamento");
const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");

const btnFecharFatura = document.getElementById("btn-fechar-fatura");
const btnPagarFatura = document.getElementById("btn-pagar-fatura");

const selectCartaoLanc = document.getElementById("select-cartao-lanc");
const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");

const cartDesc = document.getElementById("cart-desc");
const cartValor = document.getElementById("cart-valor");
const cartData = document.getElementById("cart-data");
const cartParcelas = document.getElementById("cart-parcelas");

const btnAddPurchase = document.getElementById("btn-add-purchase");
const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

const listaFaturasHistorico = document.getElementById("lista-faturas-historico");


// --------------------------- HELPERS ---------------------------

function hideAllViews() {
  viewNewCard.classList.add("hidden");
  viewFaturas.classList.add("hidden");
  viewLancamento.classList.add("hidden");
  viewHistorico.classList.add("hidden");
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
  return (
    String(dt.getDate()).padStart(2, "0") +
    "/" +
    String(dt.getMonth() + 1).padStart(2, "0") +
    "/" +
    dt.getFullYear()
  );
}

function formatISO(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

// --------------------------- SESSÃO ---------------------------

const sessionResp = await supabase.auth.getSession();
if (!sessionResp.data.session) {
  window.location.href = "login.html";
  return;
}

state.user = sessionResp.data.session.user;
userEmail.textContent = state.user.email;

// --------------------------- BOTÕES GLOBAIS ---------------------------

btnBack.onclick = () => (window.location.href = "app.html");

btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// --------------------------- NAVEGAÇÃO PRINCIPAL ---------------------------

document.getElementById("nav-fatura").onclick = () => {
  showView(viewFaturas);
  loadFaturasSelect();
};

document.getElementById("nav-lancamento").onclick = () => {
  showView(viewLancamento);
  loadSelectsForLanc();
};

document.getElementById("nav-historico").onclick = () => {
  showView(viewHistorico);
  loadHistoricoFaturas();
};

// --------------------------- CARTÕES ---------------------------

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
  const diaFech = Number(cardDiaFechamento.value || 0);
  const diaVenc = Number(cardDiaVencimento.value || 0);

  if (!nome) return alert("Informe o nome do cartão.");
  if (!(diaFech >= 1 && diaFech <= 28))
    return alert("O dia de fechamento deve ser entre 1 e 28.");
  if (!(diaVenc >= 1 && diaVenc <= 31))
    return alert("Dia de vencimento inválido.");

  await supabase.from("cartoes_credito").insert([
    {
      user_id: state.user.id,
      nome,
      limite,
      dia_fechamento: diaFech,
      dia_vencimento: diaVenc,
    },
  ]);

  await loadCards();
  showView(viewFaturas);
};

// --------------------------- CARREGAR CARTÕES ---------------------------

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
        <div class="card-balance">Fecha dia: ${c.dia_fechamento} • Venc: ${
      c.dia_vencimento
    }</div>
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
      showView(viewLancamento);
    };
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Excluir cartão e TODAS as compras dele?")) return;

      await supabase
        .from("cartao_lancamentos")
        .delete()
        .eq("cartao_id", btn.dataset.id);

      await supabase
        .from("cartoes_credito")
        .delete()
        .eq("id", btn.dataset.id);

      loadCards();
    };
  });
}

// --------------------------- CATEGORIAS ---------------------------

async function loadCategorias() {
  const { data } = await supabase.from("categorias").select("*").order("nome");

  state.categories = data || [];
  selectCategoriaLancCartao.innerHTML = "";

  (state.categories || []).forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.nome;
    selectCategoriaLancCartao.appendChild(opt);
  });
}

// --------------------------- Lançamento de compra ---------------------------

btnAddPurchase.onclick = async () => {
  // SE ESTÁ EDITANDO
  if (state.editingPurchase) {
    const item = state.editingPurchase;

    const descricao = cartDesc.value.trim();
    const valor = Number(cartValor.value || 0);
    const dataCompra = cartData.value;
    const parcelas = Number(cartParcelas.value || 1);

    if (!descricao || !valor || !dataCompra)
      return alert("Preencha descrição, valor e data.");

    await supabase
      .from("cartao_lancamentos")
      .update({
        descricao,
        valor,
        data_compra: dataCompra,
        parcelas,
      })
      .eq("id", item.id);

    alert("Compra atualizada!");

    state.editingPurchase = null;
    btnAddPurchase.textContent = "Adicionar Compra";

    cartDesc.value = "";
    cartValor.value = "";
    cartData.value = "";
    cartParcelas.value = 1;

    loadFaturaForSelected();
    showView(viewFaturas);
    return;
  }

  // ADICIONAR COMPRA NOVA
  const cartao_id = selectCartaoLanc.value;
  const descricao = cartDesc.value.trim();
  const valor = Number(cartValor.value || 0);
  const dataCompra = cartData.value;
  const parcelas = Number(cartParcelas.value || 1);

  if (!cartao_id) return alert("Selecione o cartão.");
  if (!descricao || !valor || !dataCompra)
    return alert("Preencha descrição, valor e data.");

  for (let p = 1; p <= parcelas; p++) {
    await supabase.from("cartao_lancamentos").insert([
      {
        user_id: state.user.id,
        cartao_id,
        descricao: `${descricao} (${p}/${parcelas})`,
        valor: (valor / parcelas).toFixed(2),
        data_compra: dataCompra,
        parcelas,
        parcela_atual: p,
      },
    ]);
  }

  alert("Compra adicionada!");

  cartDesc.value = "";
  cartValor.value = "";
  cartData.value = "";
  cartParcelas.value = 1;

  loadFaturaForSelected();
};

btnCancelPurchase.onclick = () => {
  state.editingPurchase = null;
  btnAddPurchase.textContent = "Adicionar Compra";
  cartDesc.value = "";
  cartValor.value = "";
  cartData.value = "";
  cartParcelas.value = 1;
};

// --------------------------- Edição de Compra ---------------------------

function editPurchase(item) {
  state.editingPurchase = item;

  selectCartaoLanc.value = item.cartao_id;
  cartDesc.value = item.descricao;
  cartValor.value = item.valor;
  cartData.value = item.data_compra;
  cartParcelas.value = item.parcelas;

  btnAddPurchase.textContent = "Salvar Alterações";

  showView(viewLancamento);
}

async function deletePurchase(item) {
  if (!confirm("Excluir esta compra?")) return;

  await supabase.from("cartao_lancamentos").delete().eq("id", item.id);

  alert("Compra excluída!");

  loadFaturaForSelected();
}

// --------------------------- FATURAS ---------------------------

function populateMonthsSelect() {
  selectMesFaturas.innerHTML = "";
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const opt = document.createElement("option");
    opt.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    opt.textContent = `${d.toLocaleString("pt-BR", {
      month: "long",
    })} ${d.getFullYear()}`;
    selectMesFaturas.appendChild(opt);
  }
}

async function loadFaturasSelect() {
  await loadCards();
  populateMonthsSelect();
  await loadCategorias();
  await loadSelectsForLanc();

  if (selectCartaoFaturas.options.length > 0) {
    selectCartaoFaturas.selectedIndex = 0;
    selectMesFaturas.selectedIndex = 0;
    loadFaturaForSelected();
  }
}

btnRefreshFaturas.onclick = () => loadFaturaForSelected();

async function loadFaturaForSelected() {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;

  if (!cartao_id || !mesAno) return;

  const [ano, mes] = mesAno.split("-").map(Number);

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .order("data_compra");

  let total = 0;
  (compras || []).forEach((c) => (total += Number(c.valor || 0)));

  const card = state.cards.find((x) => x.id === cartao_id);

  faturaSummary.innerHTML = `
    <div class="big">${card?.nome || "Cartão"}</div>
    <div>Período: ${mesAno}</div>
    <div class="big">${formatReal(total)}</div>
  `;

  listaComprasFatura.innerHTML = "";

  (compras || []).forEach((c) => {
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${formatDateShort(c.data_compra)}</strong> — 
      ${c.descricao} — 
      ${formatReal(c.valor)}
    `;

    const bEdit = document.createElement("button");
    bEdit.textContent = "Editar";
    bEdit.style.marginLeft = "10px";
    bEdit.onclick = () => editPurchase(c);

    const bDel = document.createElement("button");
    bDel.textContent = "Excluir";
    bDel.style.marginLeft = "6px";
    bDel.onclick = () => deletePurchase(c);

    li.appendChild(bEdit);
    li.appendChild(bDel);

    listaComprasFatura.appendChild(li);
  });

  if (card) {
    const venc = new Date(ano, mes - 1, card.dia_vencimento || 25);
    dataVencimentoFatura.value = formatISO(venc);
  }
}

// --------------------------- FECHAR FATURA ---------------------------

btnFecharFatura.onclick = async () => {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  if (!cartao_id || !mesAno) return alert("Selecione cartão e mês.");

  const [ano, mes] = mesAno.split("-").map(Number);

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(
    last
  ).padStart(2, "0")}`;

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .is("billed", false);

  if (!compras || compras.length === 0)
    return alert("Não há compras abertas para esse período.");

  let total = 0;
  compras.forEach((c) => (total += Number(c.valor || 0)));

  const { data: fdata } = await supabase
    .from("cartao_faturas")
    .insert([
      {
        cartao_id,
        user_id: state.user.id,
        mes,
        ano,
        valor_total: total,
        status: "fechada",
      },
    ])
    .select()
    .single();

  const fatura_id = fdata.id;

  await supabase
    .from("cartao_lancamentos")
    .update({ billed: true, fatura_id })
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .is("billed", false);

  alert("Fatura fechada com sucesso!");
  loadFaturaForSelected();
};

// --------------------------- PAGAR FATURA ---------------------------

btnPagarFatura.onclick = async () => {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  const conta_id = selectContaPagamento.value;
  const data_venc = dataVencimentoFatura.value;

  if (!cartao_id || !mesAno || !conta_id || !data_venc)
    return alert("Preencha cartão, mês, conta e data.");

  const [ano, mes] = mesAno.split("-").map(Number);

  const { data: fatura } = await supabase
    .from("cartao_faturas")
    .select("*")
    .eq("cartao_id", cartao_id)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  if (!fatura) return alert("Feche a fatura antes de pagar.");

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .eq("fatura_id", fatura.id);

  let total = 0;
  compras.forEach((c) => (total += Number(c.valor || 0)));

  const card = state.cards.find((c) => c.id === cartao_id);
  const desc = `Fatura - ${card?.nome || "Cartão"} ${mesAno}`;

  await supabase.from("despesas").insert([
    {
      descricao: desc,
      valor: total,
      data: data_venc,
      conta_id,
      user_id: state.user.id,
      baixado: false,
    },
  ]);

  await supabase.from("cartao_faturas").update({ pago: true }).eq("id", fatura.id);

  alert("Despesa criada. Pague no app principal.");
  loadFaturaForSelected();
};

// --------------------------- HISTÓRICO ---------------------------

async function loadHistoricoFaturas() {
  const { data } = await supabase
    .from("cartao_faturas")
    .select("*, cartoes_credito(nome)")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  listaFaturasHistorico.innerHTML = "";

  (data || []).forEach((f) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.cartoes_credito?.nome || "Cartão"}</strong> —
      ${f.mes}/${f.ano} —
      ${formatReal(f.valor_total)} —
      ${f.pago ? "Paga" : f.status}
    `;
    listaFaturasHistorico.appendChild(li);
  });
}

// --------------------------- INICIALIZAÇÃO FINAL ---------------------------

async function loadSelectsForLanc() {
  await loadCategorias();
  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", state.user.id);

  selectContaPagamento.innerHTML = "";

  contas.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent =
      c.nome + " (" + formatReal(c.saldo_atual || c.saldo_inicial) + ")";
    selectContaPagamento.appendChild(opt);
  });
}

await loadCards();
await loadCategorias();
populateMonthsSelect();
showView(viewFaturas);

})();
