// cartao.js — módulo independente do Finance App
// COMPLETO, REVISADO E COM PARCELAMENTO REAL

(async () => {

if (typeof supabase === "undefined") {
  alert("Erro: supabase.js não está carregado.");
  return;
}

const state = {
  user: null,
  cards: [],
  categories: [],
  editingPurchase: null,
};

// --------------------------- ELEMENTOS ---------------------------

const btnBack = document.getElementById("btn-back");
const btnLogout = document.getElementById("btn-logout");
const userEmail = document.getElementById("user-email");

const cardsList = document.getElementById("cards-list");
const btnNewCard = document.getElementById("btn-new-card");

// views
const viewNewCard = document.getElementById("view-new-card");
const viewFaturas = document.getElementById("view-faturas");
const viewLancamento = document.getElementById("view-lancamento");
const viewHistorico = document.getElementById("view-historico");
const boxPagAntecipado = document.getElementById("box-pag-antecipado");

// salvar cartão
const btnSaveCard = document.getElementById("btn-save-card");
const btnCancelCard = document.getElementById("btn-cancel-card");

const cardNome = document.getElementById("card-nome");
const cardLimite = document.getElementById("card-limite");
const cardDiaFechamento = document.getElementById("card-dia-fechamento");
const cardDiaVencimento = document.getElementById("card-dia-vencimento");

// faturas
const selectCartaoFaturas = document.getElementById("select-cartao-faturas");
const selectMesFaturas = document.getElementById("select-mes-faturas");
const btnRefreshFaturas = document.getElementById("btn-refresh-faturas");

const faturaSummary = document.getElementById("fatura-summary");
const listaComprasFatura = document.getElementById("lista-compras-fatura");

const selectContaPagamento = document.getElementById("select-conta-pagamento");
const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");

const btnFecharFatura = document.getElementById("btn-fechar-fatura");
const btnPagarFatura = document.getElementById("btn-pagar-fatura");

// pagamento antecipado
const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
const dataPagAntecipado = document.getElementById("data-pag-antecipado");
const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");

// lançar compra
const selectCartaoLanc = document.getElementById("select-cartao-lanc");
const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");

const cartDesc = document.getElementById("cart-desc");
const cartValor = document.getElementById("cart-valor");
const cartData = document.getElementById("cart-data");
const cartParcelas = document.getElementById("cart-parcelas");

const selectFaturaInicial = document.getElementById("select-fatura-inicial");
const parcelaInicialInput = document.getElementById("parcela-inicial");

const btnAddPurchase = document.getElementById("btn-add-purchase");
const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

// histórico
const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

// --------------------------- HELPERS ---------------------------

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
  return (
    dt.getDate().toString().padStart(2, "0") +
    "/" +
    (dt.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    dt.getFullYear()
  );
}

function formatISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// --------------------------- LOGIN ---------------------------

const sessionResp = await supabase.auth.getSession();
if (!sessionResp.data.session) {
  window.location.href = "login.html";
  return;
}

state.user = sessionResp.data.session.user;
userEmail.textContent = state.user.email;

btnBack.onclick = () => (window.location.href = "app.html");

btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};
// --------------------------- NAVEGAÇÃO MENU ---------------------------

document.getElementById("nav-fatura").onclick = () => {
  showView(viewFaturas);
  loadFaturasSelect();
};

document.getElementById("nav-lancamento").onclick = () => {
  showView(viewLancamento);
  loadSelectsForLanc();
  popularFaturasFuturas();
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
  const diaFech = Number(cardDiaFechamento.value);
  const diaVenc = Number(cardDiaVencimento.value);

  if (!nome) return alert("Informe o nome do cartão.");
  if (diaFech < 1 || diaFech > 28) return alert("Dia de fechamento inválido.");
  if (diaVenc < 1 || diaVenc > 31) return alert("Dia de vencimento inválido.");

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
      popularFaturasFuturas();
      showView(viewLancamento);
    };
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Excluir cartão e todas as compras?")) return;

      await supabase
        .from("cartao_lancamentos")
        .delete()
        .eq("cartao_id", btn.dataset.id);

      await supabase
        .from("cartoes_credito")
        .delete()
        .eq("id", btn.dataset.id);

      await loadCards();
    };
  });
}

