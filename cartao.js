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

  try {
    // 🔹 carregar dados básicos
    await loadCards();
    renderCardsSidebar();
    await loadCategorias();

  // 🔹 inicialização da fatura (UMA ÚNICA VEZ)
mesFatura = new Date();   // 🔥 GARANTE base válida
await definirMesInicialAberto();

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

  let cursor = new Date(
    mesFatura.getFullYear(),
    mesFatura.getMonth(),
    1
  );

  for (let i = 0; i < 24; i++) {
    const ano = cursor.getFullYear();
    const mes = cursor.getMonth() + 1;

    const { data: fatura } = await supabase
      .from("cartao_faturas")
      .select("status, pago")
      .eq("user_id", state.user.id)
      .eq("cartao_id", activeCardId)
      .eq("ano", ano)
      .eq("mes", mes)
      .maybeSingle();

    // 👉 só aceita fatura NÃO paga
    if (!fatura || fatura.pago !== true) {
      mesFatura = new Date(ano, mes - 1, 1);
      popularMesFatura();
      await loadFaturaForSelected();
      return;
    }

    cursor.setMonth(cursor.getMonth() + 1);
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
    .gte("data_fatura", inicio)
    .lte("data_fatura", fim)
    .order("data_fatura");

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
      <li style="opacity:.7;font-style:italic">
        Nenhuma compra lançada nesta fatura
      </li>
    `;
  } else {
    compras.forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${c.descricao}</span>
        <span>${Number(c.valor).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        })}</span>
      `;
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
    if (!activeCardId) {
      showToast("Selecione um cartão.", "error");
      return;
    }

    if (!state.faturaAtual) {
      showToast("Fatura não encontrada.", "error");
      return;
    }

    const venc = document.getElementById("conta-fatura-vencimento")?.value;
    if (!venc) {
      showToast("Informe o vencimento.", "error");
      return;
    }

    const inicio = state.faturaAtual.inicio;
    const fim = state.faturaAtual.fim;
    const mes = state.faturaAtual.mes;
    const ano = state.faturaAtual.ano;

    // 🔹 buscar compras da fatura atual
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

    // 🔹 cria registro da fatura (FECHAR)
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

    // 🔹 cria a DESPESA (AQUI É O PONTO-CHAVE)
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

    showToast("Fatura fechada e despesa criada.", "success");

    // ==================================================
    // 🔥 REGRA DEFINITIVA: // SÓ AGORA AVANÇA PARA O PRÓXIMO MÊS // ==================================================
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
        .maybeSingle();

      if (!desp) {
        showToast("Despesa da fatura não encontrada.", "error");
        return;
      }

      // 🔹 baixa despesa
      await supabase
        .from("despesas")
        .update({
          baixado: true,
          conta_id: contaId,
          data_baixa: venc
        })
        .eq("id", desp.id);

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

      // 🔹 atualizar saldo
      const { data: conta } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("id", contaId)
        .single();

      const novoSaldo = Number(conta.saldo_atual || 0) - total;

      await supabase
        .from("contas_bancarias")
        .update({ saldo_atual: novoSaldo })
        .eq("id", contaId);

      // 🔹 marcar fatura como PAGA
      await supabase
        .from("cartao_faturas")
        .update({
          pago: true,
          status: "paga"
        })
        .eq("id", state.faturaAtual.id);

      showToast("Fatura paga com sucesso!", "success");

      // ======================================================
      // 🔥 REGRA PRINCIPAL (FINAL)
      // após PAGAR, mostrar a próxima fatura ABERTA
      // ======================================================

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

    // descrição base (remove "(x/y)")
    const base = (c.descricao || "")
      .replace(/\s*\(\d+\/\d+\)\s*$/, "")
      .trim();

    // 🔒 data mínima para edição:
    // usa fatura atual se existir, senão usa a data da parcela clicada
    const dataInicioEdicao = state.faturaAtual?.inicio || c.data_fatura;

    const { data: parcelas, error } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", c.cartao_id)
      .ilike("descricao", `${base}%`)
      .gte("data_fatura", dataInicioEdicao)
      .order("data_fatura", { ascending: true });

    if (error) {
      console.error(error);
      showToast("Erro ao carregar parcelas.", "error");
      return;
    }

    if (!parcelas || parcelas.length === 0) {
      showToast("Nenhuma parcela disponível para edição.", "warning");
      return;
    }

    // estado global
    state.editingPurchaseParcels = parcelas;
    state.editingPurchaseFull = parcelas[0];

    // preencher campos principais
    elDesc.value = base;
    elValor.value = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0);
    elData.value = parcelas[0].data_compra || "";
    elParcelas.value = parcelas.length;

    // popular selects
    await popularSelectCategoriaEdicao(parcelas[0].categoria_id);
    await popularSelectCartaoEdicao(parcelas[0].cartao_id);

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

  parcelas.forEach((p) => {
    const li = document.createElement("li");
    li.className = "parcela-item";
    li.dataset.parcelaId = p.id;

    const dataCompra = p.data_compra
      ? new Date(p.data_compra + "T00:00:00").toLocaleDateString("pt-BR")
      : "-";

    const dataFatura = p.data_fatura
      ? new Date(p.data_fatura + "T00:00:00").toLocaleDateString("pt-BR")
      : "-";

    li.innerHTML = `
      <span>
        (${p.parcela_atual}/${total}) —
        Compra: ${dataCompra} —
        Fatura: ${dataFatura} —
        ${formatReal(p.valor)}
      </span>

      <div class="parcela-actions">
        <button class="btn-secondary btn-edit">Editar</button>
        <button class="btn-danger btn-del">Excluir</button>
        <button class="btn-primary btn-ant">Antecipar</button>
      </div>
    `;

    li.querySelector(".btn-edit").onclick = () =>
      abrirModalEditarParcela(p);

    li.querySelector(".btn-del").onclick = () =>
      excluirParcela(p.id);

    li.querySelector(".btn-ant").onclick = () =>
      anteciparParcela(p.id);

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

}); // fim DOMContentLoaded

// ==================================================================================// FIM do arquivo cartao.js// ==================================================================================

