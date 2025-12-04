// =====================================================================================
// CARTAO.JS — VERSÃO COMPLETA COM TELA DE EDIÇÃO DE COMPRA E PARCELAS (2025)
// =====================================================================================

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
  editingPurchaseFull: null,     // compra completa (todas as parcelas)
  editingPurchaseParcels: [],    // lista completa de parcelas
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
const viewEditarCompra = document.getElementById("view-editar-compra");

// ELEMENTOS DA NOVA TELA DE EDIÇÃO
const editDesc = document.getElementById("edit-desc");
const editValorTotal = document.getElementById("edit-valor-total");
const editCategoria = document.getElementById("edit-categoria");
const editCartao = document.getElementById("edit-cartao");
const editDataInicial = document.getElementById("edit-data-inicial");
const editTotalParcelas = document.getElementById("edit-total-parcelas");
const listaParcelasEditar = document.getElementById("lista-parcelas-editar");
const btnSalvarEdicao = document.getElementById("btn-salvar-edicao");
const btnExcluirCompra = document.getElementById("btn-excluir-compra");
const btnVoltarEdicao = document.getElementById("btn-voltar-edicao");

// ---------------- ORIGINAIS DO SISTEMA -----------------

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
  viewEditarCompra.classList.add("hidden"); // nova tela
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

// -------------------------------- SELECTOR MÊS FATURA --------------------------------

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

// -------------------------------- SELECTOR MÊS PARA LANÇAMENTO --------------------------------

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

// -------------------------------- CARREGAR FATURA DO MÊS --------------------------------

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

    // 👉 CLIQUE PARA ABRIR A TELA DE EDIÇÃO
    li.style.cursor = "pointer";
    li.onclick = () => abrirEdicaoCompra(c);

    listaComprasFatura.appendChild(li);
  });

  if (card) {
    const venc = new Date(ano, mes - 1, card.dia_vencimento);
    dataVencimentoFatura.value = formatISO(venc);
  }
}
// -------------------------------- PARTE 3: ABRIR EDIÇÃO / CARREGAR PARCELAS --------------------------------

/**
 * abrirEdicaoCompra(compra)
 * - compra: objeto da linha clicada na fatura (um registro de cartao_lancamentos)
 *
 * Estratégia:
 * 1) Deriva a "descricao_base" removendo o sufixo " (x/y)" caso exista
 * 2) Busca todos os lançamentos do mesmo cartão cuja descricao começa com essa base
 *    (usa ILIKE para ser case-insensitive)
 * 3) Preenche state.editingPurchaseFull (primeira parcela) e state.editingPurchaseParcels (todas)
 * 4) Popular selects e renderizar lista de parcelas
 * 5) Mostrar a view de edição
 */
async function abrirEdicaoCompra(compra) {
  try {
    // Deriva a descrição base (remove " (1/5)" ou " (2/12)" se houver)
    const descricaoBase = (compra.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

    // Buscar todas as parcelas com a mesma base no mesmo cartão
    const q = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", compra.cartao_id)
      .ilike("descricao", `${descricaoBase}%`)
      .order("parcela_atual", { ascending: true });

    if (!q.data || q.data.length === 0) {
      alert("Não foi possível carregar as parcelas dessa compra.");
      return;
    }

    // Atualiza state
    state.editingPurchaseParcels = q.data;
    state.editingPurchaseFull = q.data[0]; // primeira parcela como "mestre"

    // Preenche campos principais da nova tela de edição
    editDesc.value = descricaoBase;
    // soma valores (algumas bases podem ter valores ligeiramente diferentes, somamos)
    const somaTotal = state.editingPurchaseParcels.reduce((s, p) => s + Number(p.valor || 0), 0);
    editValorTotal.value = Number(somaTotal.toFixed(2));
    editDataInicial.value = state.editingPurchaseParcels[0].data_compra;
    editTotalParcelas.value = state.editingPurchaseParcels.length;

    // Popular selects (categoria / cartão)
    await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
    await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

    // Renderizar lista de parcelas
    renderParcelasEdicao();

    // Mostrar view de edição
    showView(viewEditarCompra);
  } catch (err) {
    console.error("abrirEdicaoCompra:", err);
    alert("Erro ao abrir edição da compra. Veja console.");
  }
}

/**
 * popularSelectCategoriaEdicao(selectedId)
 */
async function popularSelectCategoriaEdicao(selectedId) {
  try {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    const sel = editCategoria;
    sel.innerHTML = "";

    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === selectedId) op.selected = true;
      sel.appendChild(op);
    });

    // opcional: se não houver categoria selecionada, deixa em branco
    if (!selectedId && sel.options.length > 0) sel.selectedIndex = 0;
  } catch (err) {
    console.error("popularSelectCategoriaEdicao:", err);
  }
}

