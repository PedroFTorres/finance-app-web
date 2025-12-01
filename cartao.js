// cartao.js — módulo independente do Finance App
// COMPLETO + PAGAMENTO ANTECIPADO INTEGRADO

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

const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
const boxPagAntecipado = document.getElementById("box-pag-antecipado");
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

const btnAddPurchase = document.getElementById("btn-add-purchase");
const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

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

// --------------------------- CATEGORIES ---------------------------

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
// --------------------------- LANÇAMENTO DE COMPRA (ADICIONAR / EDITAR) ---------------------------

btnAddPurchase.onclick = async () => {
  // Modo edição
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

    cartDesc.value = ""; cartValor.value = ""; cartData.value = ""; cartParcelas.value = 1;

    await loadFaturaForSelected();
    showView(viewFaturas);
    return;
  }

  // Modo adicionar
  const cartao_id = selectCartaoLanc.value;
  const descricao = cartDesc.value.trim();
  const valor = Number(cartValor.value || 0);
  const dataCompra = cartData.value;
  const parcelas = Number(cartParcelas.value || 1);
  const categoria_id = selectCategoriaLancCartao.value || null;

  if (!cartao_id) return alert("Selecione o cartão.");
  if (!descricao || !valor || !dataCompra) return alert("Preencha descrição, valor e data.");

  // Se parcelado, registra parcelas (cada uma como lançamento separado)
  for (let p = 1; p <= parcelas; p++) {
    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id,
      descricao: `${descricao} (${p}/${parcelas})`,
      valor: (valor / parcelas).toFixed(2),
      data_compra: dataCompra,
      parcelas,
      parcela_atual: p,
      tipo: 'compra',
      billed: false
    }]);
  }

  alert("Compra adicionada com sucesso.");
  cartDesc.value = ""; cartValor.value = ""; cartData.value = ""; cartParcelas.value = 1;

  await loadFaturaForSelected();
};

btnCancelPurchase.onclick = () => {
  state.editingPurchase = null;
  btnAddPurchase.textContent = "Adicionar Compra";
  cartDesc.value = ""; cartValor.value = ""; cartData.value = ""; cartParcelas.value = 1;
};

// --------------------------- EDITAR / EXCLUIR (funções reutilizadas) ---------------------------

function editPurchase(item) {
  state.editingPurchase = item;

  selectCartaoLanc.value = item.cartao_id;
  cartDesc.value = item.descricao;
  cartValor.value = item.valor;
  cartData.value = item.data_compra;
  cartParcelas.value = item.parcelas || 1;

  btnAddPurchase.textContent = "Salvar Alterações";
  showView(viewLancamento);
}

async function deletePurchase(item) {
  if (!confirm("Excluir esta compra?")) return;

  await supabase.from("cartao_lancamentos").delete().eq("id", item.id);

  alert("Compra excluída!");
  await loadFaturaForSelected();
}

// --------------------------- PAGAMENTO ANTECIPADO (UI + LÓGICA) ---------------------------

// Mostrar caixa de pagamento antecipado
btnPagamentoAntecipado?.addEventListener("click", async () => {
  // carregar contas para pagamento (reutilizando)
  await loadSelectsForLanc();
  // copiar options para select específico
  contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
  valorPagAntecipado.value = "";
  dataPagAntecipado.value = new Date().toISOString().slice(0,10);
  boxPagAntecipado.classList.remove("hidden");
});

// Confirmar pagamento antecipado
btnConfirmarPagAntecipado?.addEventListener("click", async () => {
  const conta_id = contaPagAntecipado.value;
  const valor = Number(valorPagAntecipado.value || 0);
  const dataPag = dataPagAntecipado.value;
  const cartao_id = selectCartaoFaturas.value;

  if (!conta_id || !valor || !dataPag) return alert("Preencha conta, valor e data.");

  // 1) Registrar pagamento antecipado no cartão como tipo 'pagamento' com valor positivo ou negativo?
  // Vamos registrar como tipo 'pagamento' com valor NEGATIVO para que a fatura some corretamente.
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

  // 2) Criar despesa no app principal (débito na conta)
  await supabase.from("despesas").insert([{
    descricao: `Pagamento antecipado - Cartão`,
    valor: valor,
    data: dataPag,
    conta_id,
    user_id: state.user.id,
    baixado: false
  }]);

  alert("Pagamento antecipado registrado e despesa criada.");
  boxPagAntecipado.classList.add("hidden");
  await loadFaturaForSelected();
});

