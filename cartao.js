// cartao.js — Versão atualizada com modal de escolha de conta ao fechar fatura
// Mantém todas as funcionalidades: CRUD cartões, faturas, lançamentos parcelados,
// edição de parcelas, antecipação, pagamento antecipado, fechar/pagar/reabrir fatura,
// histórico, toasts, modais.
// Observação: supabase deve estar disponível em window.supabase (carregado antes).

document.addEventListener("DOMContentLoaded", () => {

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

  // ===========================// ESTADO // ===========================
  const state = {
    user: null,
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
  const viewEditarCompra = document.getElementById("view-editar-compra");
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
  const mesDisplay = document.getElementById("mes-display");
  const btnMesPrev = document.getElementById("mes-prev");
  const btnMesNext = document.getElementById("mes-next");

  const faturaTitulo = document.getElementById("fatura-titulo");
const faturaPeriodo = document.getElementById("fatura-periodo");
const faturaTotal = document.getElementById("fatura-total");
const listaComprasFatura = document.getElementById("lista-fatura");

  const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");
  const cartDesc = document.getElementById("cart-desc");
  const cartValor = document.getElementById("cart-valor");
  const cartData = document.getElementById("cart-data");
  const cartParcelas = document.getElementById("cart-parcelas");

  const fatDisplay = document.getElementById("fat-display");
  const btnFatPrev = document.getElementById("fat-prev");
  const btnFatNext = document.getElementById("fat-next");

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

  function formatISO(d) {
    return new Date(d).toISOString().slice(0,10);
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

  function hideAllViews() {
    [
      viewNewCard, viewFaturas, viewLancamento, viewHistorico,
      boxPagAntecipado, viewEditarCompra, viewEditarAvista
    ].forEach((v) => v?.classList.add("hidden"));
  }

  function showView(v) {
    hideAllViews();
    v?.classList.remove("hidden");
  }

  // ===========================// SESSÃO // ===========================
  (async () => {
    const sessionResp = await supabase.auth.getSession();
    if (!sessionResp.data.session) {
      window.location.href = "login.html";
      return;
    }

    state.user = sessionResp.data.session.user;
    if (userEmail) userEmail.textContent = state.user.email;

    try {
     await loadCards();
renderCardsSidebar();

await loadCategorias();

popularMesFatura();
popularFaturasLancamento();

await loadFaturaForSelected();


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

    el.innerHTML = `
      <div class="nome">${c.nome}</div>
      <div class="info">Limite: ${formatReal(c.limite)}</div>
      <div class="info">Fecha ${c.dia_fechamento} • Venc ${c.dia_vencimento}</div>
    `;

    el.onclick = async () => {
  activeCardId = c.id;
  renderCardsSidebar();
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

  // =========================== // MES NAV // ===========================
  function displayMes(dateObj) {
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    return `${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }

  function popularMesFatura() {
    if (mesDisplay) mesDisplay.textContent = displayMes(mesFatura);
    if (selectMesFaturas) selectMesFaturas.value = `${mesFatura.getFullYear()}-${String(mesFatura.getMonth()+1).padStart(2,"0")}`;
  }

  if (btnMesPrev) btnMesPrev.onclick = () => { mesFatura.setMonth(mesFatura.getMonth()-1); popularMesFatura(); loadFaturaForSelected(); };
  if (btnMesNext) btnMesNext.onclick = () => { mesFatura.setMonth(mesFatura.getMonth()+1); popularMesFatura(); loadFaturaForSelected(); };

  function popularFaturasLancamento() {
    if (fatDisplay) fatDisplay.textContent = displayMes(mesLanc);
    if (selectFaturaInicial) selectFaturaInicial.value = `${mesLanc.getFullYear()}-${String(mesLanc.getMonth()+1).padStart(2,"0")}`;
  }
  if (btnFatPrev) btnFatPrev.onclick = () => { mesLanc.setMonth(mesLanc.getMonth()-1); popularFaturasLancamento(); };
  if (btnFatNext) btnFatNext.onclick = () => { mesLanc.setMonth(mesLanc.getMonth()+1); popularFaturasLancamento(); };

  // =========================== // CARREGAR FATURA / RENDER (USANDO data_fatura) // ===========================
 async function loadFaturaForSelected() {
  if (!activeCardId && state.cards && state.cards.length > 0) {
    activeCardId = state.cards[0].id;
  }
  if (!activeCardId) return;

  const cartao_id = activeCardId;
  const ano = mesFatura.getFullYear();
  const mes = mesFatura.getMonth() + 1;

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${last}`;

  const { data: compras } = await supabase
    .from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_fatura", inicio)
    .lte("data_fatura", fim)
    .order("data_fatura");

  const total = (compras || []).reduce(
    (s, c) => s + Number(c.valor || 0),
    0
  );

  const card = state.cards.find(c => c.id === cartao_id);

  if (faturaTitulo) {
    faturaTitulo.textContent = card?.nome || "Cartão";
  }

  if (faturaPeriodo) {
    faturaPeriodo.textContent = `${String(mes).padStart(2, "0")}/${ano}`;
  }

  if (faturaTotal) {
    faturaTotal.textContent = formatReal(total);
  }

  if (listaComprasFatura) {
    listaComprasFatura.innerHTML = "";

    (compras || []).forEach((c) => {
      const li = document.createElement("li");

      const dataExibida = c.data_compra
        ? new Date(c.data_compra + "T00:00:00").toLocaleDateString("pt-BR")
        : "";

      li.innerHTML = `
        <span>${dataExibida} — ${c.descricao}</span>
        <span>${formatReal(c.valor)}</span>
      `;

      li.style.cursor = "pointer";
      li.onclick = () => {
        if (Number(c.parcelas || 0) === 1) abrirEdicaoAvista(c);
        else abrirEdicaoCompraParcelada(c);
      };

      listaComprasFatura.appendChild(li);
    });
  }

  const { data: faturaDB } = await supabase
    .from("cartao_faturas")
    .select("*")
    .eq("user_id", state.user.id)
    .eq("cartao_id", cartao_id)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  state.faturaAtual = faturaDB || {
    inicio,
    fim,
    mes,
    ano,
    status: "aberta"
  };

  updateButtonsForFatura();
  await loadSelectsForLanc();
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
    .select("id, nome")
    .eq("user_id", state.user.id)
    .order("nome");

  contaFaturaSelect.innerHTML = "";

  (contas || []).forEach(c => {
    contaFaturaSelect.appendChild(
      new Option(c.nome, c.id)
    );
  });

  if ((contas || []).length === 0) {
    contaFaturaSelect.appendChild(
      new Option("Nenhuma conta disponível", "")
    );
  }
}

 async function fecharFaturaComConta(conta_id) {
  try {
    if (!activeCardId)
      return showToast("Selecione um cartão.", "error");

    if (!state.faturaAtual)
      return showToast("Fatura não encontrada.", "error");

    const venc = document.getElementById("conta-fatura-vencimento")?.value;
    if (!venc)
      return showToast("Informe o vencimento.", "error");

    const inicio = state.faturaAtual.inicio;
    const fim = state.faturaAtual.fim;
    const mes = state.faturaAtual.mes;
    const ano = state.faturaAtual.ano;

    // buscar compras
    const { data: compras, error: errCompras } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", activeCardId)
      .gte("data_fatura", inicio)
      .lte("data_fatura", fim);

    if (errCompras) throw errCompras;

    const total = (compras || []).reduce(
      (s, c) => s + Number(c.valor || 0),
      0
    );

const { data: fData, error: errFatura } = await supabase
  .from("cartao_faturas")
  .insert([{
    id: crypto.randomUUID(),
    user_id: state.user.id,
    cartao_id: activeCardId,
    mes,
    ano,
    vencimento: venc,
    total,
    status: "fechada"
  }])
  .select()
  .single();

if (errFatura) throw errFatura;


    // categoria Cartão
    const categoriaId = await getOrCreateCategoria("Cartão de Crédito");

    const card =
      state.cards.find(c => c.id === activeCardId) || { nome: "Cartão" };

    // criar despesa
    const { error: errDesp } = await supabase.from("despesas").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      conta_id: conta_id,
      descricao: `Fatura ${card.nome} — ${String(mes).padStart(2,"0")}/${ano}`,
      valor: total,
      data: venc,
      categoria_id: categoriaId,
      baixado: false,
      cartao_fatura_id: fData.id
    }]);

    if (errDesp)
      showToast("Fatura criada, mas erro ao criar despesa.", "error");
    else
      showToast("Fatura fechada e despesa criada.", "success");

    state.faturaAtual.status = "fechada";

    if (modalContaFatura)
      modalContaFatura.classList.add("hidden");

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
  if (btnPagarFatura) btnPagarFatura.onclick = async () => {
    try {
      if (!state.faturaAtual) return showToast("Feche a fatura antes de pagar.", "error");
      if (state.faturaAtual.pago) return showToast("Esta fatura já foi paga.", "error");

      const contaId = selectContaPagamento.value;
      const venc = dataVencimentoFatura.value;

      if (!contaId) return showToast("Selecione a conta para pagamento.", "error");

      const total = Number(state.faturaAtual.valor_total || 0);
      if (total <= 0) return showToast("Fatura sem valor.", "error");

      // localizar despesa vinculada
      const { data: desp } = await supabase.from("despesas").select("*").eq("cartao_fatura_id", state.faturaAtual.id).maybeSingle();

      let despId;
      if (!desp) {
        // cria despesa já baixada
        despId = crypto.randomUUID();
        const { error: err } = await supabase.from("despesas").insert([{
          id: despId,
          user_id: state.user.id,
          conta_id: contaId,
          descricao: `Pagamento fatura ${state.faturaAtual.id}`,
          valor: total,
          data: venc,
          categoria_id: null,
          baixado: true,
          data_baixa: venc,
          cartao_fatura_id: state.faturaAtual.id
        }]);
        if (err) { console.error(err); return showToast("Erro ao gerar despesa.", "error"); }
      } else {
        despId = desp.id;
        await supabase.from("despesas").update({ baixado: true, conta_id: contaId, data_baixa: venc }).eq("id", despId);
      }

      // criar movimentação
      await supabase.from("movimentacoes").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        conta_id: contaId,
        tipo: "debito",
        valor: total,
        descricao: `Pagamento fatura ${state.faturaAtual.id}`,
        data: venc,
        lancamento_id: despId
      }]);

      // atualizar saldo
      const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id", contaId).single();
      const novoSaldo = Number(conta.saldo_atual || 0) - total;
      await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaId);

      // marcar fatura como paga
      await supabase.from("cartao_faturas").update({ pago: true, status: "paga", data_vencimento: venc }).eq("id", state.faturaAtual.id);

      showToast("Fatura paga com sucesso!");
      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      showToast("Erro ao pagar fatura.", "error");
    }
  };

  // ===========================// REABRIR FATURA// ===========================
  async function reabrirFatura() {
    if (!state.faturaAtual) return showToast("Nenhuma fatura selecionada.", "error");
    if (state.faturaAtual.pago) return showToast("Não é possível reabrir fatura paga.", "error");
    if (!confirm("Deseja realmente reabrir esta fatura?")) return;

    try {
      const { error } = await supabase.from("cartao_faturas").delete().eq("id", state.faturaAtual.id);
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
      let dataBase = new Date(dataCompra);

      // ================= INSERT =================
      for (let p = 1; p <= parcelas; p++) {
        const dataFaturaISO = new Date(
          dataBase.getFullYear(),
          dataBase.getMonth() + (p - 1),
          1
        ).toISOString().slice(0, 10);

        await supabase.from("cartao_lancamentos").insert([{
          id: crypto.randomUUID(),
          user_id: state.user.id,
          cartao_id: state.cartaoLancamentoAtual,
          descricao: parcelas > 1 ? `${descricao} (${p}/${parcelas})` : descricao,
          valor: valorParcela,
          data_compra: dataCompra,
          data_fatura: dataFaturaISO,
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

  // ===========================// PAGAMENTO ANTECIPADO// ===========================
  if (btnPagamentoAntecipado) btnPagamentoAntecipado.onclick = async () => {
    await loadSelectsForLanc();
    contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
    valorPagAntecipado.value = "";
    dataPagAntecipado.value = formatISO(new Date());
    showView(boxPagAntecipado);
  };

  if (btnConfirmarPagAntecipado) btnConfirmarPagAntecipado.onclick = async () => {
    const conta = contaPagAntecipado.value;
    const valor = Number(valorPagAntecipado.value || 0);
    const data = dataPagAntecipado.value;

    if (!conta || !valor || !data) return showToast("Preencha todos os campos.", "error");

    await supabase.from("cartao_lancamentos").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      cartao_id: state.cartaoLancamentoAtual || activeCardId,
      tipo: "pagamento",
      descricao: "Pagamento antecipado",
      valor: -Math.abs(valor),
      data_compra: data,
      parcelas: 1,
      parcela_atual: 1,
      billed: false
    }]);

    showToast("Pagamento antecipado registrado.");
    await loadFaturaForSelected();
  };

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

  // ===========================// SELECTS AUXILIARES// ===========================
  async function loadSelectsForLanc() {
    await loadCategorias();
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

    selectContaPagamento.innerHTML = "";
    (contas || []).forEach((c) =>
      selectContaPagamento.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual)})`, c.id))
    );
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
  ensureAvistaViewExists();

  document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;

  document.getElementById("avista-desc").value =
    (l.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

  document.getElementById("avista-valor").value = Number(l.valor);

  document.getElementById("avista-data").value =
    l.data_compra || l.data || "";

  await popularSelectCategoriaAvista(l.categoria_id);
  await popularSelectCartaoAvista(l.cartao_id);

  viewEditarAvista.dataset.lancId = l.id;
  showView(viewEditarAvista);
}

  async function popularSelectCategoriaAvista(id) {
    const { data } = await supabase.from("categorias").select("*").order("nome");
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
      .eq("id", id);

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

    await supabase.from("cartao_lancamentos").delete().eq("id", id);

    showToast("Compra excluída.");
    await loadFaturaForSelected();
 
  }

  // ===========================// EDIÇÃO PARCELADA // ===========================
  
  async function abrirEdicaoCompraParcelada(c) {
  try {
    // 🔒 garante que a view existe
    if (!viewEditarCompra) {
      showToast("Tela de edição parcelada não disponível.", "error");
      return;
    }

    // 🔒 garante que os campos existem
    const elDesc = document.getElementById("edit-desc");
    const elValor = document.getElementById("edit-valor-total");
    const elData = document.getElementById("edit-data-inicial");
    const elParcelas = document.getElementById("edit-total-parcelas");

    if (!elDesc || !elValor || !elData || !elParcelas) {
      showToast("Campos da edição parcelada não encontrados.", "error");
      return;
    }

    const base = (c.descricao || "")
      .replace(/\s*\(\d+\/\d+\)\s*$/, "")
      .trim();

    const q = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", c.cartao_id)
      .ilike("descricao", `${base}%`)
      .order("parcela_atual", { ascending: true });

    if (!q.data || q.data.length === 0) {
      showToast("Não foi possível carregar parcelas.", "error");
      return;
    }

    state.editingPurchaseParcels = q.data;
    state.editingPurchaseFull = q.data[0];

    // preencher campos com segurança
    elDesc.value = base;
    elValor.value = q.data.reduce((s, p) => s + Number(p.valor), 0);
    elData.value = q.data[0].data_compra || "";
    elParcelas.value = q.data.length;

    await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
    await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

    renderParcelasEdicao();
    showView(viewEditarCompra);
    // botão voltar da edição parcelada
const btnVoltar = document.getElementById("btn-voltar-edicao");
if (btnVoltar) {
  btnVoltar.onclick = async () => {
    await loadFaturaForSelected();
    showView(viewFaturas);
  };
}

  } catch (err) {
    console.error(err);
    showToast("Erro ao abrir edição parcelada.", "error");
  }
}

  function renderParcelasEdicao() {
    const lista = document.getElementById("lista-parcelas-editar");
    lista.innerHTML = "";

    const parcelas = state.editingPurchaseParcels || [];
    const total = parcelas.length;

    parcelas.forEach((p) => {
      const li = document.createElement("li");
      li.className = "parcela-item";
      li.dataset.parcelaId = p.id;

      li.innerHTML = `
        <span>(${p.parcela_atual}/${total}) — 
          ${new Date(p.data_fatura + "T00:00:00").toLocaleDateString("pt-BR")} —
          ${formatReal(p.valor)}
        </span>
        <div class="parcela-actions">
          <button class="btn-secondary btn-edit">Editar</button>
          <button class="btn-danger btn-del">Excluir</button>
          <button class="btn-primary btn-ant">Antecipar</button>
        </div>`;

      li.querySelector(".btn-edit").onclick = () => abrirModalEditarParcela(p);
      li.querySelector(".btn-del").onclick = () => excluirParcela(p.id);
      li.querySelector(".btn-ant").onclick = () => anteciparParcela(p.id);

      lista.appendChild(li);
    });
  }

  // ===========================// MODAL EDITAR PARCELA// ===========================
  let parcelaEditandoId = null;

  function abrirModalEditarParcela(parcela) {
    parcelaEditandoId = parcela.id;
    modalParcelaValor.value = parcela.valor;
    modalParcelaData.value = parcela.data_fatura || parcela.data_compra || "";
    modalEditarParcela.classList.remove("hidden");
  }

  function fecharModalEditarParcela() {
    parcelaEditandoId = null;
    modalEditarParcela.classList.add("hidden");
  }

  if (modalParcelaCancelar) modalParcelaCancelar.onclick = fecharModalEditarParcela;

  if (modalParcelaSalvar) modalParcelaSalvar.onclick = async () => {
    const novoValor = Number(modalParcelaValor.value);
    const novaData = modalParcelaData.value;

    if (!novaData || !novoValor)
      return showToast("Preencha todos os campos.", "error");

    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({ valor: novoValor, data_fatura: novaData })
      .eq("id", parcelaEditandoId);

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

    const { error } = await supabase.from("cartao_lancamentos").delete().eq("id", id);

    if (error) {
      console.error(error);
      return showToast("Erro ao excluir parcela.", "error");
    }

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
    const { data } = await supabase.from("categorias").select("*").order("nome");
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
  if (document.getElementById("btn-salvar-edicao"))
    document.getElementById("btn-salvar-edicao").onclick = async () => {
      try {
        const idFull = state.editingPurchaseFull.id;
        const desc = document.getElementById("edit-desc").value.trim();
        const total = Number(document.getElementById("edit-valor-total").value || 0);
        const dataIni = document.getElementById("edit-data-inicial").value;
        const totalParcelas = Number(document.getElementById("edit-total-parcelas").value || 1);
        const categoria = document.getElementById("edit-categoria").value;
        const cartao = document.getElementById("edit-cartao").value;

        // limpar "(x/y)" da descrição
        const descLimpa = desc.replace(/\s*\(\d+\/\d+\)\s*$/, "");

        // atualizar apenas o registro base da compra
        const { error } = await supabase
          .from("cartao_lancamentos")
          .update({
            descricao: descLimpa,
            categoria_id: categoria,
            cartao_id: cartao
          })
          .eq("id", idFull);

        if (error) {
          console.error(error);
          return showToast("Erro ao salvar edição.", "error");
        }

        showToast("Alterações aplicadas (parcial). Atualize valores individuais se necessário.");
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
        await supabase.from("cartao_lancamentos").delete().in("id", ids);

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

   if (selectContaPagamento) {
  selectContaPagamento.innerHTML = "";

  (contas || []).forEach((c) =>
   selectContaPagamento.appendChild(
  new Option(c.nome, c.id)
     )
);
}

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

  if (cardNome) cardNome.value = "";
  if (cardLimite) cardLimite.value = "";
  if (cardDiaFechamento) cardDiaFechamento.value = "";
  if (cardDiaVencimento) cardDiaVencimento.value = "";

  showView(viewNewCard);
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
  btnGerarDespesa.onclick = () => {
    if (!activeCardId) {
      showToast("Selecione um cartão primeiro.", "warning");
      return;
    }

    // guarda o cartão ativo
    state.cartaoSelecionado = activeCardId;

    // abre a tela de lançamento
    showView(viewLancamento);
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
   
  };
}
 

}); // fim DOMContentLoaded

// ==================================================================================// FIM do arquivo cartao.js// ==================================================================================