/**
 * popularSelectCartaoEdicao(selectedId)
 */
async function popularSelectCartaoEdicao(selectedId) {
  try {
    const { data } = await supabase
      .from("cartoes_credito")
      .select("*")
      .eq("user_id", state.user.id);

    const sel = editCartao;
    sel.innerHTML = "";

    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === selectedId) op.selected = true;
      sel.appendChild(op);
    });
  } catch (err) {
    console.error("popularSelectCartaoEdicao:", err);
  }
}

/**
 * renderParcelasEdicao()
 * Renderiza a lista de parcelas (state.editingPurchaseParcels)
 * Cada item terá botões locais que chamam funções que implementaremos na PARTE 4:
 * - editarParcela(id)
 * - excluirParcela(id)
 * - anteciparParcela(id)
 *
 * Observação: aqui colocamos handlers que apenas chamam funções globais que serão definidas depois.
 */
function renderParcelasEdicao() {
  listaParcelasEditar.innerHTML = "";

  const parcelas = state.editingPurchaseParcels || [];
  const total = parcelas.length;

  parcelas.forEach((p) => {
    const li = document.createElement("li");
    li.className = "parcela-item";
    li.dataset.parcelaId = p.id;

    // label da parcela
    const leftSpan = document.createElement("span");
    leftSpan.textContent = `(${p.parcela_atual}/${total}) — ${formatDateShort(p.data_compra)} — ${formatReal(p.valor)}`;

    // ações (para a parcela atual não mostramos botão 'antecipar' por padrão, mas implementamos)
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "6px";

    // botão editar parcela
    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-secondary";
    btnEdit.textContent = "Editar";
    btnEdit.onclick = (ev) => {
      ev.stopPropagation();
      if (typeof editarParcela === "function") editarParcela(p.id);
      else alert("Função editarParcela ainda não implementada (aguarde PARTE 4).");
    };

    // botão excluir parcela
    const btnDel = document.createElement("button");
    btnDel.className = "btn-danger";
    btnDel.textContent = "Excluir";
    btnDel.onclick = (ev) => {
      ev.stopPropagation();
      if (typeof excluirParcela === "function") excluirParcela(p.id);
      else alert("Função excluirParcela ainda não implementada (aguarde PARTE 4).");
    };

    // botão antecipar parcela
    const btnAnt = document.createElement("button");
    btnAnt.className = "btn-primary";
    btnAnt.textContent = "Antecipar";
    btnAnt.onclick = (ev) => {
      ev.stopPropagation();
      if (typeof anteciparParcela === "function") anteciparParcela(p.id);
      else alert("Função anteciparParcela ainda não implementada (aguarde PARTE 4).");
    };

    // se for a parcela atual (parcela_atual === 1) marcamos e ainda deixamos ações (depende do seu fluxo)
    if (p.parcela_atual === 1) {
      const tagAtual = document.createElement("span");
      tagAtual.textContent = " (Parcela atual)";
      leftSpan.appendChild(tagAtual);
    }

    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDel);
    actionsDiv.appendChild(btnAnt);

    li.appendChild(leftSpan);
    li.appendChild(actionsDiv);

    listaParcelasEditar.appendChild(li);
  });
}

/**
 * Handlers simples já nesta parte:
 * - Voltar (fecha a view de edição)
 * - Botão excluir compra (apenas confirmação aqui; ação completa na PARTE 4)
 * - Botão salvar alterações (ação completa na PARTE 4)
 */
btnVoltarEdicao.onclick = () => {
  // limpa state parcial e volta para view de faturas
  state.editingPurchaseFull = null;
  state.editingPurchaseParcels = [];
  showView(viewFaturas);
};

btnExcluirCompra.onclick = () => {
  if (!state.editingPurchaseFull) return alert("Nenhuma compra selecionada.");
  if (!confirm("Deseja excluir toda a compra (todas as parcelas)?")) return;
  // ação real executada na PARTE 4: excluirCompraCompleta()
  if (typeof excluirCompraCompleta === "function") {
    excluirCompraCompleta(state.editingPurchaseFull);
  } else {
    alert("Função excluirCompraCompleta ainda não implementada (aguarde PARTE 4).");
  }
};