// Cancelar exibição do box (clicar fora ou navegar)
boxPagAntecipado?.addEventListener("click", (e) => {
  // evitar fechar quando clicar dentro (se implementar overlay) - aqui deixamos simples
});

// --------------------------- MESES / SELECTS FATURA ---------------------------

function populateMonthsSelect() {
  selectMesFaturas.innerHTML = "";
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const opt = document.createElement("option");
    opt.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opt.textContent = `${d.toLocaleString('pt-BR',{month:'long'})} ${d.getFullYear()}`;
    selectMesFaturas.appendChild(opt);
  }
}

// --------------------------- PARTE 3/3: FATURAS, FECHAR, PAGAR, HISTÓRICO ---------------------------
// --------------------------- CARREGAR E RENDERIZAR FATURA ---------------------------

async function loadFaturasSelect(){
  await loadCards();
  populateMonthsSelect();
  await loadCategorias();
  await loadSelectsForLanc();

  if (selectCartaoFaturas.options.length > 0) {
    selectCartaoFaturas.selectedIndex = 0;
    selectMesFaturas.selectedIndex = 0;
    await loadFaturaForSelected();
  } else {
    // se não há cartões, abrir tela de novo cartão
    showView(viewNewCard);
  }
}

btnRefreshFaturas.onclick = () => loadFaturaForSelected();

async function loadFaturaForSelected(){
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  if (!cartao_id || !mesAno) return;

  const [ano, mes] = mesAno.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  // buscar todas as movimentações do cartão no período (inclui pagamentos antecipados tipo='pagamento')
  const { data: compras } = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .order("data_compra");

  const total = (compras || []).reduce((s,c) => s + Number(c.valor || 0), 0);

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
    const venc = new Date(ano, mes-1, card.dia_vencimento || 25);
    dataVencimentoFatura.value = formatISO(venc);
  }
}

// --------------------------- FECHAR FATURA ---------------------------

btnFecharFatura.onclick = async () => {
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  if (!cartao_id || !mesAno) return alert("Selecione cartão e mês.");
  const [ano, mes] = mesAno.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(last).padStart(2,'0')}`;

  // buscar compras com billed = false (ainda não faturadas)
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

// --------------------------- HISTÓRICO ---------------------------

async function loadHistoricoFaturas(){
  const { data } = await supabase.from("cartao_faturas")
    .select("*,cartoes_credito(nome)")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending:false });

  listaFaturasHistorico.innerHTML = '';
  (data || []).forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${f.cartoes_credito?.nome || 'Cartão'}</strong> • ${f.mes}/${f.ano} — ${formatReal(f.valor_total||0)} — ${f.pago ? 'Paga' : f.status}`;
    listaFaturasHistorico.appendChild(li);
  });

  showView(viewHistorico);
}

// --------------------------- CARREGAR CONTAS PARA PAGAMENTO ---------------------------

async function loadSelectsForLanc(){
  await loadCategorias();

  const { data: contas } = await supabase.from("contas_bancarias")
    .select("*")
    .eq("user_id", state.user.id);

  selectContaPagamento.innerHTML = '';
  contas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.nome} (${formatReal(c.saldo_atual || c.saldo_inicial)})`;
    selectContaPagamento.appendChild(opt);
  });
}

// --------------------------- INICIALIZAÇÃO FINAL ---------------------------

await loadCards();
await loadCategorias();
populateMonthsSelect();
showView(viewFaturas);

})(); // fim IIFE
