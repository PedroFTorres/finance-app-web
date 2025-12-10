// cartao.js — Versão atualizada com modal de escolha de conta ao fechar fatura
// Mantém todas as funcionalidades: CRUD cartões, faturas, lançamentos parcelados,
// edição de parcelas, antecipação, pagamento antecipado, fechar/pagar/reabrir fatura,
// histórico, toasts, modais.
// Observação: supabase deve estar disponível em window.supabase (carregado antes).

document.addEventListener("DOMContentLoaded", () => {

  // ===========================
  // TOAST SIMPLES
  // ===========================
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

  // ===========================
  // ESTADO
  // ===========================
  const state = {
    user: null,
    cards: [],
    categories: [],
    editingPurchaseFull: null,       // para edição parcelada
    editingPurchaseParcels: [],      // parcelas em edição
    faturaAtual: null,
  };

  // ===========================
  // ELEMENTOS DO DOM
  // ===========================
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
  let viewEditarAvista = document.getElementById("view-editar-avista"); // pode ser criado dinamicamente

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

  const selectContaPagamento = document.getElementById("select-conta-pagamento");
  const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");
  const btnFecharFatura = document.getElementById("btn-fechar-fatura");
  const btnPagarFatura = document.getElementById("btn-pagar-fatura");

  const btnAddPurchase = document.getElementById("btn-add-purchase");
  const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

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
  const contaFaturaConfirmar = document.getElementById("conta-fatura-confirmar");
  const contaFaturaCancelar = document.getElementById("conta-fatura-cancelar");

  const toastContainer = document.getElementById("toast-container");

  let mesFatura = new Date();
  let mesLanc = new Date();

  // ===========================
  // HELPERS
  // ===========================
  function formatReal(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatISO(d) {
    return new Date(d).toISOString().slice(0,10);
  }

  // get or create categoria helper
  async function getOrCreateCategoria(nome) {
    const { data } = await supabase.from("categorias").select("*").eq("nome", nome).maybeSingle();
    if (data) return data.id;

    const created = await supabase.from("categorias").insert([{ id: crypto.randomUUID(), nome }]).select().maybeSingle();
    return created?.data?.id || created?.id;
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

  // ===========================
  // SESSÃO
  // ===========================
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
      await loadCategorias();
      popularMesFatura();
      popularFaturasLancamento();
      showView(viewFaturas);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar dados.", "error");
    }
  })();

  // ===========================
  // NAV / BOTÕES - Back e Logout
  // ===========================
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

  if (navFatura) navFatura.onclick = async () => { await loadFaturasSelect(); showView(viewFaturas); };
  if (navLancamento) navLancamento.onclick = async () => { await loadSelectsForLanc(); popularFaturasLancamento(); showView(viewLancamento); };
  if (navHistorico) navHistorico.onclick = async () => { await loadHistoricoFaturas(); showView(viewHistorico); };

  // ===========================
  // CARDS — carregar / renderizar / excluir
  // ===========================
  async function loadCards() {
    const { data } = await supabase.from("cartoes_credito")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false });

    state.cards = data || [];
    renderCards();
    populateCardSelects();
  }

  function renderCards() {
    if (!cardsList) return;
    cardsList.innerHTML = "";
    (state.cards || []).forEach((c) => {
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
        </div>`;
      cardsList.appendChild(el);
    });

    document.querySelectorAll(".btn-view-faturas").forEach((btn) => {
      btn.onclick = () => {
        if (selectCartaoFaturas) selectCartaoFaturas.value = btn.dataset.id;
        loadFaturasSelect();
        showView(viewFaturas);
      };
    });

    document.querySelectorAll(".btn-lancar").forEach((btn) => {
      btn.onclick = () => {
        if (selectCartaoLanc) selectCartaoLanc.value = btn.dataset.id;
        loadSelectsForLanc();
        popularFaturasLancamento();
        showView(viewLancamento);
      };
    });

    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Excluir este cartão?")) return;
        await supabase.from("cartoes_credito").delete().eq("id", btn.dataset.id);
        await loadCards();
        showToast("Cartão excluído.");
      };
    });
  }

  function populateCardSelects() {
    if (!selectCartaoFaturas || !selectCartaoLanc) return;
    selectCartaoFaturas.innerHTML = "";
    selectCartaoLanc.innerHTML = "";
    (state.cards || []).forEach((card) => {
      selectCartaoFaturas.appendChild(new Option(card.nome, card.id));
      selectCartaoLanc.appendChild(new Option(card.nome, card.id));
    });
  }

  // ===========================
  // CATEGORIAS
  // ===========================
  async function loadCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    state.categories = data || [];
    if (selectCategoriaLancCartao) {
      selectCategoriaLancCartao.innerHTML = "";
      (state.categories || []).forEach((cat) => selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id)));
    }
  }

  // ===========================
  // MES NAV
  // ===========================
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

  // ===========================
  // CARREGAR FATURA / RENDER (USANDO data_fatura)
  // ===========================
  async function loadFaturaForSelected() {
    if (!selectCartaoFaturas || !selectMesFaturas) return;
    const cartao_id = selectCartaoFaturas.value;
    const ym = selectMesFaturas.value;
    if (!cartao_id || !ym) {
      if (faturaSummary) faturaSummary.innerHTML = "<div>Nenhum cartão/mês selecionado.</div>";
      if (listaComprasFatura) listaComprasFatura.innerHTML = "";
      state.faturaAtual = null;
      updateButtonsForFatura();
      return;
    }

    const [anoNum, mesNum] = ym.split("-").map(Number);
    const ano = anoNum; const mes = mesNum;
    const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
    const last = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2,"0")}-${last}`;

    const { data: compras, error: errCompras } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", cartao_id)
      .gte("data_fatura", inicio)
      .lte("data_fatura", fim)
      .order("data_fatura");

    if (errCompras) {
      console.error("Erro ao carregar fatura:", errCompras);
      if (listaComprasFatura) listaComprasFatura.innerHTML = "<li>Erro ao carregar fatura.</li>";
      showToast("Erro ao carregar fatura.", "error");
      return;
    }

    const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);
    const card = state.cards.find(x => x.id === cartao_id);

    if (faturaSummary) {
      faturaSummary.innerHTML = `<div class="big">${card?.nome || "Cartão"}</div><div>${ym}</div><div class="big">${formatReal(total)}</div>
        <div id="status-fatura" style="margin-top:8px;"></div>`;
    }

    if (listaComprasFatura) {
  listaComprasFatura.innerHTML = "";

  (compras || []).forEach((c) => {
    const li = document.createElement("li");
    const descr = (c.descricao || "").trim();

    // ✔️ EXIBIR SEMPRE A DATA DA COMPRA (data_compra)
    const dataExibida = c.data_compra
      ? new Date(c.data_compra + "T00:00:00").toLocaleDateString("pt-BR")
      : "";

    li.innerHTML = `
      <span>${dataExibida} — ${descr}</span>
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

    state.faturaAtual = faturaDB || null;

    if (card && dataVencimentoFatura && !state.faturaAtual) {
      const venc = new Date(ano, mes - 1, card.dia_vencimento);
      dataVencimentoFatura.value = formatISO(venc);
    } else if (state.faturaAtual && dataVencimentoFatura) {
      if (state.faturaAtual.data_vencimento) dataVencimentoFatura.value = state.faturaAtual.data_vencimento;
    }

    updateButtonsForFatura();
  }

  async function loadFaturasSelect() {
    await loadCards();
    await loadCategorias();
    popularMesFatura();
    await loadSelectsForLanc();

    if (selectCartaoFaturas && selectCartaoFaturas.options.length > 0) {
      await loadFaturaForSelected();
    } else {
      showView(viewNewCard);
    }
  }

  // ===========================
  // UPDATE BUTTONS FOR FATURA
  // ===========================
  function updateButtonsForFatura() {
    const existingReabrir = document.getElementById("btn-reabrir-fatura");
    if (existingReabrir) existingReabrir.remove();
    const statusEl = document.getElementById("status-fatura");

    if (state.faturaAtual) {
      if (btnFecharFatura) { btnFecharFatura.disabled = true; btnFecharFatura.textContent = "Fatura Fechada"; }
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
      if (btnFecharFatura) { btnFecharFatura.disabled = false; btnFecharFatura.textContent = "Fechar Fatura"; }
      if (btnPagarFatura) { btnPagarFatura.disabled = false; btnPagarFatura.textContent = "Gerar Despesa"; }
      if (statusEl) statusEl.textContent = "";
    }
  }

  // ===========================
  // Funções auxiliares para modal de escolha de conta ao fechar fatura (OPÇÃO B)
  // ===========================
  async function carregarContasModal() {
    if (!contaFaturaSelect) return;
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

    contaFaturaSelect.innerHTML = "";
    (contas || []).forEach(c => {
      contaFaturaSelect.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual)})`, c.id));
    });

    // se não houver opções, cria uma opção vazia
    if ((contas || []).length === 0) {
      contaFaturaSelect.appendChild(new Option("Nenhuma conta disponível", ""));
    }
  }

  async function fecharFaturaComConta(conta_id) {
    try {
      const cartaoId = selectCartaoFaturas.value;
      const venc = dataVencimentoFatura.value;
      const ym = selectMesFaturas.value;

      if (!cartaoId) return showToast("Selecione um cartão.", "error");
      if (!venc) return showToast("Informe o vencimento.", "error");

      const [ano, mes] = ym.split("-").map(Number);
      const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
      const last = new Date(ano, mes, 0).getDate();
      const fim = `${ano}-${String(mes).padStart(2,"0")}-${last}`;

      const { data: compras } = await supabase
        .from("cartao_lancamentos")
        .select("*")
        .eq("cartao_id", cartaoId)
        .gte("data_fatura", inicio)
        .lte("data_fatura", fim);

      const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);

      const { data: fData, error: errF } = await supabase.from("cartao_faturas").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        cartao_id: cartaoId,
        ano,
        mes,
        valor_total: total,
        data_vencimento: venc,
        pago: false,
        status: "fechada"
      }]).select().maybeSingle();

      if (errF || !fData) {
        console.error("Erro ao inserir fatura:", errF);
        return showToast("Erro ao fechar fatura.", "error");
      }

      // criar categoria "Cartão de Crédito"
      const categoriaId = await getOrCreateCategoria("Cartão de Crédito");

      const { error: errDesp } = await supabase.from("despesas").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        conta_id: conta_id || null, // conta escolhida pelo usuário
        descricao: `Fatura ${fData.id} — ${ (state.cards.find(c=>c.id===cartaoId)||{}).nome || 'Cartão' }`,
        valor: total,
        data: venc,
        categoria_id: categoriaId,
        baixado: false,
        cartao_fatura_id: fData.id
      }]);

      if (errDesp) {
        console.error("Erro ao criar despesa vinculada:", errDesp);
        showToast("Fatura criada, mas erro ao criar despesa vinculada.", "error");
      } else {
        showToast("Fatura fechada e despesa criada (a pagar).");
      }

      // fechar modal se estiver aberto
      if (modalContaFatura) modalContaFatura.classList.add("hidden");

      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      showToast("Erro ao fechar fatura.", "error");
    }
  }

  // ===========================
  // FECHAR FATURA → abre modal para escolher conta (valida campos primeiro) - fluxo B
  // ===========================
  if (btnFecharFatura) btnFecharFatura.onclick = async () => {
    try {
      const cartaoId = selectCartaoFaturas.value;
      const venc = dataVencimentoFatura.value;
      const ym = selectMesFaturas.value;

      if (!cartaoId) return showToast("Selecione um cartão.", "error");
      if (!venc) return showToast("Informe o vencimento.", "error");
      if (state.faturaAtual) return showToast("Esta fatura já está fechada.", "error");

      // carregar contas no modal e abrir modal
      await carregarContasModal();
      if (modalContaFatura) modalContaFatura.classList.remove("hidden");

      // configurar botões do modal (evitar bind múltiplo: limpar antes)
      if (contaFaturaConfirmar) {
        contaFaturaConfirmar.onclick = async () => {
          const contaEscolhida = contaFaturaSelect ? contaFaturaSelect.value : null;
          if (!contaEscolhida) return showToast("Selecione uma conta.", "error");
          await fecharFaturaComConta(contaEscolhida);
        };
      }

      if (contaFaturaCancelar) {
        contaFaturaCancelar.onclick = () => {
          if (modalContaFatura) modalContaFatura.classList.add("hidden");
        };
      }

    } catch (err) {
      console.error(err);
      showToast("Erro ao processar fechamento.", "error");
    }
  };

  // ===========================
  // PAGAR FATURA → baixa a despesa vinculada, cria movimentação e atualiza saldo
  // ===========================
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

  // ===========================
  // REABRIR FATURA
  // ===========================
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
if (btnAddPurchase) btnAddPurchase.onclick = async () => {
  try {
    const cartao_id = selectCartaoLanc.value;
    const descricao = cartDesc.value.trim();
    const valor = Number(cartValor.value || 0);
    let parcelas = Number(cartParcelas.value || 1);
    const dataCompra = cartData.value; // será exibida ao usuário
    const categoriaSelecionada = selectCategoriaLancCartao.value;

    if (!cartao_id || !descricao || !valor || !dataCompra)
      return showToast("Preencha todos os campos.", "error");

    if (!selectFaturaInicial.value)
      return showToast("Selecione a fatura inicial.", "error");

    if (parcelas < 1) parcelas = 1;

    // ---- PARCELAMENTO CORRIGIDO ----
    const [fatAno, fatMes] = selectFaturaInicial.value.split("-").map(Number);

    // corrigir centavos
    const valorParcelaBase = Number((valor / parcelas).toFixed(2));
    const somaBase = Number((valorParcelaBase * parcelas).toFixed(2));
    const diferenca = Number((valor - somaBase).toFixed(2));

    for (let p = 1; p <= parcelas; p++) {

      // mês da parcela
      const mesOffset = p - 1;

      // data_fatura será sempre dia 1
      const dataFatura = new Date(fatAno, (fatMes - 1) + mesOffset, 1);
      const dataFaturaISO = formatISO(dataFatura);

      // monta descrição com parcela
      const descricaoFinal = parcelas === 1
        ? descricao
        : `${descricao} (${p}/${parcelas})`;

      // acerta centavos na primeira parcela
      let valorParcela = valorParcelaBase;
      if (p === 1 && diferenca !== 0) {
        valorParcela = Number((valorParcelaBase + diferenca).toFixed(2));
      }

      // insere no banco
      await supabase.from("cartao_lancamentos").insert([{
        id: crypto.randomUUID(),
        user_id: state.user.id,
        cartao_id,
        descricao: descricaoFinal,
        valor: Number(valorParcela.toFixed(2)),
        data_compra: dataCompra,          // EXIBIDA AO USUÁRIO
        data_fatura: dataFaturaISO,       // USADA NO CÁLCULO
        parcelas,
        parcela_atual: p,
        categoria_id: categoriaSelecionada || null,
        tipo: "compra",
        billed: false
      }], { returning: "minimal" });
    }

    // limpar campos
    cartDesc.value = "";
    cartValor.value = "";
    cartParcelas.value = 1;
    cartData.value = "";

    await loadFaturaForSelected();
    showToast("Compra lançada com sucesso!");

  } catch (err) {
    console.error(err);
    showToast("Erro ao lançar compra.", "error");
  }
};


  if (btnCancelPurchase) btnCancelPurchase.onclick = () => {
    cartDesc.value = "";
    cartValor.value = "";
    cartParcelas.value = 1;
    cartData.value = "";
    showView(viewFaturas);
  };

  // ===========================
  // PAGAMENTO ANTECIPADO
  // ===========================
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
    const cartaoId = selectCartaoFaturas.value;

    if (!conta || !valor || !data) return showToast("Preencha todos os campos.", "error");

    await supabase.from("cartao_lancamentos").insert([{
      id: crypto.randomUUID(),
      user_id: state.user.id,
      cartao_id: cartaoId,
      tipo: "pagamento",
      descricao: "Pagamento antecipado",
      valor: -Math.abs(valor),
      data_compra: data,
      parcelas: 1,
      parcela_atual: 1,
      billed: false
    }]);

    showToast("Pagamento antecipado registrado.");
    showView(viewFaturas);
    await loadFaturaForSelected();
  };

  // ===========================
  // HISTÓRICO DE FATURAS
  // ===========================
  async function loadHistoricoFaturas() {
    const { data } = await supabase.from("cartao_faturas").select("*, cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at", { ascending: false });
    listaFaturasHistorico.innerHTML = "";
    (data || []).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(f.valor_total || 0)} — ${f.pago ? "Paga" : f.status}`;
      listaFaturasHistorico.appendChild(li);
    });
  }

  // ===========================
  // SELECTS AUXILIARES
  // ===========================
  async function loadSelectsForLanc() {
    await loadCategorias();
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

    selectContaPagamento.innerHTML = "";
    (contas || []).forEach((c) =>
      selectContaPagamento.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual)})`, c.id))
    );
  }

  // ===========================
  // EDIÇÃO À VISTA DINÂMICA
  // ===========================
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

    document.getElementById("btn-avista-voltar").onclick = () => showView(viewFaturas);
    document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
    document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
  }

  async function abrirEdicaoAvista(l) {
    ensureAvistaViewExists();
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
    showView(viewFaturas);
  }

  async function excluirCompraAvista() {
    const id = viewEditarAvista.dataset.lancId;
    if (!confirm("Excluir compra?")) return;

    await supabase.from("cartao_lancamentos").delete().eq("id", id);

    showToast("Compra excluída.");
    await loadFaturaForSelected();
    showView(viewFaturas);
  }

  // ===========================
  // EDIÇÃO PARCELADA
  // ===========================
  async function abrirEdicaoCompraParcelada(c) {
    try {
      const base = (c.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

      const q = await supabase
        .from("cartao_lancamentos")
        .select("*")
        .eq("cartao_id", c.cartao_id)
        .ilike("descricao", `${base}%`)
        .order("parcela_atual", { ascending: true });

      if (!q.data || q.data.length === 0)
        return showToast("Não foi possível carregar parcelas.", "error");

      state.editingPurchaseParcels = q.data;
      state.editingPurchaseFull = q.data[0];

      document.getElementById("edit-desc").value = base;

      const soma = q.data.reduce((s, p) => s + Number(p.valor), 0);
      document.getElementById("edit-valor-total").value = soma;

      document.getElementById("edit-data-inicial").value = q.data[0].data_compra;
      document.getElementById("edit-total-parcelas").value = q.data.length;

      await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
      await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

      renderParcelasEdicao();
      showView(viewEditarCompra);

    } catch (err) {
      console.error(err);
      showToast("Erro ao abrir edição.", "error");
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

  // ===========================
  // MODAL EDITAR PARCELA
  // ===========================
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

  // ===========================
  // EXCLUIR PARCELA
  // ===========================
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

  // ===========================
  // ANTECIPAR PARCELA
  // ===========================
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

  // ===========================
  // POPULAR SELECTS PARA EDIÇÃO
  // ===========================
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

  // ===========================
  // SALVAR/EXCLUIR EDIÇÃO PARCELADA
  // ===========================
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
        showView(viewFaturas);

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
        showView(viewFaturas);
      } catch (err) {
        console.error(err);
        showToast("Erro ao excluir compra.", "error");
      }
    };

  // ===========================
  // SELECT CHANGES
  // ===========================
  if (selectMesFaturas) selectMesFaturas.addEventListener("change", loadFaturaForSelected);
  if (selectCartaoFaturas) selectCartaoFaturas.addEventListener("change", loadFaturaForSelected);

  // ===========================
  // LOAD SELECTS FOR LANCAMENTO
  // ===========================
  async function loadSelectsForLanc() {
    await loadCategorias();
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);

    selectContaPagamento.innerHTML = "";
    (contas || []).forEach((c) => {
      selectContaPagamento.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual)})`, c.id));
    });

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

  // ===========================
  // HISTÓRICO & LOADS INICIAIS
  // ===========================
  async function loadHistoricoFaturas() {
    const { data } = await supabase.from("cartao_faturas").select("*, cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at", { ascending: false });
    listaFaturasHistorico.innerHTML = "";
    (data || []).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(f.valor_total || 0)} — ${f.pago ? "Paga" : f.status}`;
      listaFaturasHistorico.appendChild(li);
    });
  }

  // ===========================
  // INICIALIZAÇÃO FINAL (garante tudo carregado)
  // ===========================
  // (já feita no início do script via IIFE de sessão)

}); // fim DOMContentLoaded

// ==================================================================================
// FIM do arquivo cartao.js
// ==================================================================================