btnSalvarEdicao.onclick = () => {
  if (!state.editingPurchaseFull) return alert("Nenhuma compra para salvar.");
  // ação real executada na PARTE 4: salvarAlteracoesCompra()
  if (typeof salvarAlteracoesCompra === "function") {
    salvarAlteracoesCompra();
  } else {
    alert("Função salvarAlteracoesCompra ainda não implementada (aguarde PARTE 4).");
  }
}
// =====================================================================================
// PARTE 4: EDIÇÃO, EXCLUSÃO, ANTECIPAÇÃO E SALVAMENTO DE PARCELAS
// =====================================================================================


/**
 * editarParcela(id)
 * Abre um prompt simples para editar valor e data de UMA parcela individual.
 * (Se quiser depois eu transformo isso em modal profissional)
 */
async function editarParcela(id) {
  const p = state.editingPurchaseParcels.find(x => x.id === id);
  if (!p) return alert("Parcela não encontrada.");

  const novoValor = prompt("Novo valor da parcela:", p.valor);
  if (novoValor === null) return;

  const novaData = prompt("Nova data da parcela (AAAA-MM-DD):", p.data_compra);
  if (novaData === null) return;

  const { error } = await supabase
    .from("cartao_lancamentos")
    .update({
      valor: Number(novoValor),
      data_compra: novaData
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    return alert("Erro ao editar parcela.");
  }

  // Recarrega parcelas
  await abrirEdicaoCompra(p);
  await loadFaturaForSelected();
  alert("Parcela editada com sucesso.");
}


/**
 * excluirParcela(id)
 * Remove somente UMA parcela da compra.
 */
async function excluirParcela(id) {
  if (!confirm("Deseja excluir somente esta parcela?")) return;

  const p = state.editingPurchaseParcels.find(x => x.id === id);
  if (!p) return alert("Parcela não encontrada.");

  const { error } = await supabase
    .from("cartao_lancamentos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Erro ao excluir parcela.");
    return;
  }

  // Reabrir a compra com parcelas atualizadas
  await abrirEdicaoCompra(p);

  await loadFaturaForSelected();
  alert("Parcela excluída.");
}


/**
 * excluirCompraCompleta()
 * Remove todas as parcelas da compra.
 */
async function excluirCompraCompleta() {
  try {
    const parcelas = state.editingPurchaseParcels;
    if (!parcelas || parcelas.length === 0) return;

    const ids = parcelas.map(p => p.id);

    const { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .in("id", ids);

    if (error) throw error;

    // Volta para faturas
    state.editingPurchaseParcels = [];
    showView(viewFaturas);

    await loadFaturaForSelected();
    alert("Compra excluída com sucesso.");
  } catch (err) {
    console.error(err);
    alert("Erro ao excluir compra.");
  }
}


/**
 * anteciparParcela(id)
 * A parcela é "paga" adiantada.
 * Isso gera:
 * - lançamento negativo no cartão (pagamento)
 * - despesa bancária correspondente
 */
async function anteciparParcela(id) {
  const p = state.editingPurchaseParcels.find(x => x.id === id);
  if (!p) return alert("Parcela não encontrada.");

  const valor = Number(p.valor);
  const hoje = formatISO(new Date());

  const confirmar = confirm(
    `Antecipar parcela (${p.parcela_atual}/${state.editingPurchaseParcels.length}) no valor de ${formatReal(valor)} ?`
  );
  if (!confirmar) return;

  try {
    // 1) Inserir lançamento NEGATIVO no cartão
    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id: p.cartao_id,
      descricao: `Antecipação parcela (${p.parcela_atual}/${state.editingPurchaseParcels.length}) - ${p.descricao}`,
      valor: -Math.abs(valor),
      data_compra: hoje,
      parcelas: 1,
      parcela_atual: 1,
      tipo: "pagamento",
      billed: false
    }]);

    // 2) Registrar despesa bancária
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", state.user.id);

    if (!contas || contas.length === 0) {
      alert("Nenhuma conta bancária cadastrada.");
      return;
    }

    const conta_id = contas[0].id;

    await supabase.from("despesas").insert([{
      descricao: `Antecipação parcela cartão`,
      valor: valor,
      data: hoje,
      conta_id,
      user_id: state.user.id,
      baixado: false
    }]);

    alert("Parcela antecipada.");

    await abrirEdicaoCompra(p);
    await loadFaturaForSelected();

  } catch (err) {
    console.error(err);
    alert("Erro ao antecipar parcela.");
  }
}


/**
 * salvarAlteracoesCompra()
 * Edita a compra inteira:
 * - muda descrição
 * - muda valor total (recalcula parcelas)
 * - muda categoria
 * - muda cartão
 * - muda data inicial
 * - muda total de parcelas
 *
 * Regra do recálculo:
 * valorTotal / novoNumeroParcelas
 */
