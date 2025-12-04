// cartao.js — Versão completa (edição à vista + parcelada, oculta (1/1) em compras à vista)
// Garante compatibilidade com o cartao.html que você enviou.
// Usa `window.supabase` como antes.

(async () => {
  // ---------- dependência supabase ----------
  if (typeof supabase === "undefined") {
    alert("Erro: supabase.js não carregado.");
    return;
  }

  // ---------- estado ----------
  const state = {
    user: null,
    cards: [],
    categories: [],
    // parcelada
    editingPurchaseFull: null,
    editingPurchaseParcels: [],
  };

  // ---------- refs DOM principais (existentes no seu HTML) ----------
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

  // EXISTE view-editar-avista? (se não, vamos criar dinamicamente)
  let viewEditarAvista = document.getElementById("view-editar-avista");

  // ---------- elementos (originais) ----------
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

  // ---------- helpers ----------
  function hideAllViews() {
    viewNewCard.classList.add("hidden");
    viewFaturas.classList.add("hidden");
    viewLancamento.classList.add("hidden");
    viewHistorico.classList.add("hidden");
    boxPagAntecipado.classList.add("hidden");
    if (viewEditarCompra) viewEditarCompra.classList.add("hidden");
    if (viewEditarAvista) viewEditarAvista.classList.add("hidden");
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

  // formata a descrição exibida: remove "(1/1)" se for compra à vista
  function formatDescricaoExibicao(lanc) {
    // campos esperados: parcelas (número) e descricao (string possivelmente com " (1/1)")
    if (!lanc) return "";
    if (Number(lanc.parcelas || 0) === 1) {
      return (lanc.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    }
    return lanc.descricao || "";
  }

  // ---------- login ----------
  const sessionResp = await supabase.auth.getSession();
  if (!sessionResp.data.session) {
    window.location.href = "login.html";
    return;
  }

  state.user = sessionResp.data.session.user;
  userEmail.textContent = state.user.email;

  // ---------- NAV ----------
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

  // ---------- CARTÕES (novo / listar) ----------
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

  // ---------- CATEGORIAS ----------
  async function loadCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nome");

    state.categories = data || [];
    selectCategoriaLancCartao.innerHTML = "";

    (data || []).forEach((cat) => {
      selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id));
    });
  }

  // ---------- SELECTOR MÊS FATURA ----------
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

  // ---------- SELECTOR MÊS PARA LANÇAMENTO ----------
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

  // ---------- CARREGAR FATURA DO MÊS ----------
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

      // Exibição da descrição (oculta (1/1) se for à vista)
      const descr = formatDescricaoExibicao(c);

      li.innerHTML = `
        <span>${formatDateShort(c.data_compra)} — ${descr}</span>
        <span>${formatReal(c.valor)}</span>
      `;

      li.style.cursor = "pointer";

      // clique: se parcelas === 1 -> edição à vista; caso contrário -> abrir parcelada
      li.onclick = () => {
        if (Number(c.parcelas || 0) === 1) {
          abrirEdicaoAvista(c);
        } else {
          abrirEdicaoCompraParcelada(c);
        }
      };

      listaComprasFatura.appendChild(li);
    });

    if (card) {
      const venc = new Date(ano, mes - 1, card.dia_vencimento);
      dataVencimentoFatura.value = formatISO(venc);
    }
  }

  // ---------- PARTE: abrir edição parcelada (já existente/expandida) ----------
  async function abrirEdicaoCompraParcelada(compra) {
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
      const somaTotal = state.editingPurchaseParcels.reduce((s, p) => s + Number(p.valor || 0), 0);
      document.getElementById("edit-desc").value = descricaoBase;
      document.getElementById("edit-valor-total").value = Number(somaTotal.toFixed(2));
      document.getElementById("edit-data-inicial").value = state.editingPurchaseParcels[0].data_compra;
      document.getElementById("edit-total-parcelas").value = state.editingPurchaseParcels.length;

      // Popular selects (categoria / cartão)
      await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
      await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

      // Renderizar lista de parcelas
      renderParcelasEdicao();

      // Mostrar view de edição parcelada
      showView(viewEditarCompra);
    } catch (err) {
      console.error("abrirEdicaoCompraParcelada:", err);
      alert("Erro ao abrir edição da compra. Veja console.");
    }
  }

  async function popularSelectCategoriaEdicao(selectedId) {
    try {
      const { data } = await supabase.from("categorias").select("*").order("nome");
      const sel = document.getElementById("edit-categoria");
      sel.innerHTML = "";

      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === selectedId) op.selected = true;
        sel.appendChild(op);
      });

      if (!selectedId && sel.options.length > 0) sel.selectedIndex = 0;
    } catch (err) {
      console.error("popularSelectCategoriaEdicao:", err);
    }
  }

  async function popularSelectCartaoEdicao(selectedId) {
    try {
      const { data } = await supabase
        .from("cartoes_credito")
        .select("*")
        .eq("user_id", state.user.id);

      const sel = document.getElementById("edit-cartao");
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

  function renderParcelasEdicao() {
    const lista = document.getElementById("lista-parcelas-editar");
    lista.innerHTML = "";

    const parcelas = state.editingPurchaseParcels || [];
    const total = parcelas.length;

    parcelas.forEach((p) => {
      const li = document.createElement("li");
      li.className = "parcela-item";
      li.dataset.parcelaId = p.id;

      const leftSpan = document.createElement("span");
      leftSpan.textContent = `(${p.parcela_atual}/${total}) — ${formatDateShort(p.data_compra)} — ${formatReal(p.valor)}`;

      const actionsDiv = document.createElement("div");
      actionsDiv.style.display = "flex";
      actionsDiv.style.gap = "6px";

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn-secondary";
      btnEdit.textContent = "Editar";
      btnEdit.onclick = (ev) => {
        ev.stopPropagation();
        editarParcela(p.id);
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn-danger";
      btnDel.textContent = "Excluir";
      btnDel.onclick = (ev) => {
        ev.stopPropagation();
        excluirParcela(p.id);
      };

      const btnAnt = document.createElement("button");
      btnAnt.className = "btn-primary";
      btnAnt.textContent = "Antecipar";
      btnAnt.onclick = (ev) => {
        ev.stopPropagation();
        anteciparParcela(p.id);
      };

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

      lista.appendChild(li);
    });
  }

  // handlers na tela parcelada
  document.getElementById("btn-voltar-edicao").onclick = () => {
    state.editingPurchaseFull = null;
    state.editingPurchaseParcels = [];
    showView(viewFaturas);
  };

  document.getElementById("btn-excluir-compra").onclick = () => {
    if (!state.editingPurchaseFull) return alert("Nenhuma compra selecionada.");
    if (!confirm("Deseja excluir toda a compra (todas as parcelas)?")) return;
    excluirCompraCompleta();
  };

  document.getElementById("btn-salvar-edicao").onclick = () => {
    if (!state.editingPurchaseFull) return alert("Nenhuma compra para salvar.");
    salvarAlteracoesCompra();
  };

  // ---------- funções parceladas (editarParcela / excluirParcela / antecipar / salvarAlteracoes) ----------
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
    await abrirEdicaoCompraParcelada(p);
    await loadFaturaForSelected();
    alert("Parcela editada com sucesso.");
  }

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

    // Reabrir a compra com parcelas atualizadas (tenta abrir pela mesma descrição base)
    await tryReabrirCompraPorParcela(p);

    await loadFaturaForSelected();
    alert("Parcela excluída.");
  }

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

      state.editingPurchaseParcels = [];
      showView(viewFaturas);

      await loadFaturaForSelected();
      alert("Compra excluída com sucesso.");
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir compra.");
    }
  }

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

      await abrirEdicaoCompraParcelada(p);
      await loadFaturaForSelected();

    } catch (err) {
      console.error(err);
      alert("Erro ao antecipar parcela.");
    }
  }

  async function salvarAlteracoesCompra() {
    try {
      const parcelasOriginais = state.editingPurchaseParcels;
      if (!parcelasOriginais || parcelasOriginais.length === 0)
        return alert("Nenhuma compra carregada.");

      // Coleta dados novos
      const novaDesc = document.getElementById("edit-desc").value.trim();
      const novoValorTotal = Number(document.getElementById("edit-valor-total").value || 0);
      const novaDataInicial = document.getElementById("edit-data-inicial").value;
      const novoTotalParcelas = Number(document.getElementById("edit-total-parcelas").value || 1);
      const novoCartaoId = document.getElementById("edit-cartao").value;
      const novaCategoria = document.getElementById("edit-categoria").value;

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

  // ---------- utilitários ----------
  async function refreshAfterChange() {
    try {
      await loadCards();
      await loadCategorias();
      await loadFaturaForSelected();
    } catch (err) {
      console.error("refreshAfterChange:", err);
    }
  }

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
        showView(viewFaturas);
      }
    } catch (err) {
      console.error("tryReabrirCompraPorParcela:", err);
    }
  }

  // ---------- Parte NOVA: Tela de edição À VISTA (criada dinamicamente, se não existir) ----------
  function ensureAvistaViewExists() {
    if (viewEditarAvista) return; // já existe

    // criar estrutura HTML simples e injetar no right-column
    const rightColumn = document.querySelector(".right-column");
    const div = document.createElement("div");
    div.id = "view-editar-avista";
    div.className = "panel view hidden";
    div.innerHTML = `
      <div class="panel-header">
        <h2>Editar Compra (À vista)</h2>
        <button id="btn-avista-voltar" class="btn-secondary">Voltar</button>
      </div>
      <div class="form">
        <label>Descrição</label>
        <input id="avista-desc">

        <label>Valor</label>
        <input id="avista-valor" type="number" step="0.01">

        <label>Data</label>
        <input id="avista-data" type="date">

        <label>Categoria</label>
        <select id="avista-categoria"></select>

        <label>Cartão</label>
        <select id="avista-cartao"></select>

        <div class="actions-row">
          <button id="btn-avista-salvar" class="btn-primary">Salvar</button>
          <button id="btn-avista-excluir" class="btn-danger">Excluir</button>
        </div>
      </div>
    `;
    rightColumn.appendChild(div);
    viewEditarAvista = div;

    // attach handlers
    document.getElementById("btn-avista-voltar").onclick = () => {
      showView(viewFaturas);
    };
    document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
    document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
  }

  // abrir edição à vista
  async function abrirEdicaoAvista(lanc) {
    ensureAvistaViewExists();

    // preenche campos
    document.getElementById("avista-desc").value = (lanc.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    document.getElementById("avista-valor").value = Number(lanc.valor || 0);
    document.getElementById("avista-data").value = lanc.data_compra || lanc.data || formatISO(new Date());

    // popula categorias e cartões e seleciona os corretos
    await popularSelectCategoriaAvista(lanc.categoria_id);
    await popularSelectCartaoAvista(lanc.cartao_id);

    // armazena temporariamente no DOM o id da parcela mestre (usaremos para salvar)
    viewEditarAvista.dataset.lancId = lanc.id;
    viewEditarAvista.dataset.cartaoId = lanc.cartao_id;

    showView(viewEditarAvista);
  }

  async function popularSelectCategoriaAvista(selectedId) {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    const sel = document.getElementById("avista-categoria");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === selectedId) op.selected = true;
      sel.appendChild(op);
    });
    if (!selectedId && sel.options.length > 0) sel.selectedIndex = 0;
  }

  async function popularSelectCartaoAvista(selectedId) {
    const { data } = await supabase
      .from("cartoes_credito")
      .select("*")
      .eq("user_id", state.user.id);

    const sel = document.getElementById("avista-cartao");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === selectedId) op.selected = true;
      sel.appendChild(op);
    });
  }

  // salvar edição à vista
  async function salvarEdicaoAvista() {
    const id = viewEditarAvista.dataset.lancId;
    if (!id) return alert("ID da compra não encontrado.");

    const novaDesc = document.getElementById("avista-desc").value.trim();
    const novoValor = Number(document.getElementById("avista-valor").value || 0);
    const novaData = document.getElementById("avista-data").value;
    const novaCategoria = document.getElementById("avista-categoria").value;
    const novoCartao = document.getElementById("avista-cartao").value;

    if (!novaDesc || !novoValor || !novaData) return alert("Preencha os campos.");

    // Atualiza apenas esse lançamento (como é à vista, parcelas = 1)
    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({
        descricao: novaDesc,
        valor: novoValor,
        data_compra: novaData,
        categoria_id: novaCategoria,
        cartao_id: novoCartao
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return alert("Erro ao salvar alteração.");
    }

    alert("Compra (à vista) atualizada.");
    await loadFaturaForSelected();
    showView(viewFaturas);
  }

  // excluir compra à vista (apaga o registro único)
  async function excluirCompraAvista() {
    const id = viewEditarAvista.dataset.lancId;
    if (!id) return alert("ID da compra não encontrado.");
    if (!confirm("Excluir esta compra?")) return;

    const { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return alert("Erro ao excluir compra.");
    }

    alert("Compra excluída.");
    await loadFaturaForSelected();
    showView(viewFaturas);
  }

  // ---------- LANÇAMENTO DE COMPRA ----------
  btnAddPurchase.onclick = async () => {
    if (state.editingPurchaseFull) return;

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

      const descricaoCom = parcelas === 1 ? descricao : `${descricao} (${p}/${parcelas})`;
      const valorParcela = parcelas === 1 ? valor : Number((valor / parcelas).toFixed(2));

      await supabase.from("cartao_lancamentos").insert([{
        user_id: state.user.id,
        cartao_id,
        descricao: descricaoCom,
        valor: valorParcela,
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

  // ---------- PAGAMENTO ANTECIPADO ----------
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

  // ---------- HISTÓRICO ----------
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

  // ---------- CONTAS / SELECTS ----------
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

  // ---------- INIT ----------
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

  // ---------- expor funções globais (caso precise) ----------
  window.abrirEdicaoCompra = abrirEdicaoCompraParcelada;
  window.abrirEdicaoAvista = abrirEdicaoAvista;
  window.editarParcela = editarParcela;
  window.excluirParcela = excluirParcela;
  window.anteciparParcela = anteciparParcela;
  window.excluirCompraCompleta = excluirCompraCompleta;
  window.salvarAlteracoesCompra = salvarAlteracoesCompra;

})(); // fim do IIFE