function populateCardSelects() {
  selectCartaoFaturas.innerHTML = "";
  selectCartaoLanc.innerHTML = "";

  (state.cards || []).forEach((card) => {
    const o1 = document.createElement("option");
    o1.value = card.id;
    o1.textContent = card.nome;
    selectCartaoFaturas.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = card.id;
    o2.textContent = card.nome;
    selectCartaoLanc.appendChild(o2);
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
// --------------------------- FUNÇÕES DE FATURAS / MESES ---------------------------

function populateMonthsSelect() {
  selectMesFaturas.innerHTML = "";
  const now = new Date();

  // incluir últimos 12 meses (para permitir lançamentos retroativos)
  for (let i = 12; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const txt = `Fatura de ${d.toLocaleString("pt-BR", { month: "long" })} ${d.getFullYear()}`;
    const opt = new Option(txt, val);
    selectMesFaturas.appendChild(opt);
  }

  // incluir próximos 36 meses (flexível; pode ajustar)
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const txt = `Fatura de ${d.toLocaleString("pt-BR", { month: "long" })} ${d.getFullYear()}`;
    const opt = new Option(txt, val);
    selectMesFaturas.appendChild(opt);
  }
}

// Preenche o select de "fatura inicial" no form de lançamento (com passado+futuro)
function popularFaturasFuturas() {
  if (!selectFaturaInicial) return;
  selectFaturaInicial.innerHTML = "";

  const now = new Date();

  // últimos 24 meses (permitir registrar compras antigas)
  for (let i = 24; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const txt = `${d.toLocaleString("pt-BR", { month: "long" })} ${d.getFullYear()}`;
    selectFaturaInicial.appendChild(new Option(txt, val));
  }

  // próximos 60 meses (muito futuro para cobrir vários casos)
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const txt = `${d.toLocaleString("pt-BR", { month: "long" })} ${d.getFullYear()}`;
    selectFaturaInicial.appendChild(new Option(txt, val));
  }

  // default: escolher o mês da data de compra (se já preenchido) ou mês atual
  const def = new Date().toISOString().slice(0, 7);
  if ([...selectFaturaInicial.options].some(o => o.value === def)) {
    selectFaturaInicial.value = def;
  } else {
    selectFaturaInicial.selectedIndex = 24; // posição aproximada para mês atual
  }
}

// --------------------------- CARREGAR FATURAS (VIEW) ---------------------------

async function loadFaturasSelect() {
  await loadCards();
  populateMonthsSelect();
  await loadCategorias();
  await loadSelectsForLanc();

  if (selectCartaoFaturas.options.length > 0) {
    // selecionar primeiro cartão se não houver seleção
    if (!selectCartaoFaturas.value) selectCartaoFaturas.selectedIndex = 0;
    if (!selectMesFaturas.value) selectMesFaturas.selectedIndex = 12; // mês atual aproximado
    await loadFaturaForSelected();
  } else {
    // se não há cartões, abrir tela de novo cartão
    showView(viewNewCard);
  }
}

btnRefreshFaturas.onclick = () => loadFaturaForSelected();

selectMesFaturas.onchange = () => loadFaturaForSelected();

// Calculo utilitário: converte "YYYY-MM" para objeto Date no primeiro dia do mês
function dateFromYearMonth(ym) {
  const [y, m] = (ym || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

// Carrega compras do cartão no período do mês selecionado (inclui pagamentos negativos)
async function loadFaturaForSelected() {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  if (!cartao_id || !mesAno) {
    faturaSummary.innerHTML = "<div>Selecione cartão e mês.</div>";
    listaComprasFatura.innerHTML = "";
    return;
  }

  const [ano, mes] = mesAno.split("-").map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;

  // buscar todas as movimentações do cartão no período (inclui pagamentos antecipados tipo='pagamento')
  const { data: compras } = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .order("data_compra", { ascending: true });

  const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);

  const card = state.cards.find(x => x.id === cartao_id);

  faturaSummary.innerHTML = `
    <div class="big">${card?.nome || 'Cartão'}</div>
    <div>Período: ${mesAno}</div>
    <div class="big">Total: ${formatReal(total)}</div>
  `;

  listaComprasFatura.innerHTML = '';
  (compras || []).forEach(c => {
    const li = document.createElement('li');
    // destaque para pagamentos (valor negativo)
    li.innerHTML = `
      <strong>${formatDateShort(c.data_compra)}</strong> —
      ${c.descricao} — 
      ${formatReal(c.valor)}
    `;
    const bEdit = document.createElement('button');
    bEdit.textContent = 'Editar';
    bEdit.style.marginLeft = '10px';
    bEdit.onclick = () => editPurchase(c);

    const bDel = document.createElement('button');
    bDel.textContent = 'Excluir';
    bDel.style.marginLeft = '6px';
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
  const [ano, mes] = mesAno.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;

  // buscar compras com billed = false (ainda não faturadas) naquele período
  const { data: compras } = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .is('billed', false);

  if (!compras || compras.length === 0) return alert("Não há compras abertas para esse período.");

  // calcular total (compras positivas + pagamentos negativos já incluídos)
  const total = compras.reduce((s,c) => s + Number(c.valor || 0), 0);

  // criar fatura
  const { data: fdata } = await supabase.from("cartao_faturas")
    .insert([{
      cartao_id,
      user_id: state.user.id,
      mes,
      ano,
      valor_total: total,
      status: 'fechada'
    }]).select().single();

  // marcar lançamentos como faturados (billed = true) e associar fatura_id
  await supabase.from("cartao_lancamentos")
    .update({ billed: true, fatura_id: fdata.id })
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .is('billed', false);

  alert("Fatura fechada com sucesso!");
  await loadFaturaForSelected();
};

// --------------------------- PAGAR FATURA (gera despesa no app principal) ---------------------------

btnPagarFatura.onclick = async () => {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  const conta_id = selectContaPagamento.value;
  const data_venc = dataVencimentoFatura.value;

  if (!cartao_id || !mesAno || !conta_id || !data_venc) return alert("Preencha cartão, mês, conta e data de vencimento.");

  const [ano, mes] = mesAno.split('-').map(Number);

  // encontrar fatura
  const { data: f } = await supabase.from("cartao_faturas")
    .select("*")
    .eq("cartao_id", cartao_id)
    .eq("mes", mes)
    .eq("ano", ano)
    .maybeSingle();

  if (!f) return alert("Feche a fatura antes de pagar.");

  // somar compras vinculadas a essa fatura
  const { data: compras } = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("fatura_id", f.id);

  const total = (compras || []).reduce((s,c) => s + Number(c.valor || 0), 0);

  const card = state.cards.find(c => c.id === cartao_id);
  const descricao = `Fatura - ${card?.nome || 'Cartão'} ${mesAno}`;

  // criar despesa no app principal
  await supabase.from("despesas").insert([{
    descricao,
    valor: total,
    data: data_venc,
    conta_id,
    user_id: state.user.id,
    baixado: false
  }]);

  // marcar fatura como paga (campo pago)
  await supabase.from("cartao_faturas").update({ pago: true }).eq("id", f.id);

  alert("Despesa criada nas Despesas. Vá ao app principal para processar o pagamento.");
  await loadFaturaForSelected();
};
// --------------------------- LANÇAMENTO DE COMPRA (ADICIONAR / EDITAR) ---------------------------

// Função principal para ADICIONAR ou EDITAR uma compra
btnAddPurchase.onclick = async () => {
  // MODO EDIÇÃO
  if (state.editingPurchase) {
    const item = state.editingPurchase;

    const descricao = cartDesc.value.trim();
    const valor = Number(cartValor.value || 0);
    const dataCompra = cartData.value;
    const parcelas = Number(cartParcelas.value || 1);

    if (!descricao || !valor || !dataCompra) return alert("Preencha descrição, valor e data.");

    await supabase.from("cartao_lancamentos")
      .update({
        descricao,
        valor,
        data_compra: dataCompra,
        parcelas
      })
      .eq("id", item.id);

    alert("Compra atualizada!");
    state.editingPurchase = null;
    btnAddPurchase.textContent = "Adicionar Compra";

    cartDesc.value = "";
    cartValor.value = "";
    cartData.value = "";
    cartParcelas.value = 1;

    await loadFaturaForSelected();
    showView(viewFaturas);
    return;
  }

  // MODO ADICIONAR NOVA COMPRA
  const cartao_id = selectCartaoLanc.value;
  const descricao = cartDesc.value.trim();
  const valor = Number(cartValor.value || 0);
  const dataCompra = cartData.value;
  const parcelas = Number(cartParcelas.value || 1);
  const categoria_id = selectCategoriaLancCartao.value || null;

  if (!cartao_id) return alert("Selecione o cartão.");
  if (!descricao || !valor || !dataCompra) return alert("Preencha descrição, valor e data.");

  // --------------- PEGAR FATURA INICIAL SELECIONADA PELO USUÁRIO ----------------

  const ymInicial = selectFaturaInicial.value; // yyyy-mm
  let [anoIni, mesIni] = ymInicial.split("-").map(Number);

  // --------------- PARCELA ATUAL (PARA COMPRAS ANTIGAS) ----------------

  let parcelaAtual = Number(parcelaInicialInput.value);
  if (parcelaAtual < 1) parcelaAtual = 1;
  if (parcelaAtual > parcelas) parcelaAtual = parcelas;

  // --------------- GERAR TODAS AS PARCELAS A PARTIR DA FATURA INICIAL ---------------

  for (let p = parcelaAtual; p <= parcelas; p++) {

    // calcular o mês da parcela p
    const dt = new Date(anoIni, mesIni - 1 + (p - parcelaAtual), 1);

    const dataISO =
      dt.getFullYear() + "-" +
      String(dt.getMonth() + 1).padStart(2, "0") + "-" +
      String(dt.getDate()).padStart(2, "0");

    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id,
      descricao: `${descricao} (${p}/${parcelas})`,
      valor: (valor / parcelas).toFixed(2),
      data_compra: dataISO,
      parcelas,
      parcela_atual: p,
      categoria_id,
      tipo: 'compra',
      billed: false
    }]);
  }

  alert("Compra adicionada com sucesso.");

  // limpar formulário
  cartDesc.value = "";
  cartValor.value = "";
  cartData.value = "";
  cartParcelas.value = 1;
  parcelaInicialInput.value = 1;

  await loadFaturaForSelected();
};


// --------------------------- CANCELAR EDIÇÃO ---------------------------

btnCancelPurchase.onclick = () => {
  state.editingPurchase = null;
  btnAddPurchase.textContent = "Adicionar Compra";
  cartDesc.value = "";
  cartValor.value = "";
  cartData.value = "";
  cartParcelas.value = 1;
  parcelaInicialInput.value = 1;
};


// --------------------------- EDITAR LANÇAMENTO ---------------------------

function editPurchase(item) {
  state.editingPurchase = item;

  selectCartaoLanc.value = item.cartao_id;
  cartDesc.value = item.descricao;
  cartValor.value = item.valor;
  cartData.value = item.data_compra;
  cartParcelas.value = item.parcelas || 1;

  // ajustar fatura inicial automaticamente
  const ym = item.data_compra.slice(0, 7);
  if ([...selectFaturaInicial.options].some(o => o.value === ym)) {
    selectFaturaInicial.value = ym;
  }

  // ajustar parcela inicial para edição
  parcelaInicialInput.value = item.parcela_atual || 1;

  btnAddPurchase.textContent = "Salvar Alterações";
  showView(viewLancamento);
}


// --------------------------- EXCLUIR LANÇAMENTO ---------------------------

async function deletePurchase(item) {
  if (!confirm("Excluir esta compra?")) return;

  await supabase.from("cartao_lancamentos").delete().eq("id", item.id);

  alert("Compra excluída!");
  await loadFaturaForSelected();
}
// --------------------------- PAGAMENTO ANTECIPADO (UI + LÓGICA) ---------------------------

// Mostrar caixa de pagamento antecipado
btnPagamentoAntecipado?.addEventListener("click", async () => {
  await loadSelectsForLanc(); // carrega categorias + contas

  // copiar contas para o select específico do pagamento antecipado
  contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;

  valorPagAntecipado.value = "";
  dataPagAntecipado.value = new Date().toISOString().slice(0, 10);

  showView(boxPagAntecipado);
});

// Confirmar pagamento antecipado
btnConfirmarPagAntecipado?.addEventListener("click", async () => {
  const conta_id = contaPagAntecipado.value;
  const valor = Number(valorPagAntecipado.value || 0);
  const dataPag = dataPagAntecipado.value;
  const cartao_id = selectCartaoFaturas.value;

  if (!conta_id || !valor || !dataPag) {
    alert("Preencha conta, valor e data.");
    return;
  }

  // 1) Registrar pagamento antecipado no cartão (valor negativo reduz a fatura)
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

  // 2) Criar despesa no app principal
  await supabase.from("despesas").insert([{
    descricao: `Pagamento antecipado - Cartão`,
    valor: valor,
    data: dataPag,
    conta_id,
    user_id: state.user.id,
    baixado: false
  }]);

  alert("Pagamento antecipado registrado!");

  showView(viewFaturas);
  await loadFaturaForSelected();
});


// --------------------------- HISTÓRICO DE FATURAS ---------------------------

async function loadHistoricoFaturas() {

  const { data } = await supabase.from("cartao_faturas")
    .select("*, cartoes_credito(nome)")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  listaFaturasHistorico.innerHTML = "";

  (data || []).forEach((f) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${f.cartoes_credito?.nome || "Cartão"}</strong>
      • ${String(f.mes).padStart(2,"0")}/${f.ano}
      — ${formatReal(f.valor_total || 0)}
      — ${f.pago ? "Paga" : f.status}
    `;
    listaFaturasHistorico.appendChild(li);
  });

  showView(viewHistorico);
}


// --------------------------- CARREGAR CONTAS PARA PAGAMENTO / LANÇAMENTO ---------------------------

async function loadSelectsForLanc() {
  await loadCategorias();

  const { data: contas } = await supabase.from("contas_bancarias")
    .select("*")
    .eq("user_id", state.user.id);

  selectContaPagamento.innerHTML = "";

  contas.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.nome} (${formatReal(c.saldo_atual || c.saldo_inicial)})`;
    selectContaPagamento.appendChild(opt);
  });
}
// --------------------------- INICIALIZAÇÃO FINAL ---------------------------

await loadCards();       // carrega os cartões
await loadCategorias();  // carrega categorias
populateMonthsSelect();  // carrega meses das faturas
popularFaturasFuturas(); // carrega faturas para lançamento

// view inicial: faturas
showView(viewFaturas);

})(); // fim da IIFE (função autoexecutável)