async function salvarAlteracoesCompra() {
  try {
    const parcelasOriginais = state.editingPurchaseParcels;
    if (!parcelasOriginais || parcelasOriginais.length === 0)
      return alert("Nenhuma compra carregada.");

    // Coleta dados novos
    const novaDesc = editDesc.value.trim();
    const novoValorTotal = Number(editValorTotal.value || 0);
    const novaDataInicial = editDataInicial.value;
    const novoTotalParcelas = Number(editTotalParcelas.value || 1);
    const novoCartaoId = editCartao.value;
    const novaCategoria = editCategoria.value;

    if (!novaDesc || !novoValorTotal || !novaDataInicial) {
      return alert("Preencha todos os campos principais da compra.");
    }

    // EXCLUI TODAS AS PARCELAS ATUAIS
    const ids = parcelasOriginais.map(p => p.id);

    let { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .in("id", ids);

    if (error) {
      console.error(error);
      return alert("Erro ao excluir parcelas antigas.");
    }

    // RECRIA AS NOVAS PARCELAS
    const valorParcela = Number((novoValorTotal / novoTotalParcelas).toFixed(2));

    const [anoIni, mesIni, diaIni] = novaDataInicial.split("-").map(Number);

    for (let p = 1; p <= novoTotalParcelas; p++) {
      const dt = new Date(anoIni, mesIni - 1 + (p - 1), diaIni);
      const dataISO = formatISO(dt);

      await supabase.from("cartao_lancamentos").insert([{
        user_id: state.user.id,
        cartao_id: novoCartaoId,
        descricao: `${novaDesc} (${p}/${novoTotalParcelas})`,
        valor: valorParcela,
        data_compra: dataISO,
        parcelas: novoTotalParcelas,
        parcela_atual: p,
        categoria_id: novaCategoria,
        tipo: "compra",
        billed: false
      }]);
    }

    alert("Compra atualizada com sucesso.");

    // Recarrega fatura e volta para tela de faturas
    await loadFaturaForSelected();
    showView(viewFaturas);

  } catch (err) {
    console.error(err);
    alert("Erro ao salvar alterações da compra.");
  }
}
// =====================================================================================
// PARTE 5: INICIALIZAÇÃO FINAL E FECHAMENTO DA IIFE
// =====================================================================================

/**
 * Atualiza a view de fatura após alterações (recarrega a fatura atualmente selecionada)
 */
async function refreshAfterChange() {
  try {
    await loadCards();
    await loadCategorias();
    await loadFaturaForSelected();
  } catch (err) {
    console.error("refreshAfterChange:", err);
  }
}

/**
 * Pequeno utilitário: reabre a compra após ação quando possível.
 * Se a parcela passada pertencer a outra compra (após exclusão), tentamos abrir pela mesma descrição base.
 */
async function tryReabrirCompraPorParcela(parcela) {
  if (!parcela) return;
  try {
    const descricaoBase = (parcela.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    const q = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", parcela.cartao_id)
      .ilike("descricao", `${descricaoBase}%`)
      .order("parcela_atual", { ascending: true });

    if (q.data && q.data.length) {
      state.editingPurchaseParcels = q.data;
      state.editingPurchaseFull = q.data[0];
      renderParcelasEdicao();
    } else {
      // volta para faturas se não encontrou
      showView(viewFaturas);
    }
  } catch (err) {
    console.error("tryReabrirCompraPorParcela:", err);
  }
}

/**
 * Função auxiliar para garantir que, quando reabrimos edição a partir de uma parcela
 * excluída/alterada, carregamos os dados mais recentes.
 */
async function reopenAfterChange(parcela) {
  await refreshAfterChange();
  await tryReabrirCompraPorParcela(parcela);
}

/* ===== Registrar algumas funções globais (caso sejam chamadas via onclick inline) ===== */
window.abrirEdicaoCompra = abrirEdicaoCompra;
window.editarParcela = editarParcela;
window.excluirParcela = excluirParcela;
window.anteciparParcela = anteciparParcela;
window.excluirCompraCompleta = excluirCompraCompleta;
window.salvarAlteracoesCompra = salvarAlteracoesCompra;

/* ===== Inicialização final (mantendo o comportamento original) ===== */
try {
  await loadCards();
  await loadCategorias();

  popularMesFatura();
  popularFaturasLancamento();

  // mostra a view de faturas por padrão
  showView(viewFaturas);
} catch (err) {
  console.error("Erro na inicialização do cartao.js:", err);
}

})(); // fim do IIFE
