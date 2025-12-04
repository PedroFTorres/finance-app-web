// cartao.js — VERSÃO FINAL E CORRIGIDA
// Inclui: lançamentos, edição à vista, edição parcelada, antecipação, categorias, navegação de faturas.

(async () => {

  if (typeof supabase === "undefined") {
    alert("Erro: supabase.js não carregado.");
    return;
  }

  // ---------------------------------------------------------
  // ESTADO GLOBAL
  // ---------------------------------------------------------
  const state = {
    user: null,
    cards: [],
    categories: [],
    editingPurchaseFull: null,
    editingPurchaseParcels: []
  };

  // ---------------------------------------------------------
  // REFERÊNCIAS DO DOM
  // ---------------------------------------------------------
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
  let viewEditarAvista = document.getElementById("view-editar-avista");

  // Campos Novo Cartão
  const btnSaveCard = document.getElementById("btn-save-card");
  const btnCancelCard = document.getElementById("btn-cancel-card");
  const cardNome = document.getElementById("card-nome");
  const cardLimite = document.getElementById("card-limite");
  const cardDiaFechamento = document.getElementById("card-dia-fechamento");
  const cardDiaVencimento = document.getElementById("card-dia-vencimento");

  // Faturas
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

  // Lançar compra
  const selectCartaoLanc = document.getElementById("select-cartao-lanc");
  const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");

  const cartDesc = document.getElementById("cart-desc");
  const cartValor = document.getElementById("cart-valor");
  const cartData = document.getElementById("cart-data");
  const cartParcelas = document.getElementById("cart-parcelas");
  const parcelaInicialInput = document.getElementById("parcela-inicial");

  const fatDisplay = document.getElementById("fat-display");
  const btnFatPrev = document.getElementById("fat-prev");
  const btnFatNext = document.getElementById("fat-next");
  const selectFaturaInicial = document.getElementById("select-fatura-inicial");

  const btnAddPurchase = document.getElementById("btn-add-purchase");
  const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

  // Pagamento antecipado
  const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
  const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
  const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
  const dataPagAntecipado = document.getElementById("data-pag-antecipado");
  const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");

  // Histórico
  const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

  // Controle de mês
  let mesFatura = new Date();
  let mesLanc = new Date();


  // ---------------------------------------------------------
  // FUNÇÕES AUXILIARES
  // ---------------------------------------------------------
  function hideAllViews() {
    viewNewCard.classList.add("hidden");
    viewFaturas.classList.add("hidden");
    viewLancamento.classList.add("hidden");
    viewHistorico.classList.add("hidden");
    boxPagAntecipado.classList.add("hidden");
    viewEditarCompra.classList.add("hidden");
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

  // ADICIONADO!
  function displayMes(dateObj) {
    const meses = [
      "janeiro","fevereiro","março","abril","maio","junho",
      "julho","agosto","setembro","outubro","novembro","dezembro"
    ];
    return `${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }

  // ADICIONADO!
  function formatYM(dateObj) {
    const a = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${a}-${m}`;
  }

  // remove (1/1)
  function formatDescricaoExibicao(lanc) {
    if (!lanc) return "";
    if (Number(lanc.parcelas || 0) === 1) {
      return lanc.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    }
    return lanc.descricao;
  }


  // ---------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------
  const sessionResp = await supabase.auth.getSession();
  if (!sessionResp.data.session) {
    window.location.href = "login.html";
    return;
  }

  state.user = sessionResp.data.session.user;
  userEmail.textContent = state.user.email;


  // ---------------------------------------------------------
  // NAVEGAÇÃO
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // CARREGAR CARTÕES
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // CATEGORIAS
  // ---------------------------------------------------------
  async function loadCategorias() {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    state.categories = data || [];

    selectCategoriaLancCartao.innerHTML = "";
    (data || []).forEach((cat) =>
      selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id))
    );
  }


  // ---------------------------------------------------------
  // MESES FATURA
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // MESES LANÇAMENTO
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // CARREGAR FATURA DO MÊS
  // ---------------------------------------------------------
  async function loadFaturasSelect() {
    await loadCards();
    await loadCategorias();

    popularMesFatura();
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

    const { data: compras, error } = await supabase
      .from("cartao_lancamentos")
      .select("*")
      .eq("cartao_id", cartao_id)
      .gte("data_compra", inicio)
      .lte("data_compra", fim)
      .order("data_compra");

    if (error) {
      console.error("Erro ao carregar fatura:", error);
      listaComprasFatura.innerHTML = "<li>Erro ao carregar fatura.</li>";
      return;
    }

    const total = (compras || []).reduce((s,c)=>s + Number(c.valor||0),0);
    const card = state.cards.find((x) => x.id === cartao_id);

    faturaSummary.innerHTML = `
      <div class="big">${card?.nome || "Cartão"}</div>
      <div>${ym}</div>
      <div class="big">${formatReal(total)}</div>
    `;

    listaComprasFatura.innerHTML = "";

    (compras || []).forEach((c) => {
      const li = document.createElement("li");
      const descr = formatDescricaoExibicao(c);

      li.innerHTML = `
        <span>${formatDateShort(c.data_compra)} — ${descr}</span>
        <span>${formatReal(c.valor)}</span>
      `;

      li.style.cursor = "pointer";

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


  // ---------------------------------------------------------
  // ABRIR EDIÇÃO PARCELADA
  // ---------------------------------------------------------
  async function abrirEdicaoCompraParcelada(compra) {
    try {
      const descricaoBase = (compra.descricao || "")
        .replace(/\s*\(\d+\/\d+\)\s*$/, "")
        .trim();

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

      state.editingPurchaseParcels = q.data;
      state.editingPurchaseFull = q.data[0];

      const somaTotal =
        state.editingPurchaseParcels.reduce((s, p) => s + Number(p.valor || 0), 0);

      document.getElementById("edit-desc").value = descricaoBase;
      document.getElementById("edit-valor-total").value = Number(
        somaTotal.toFixed(2)
      );
      document.getElementById("edit-data-inicial").value =
        state.editingPurchaseParcels[0].data_compra;
      document.getElementById("edit-total-parcelas").value =
        state.editingPurchaseParcels.length;

      await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
      await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

      renderParcelasEdicao();
      showView(viewEditarCompra);
    } catch (err) {
      console.error("Erro abrir edição parcelada:", err);
      alert("Erro ao abrir edição da compra.");
    }
  }

  async function popularSelectCategoriaEdicao(selectedId) {
    const { data } = await supabase.from("categorias").select("*").order("nome");
    const sel = document.getElementById("edit-categoria");
    sel.innerHTML = "";
    (data || []).forEach((c) => {
      const op = new Option(c.nome, c.id);
      if (c.id === selectedId) op.selected = true;
      sel.appendChild(op);
    });
  }

  async function popularSelectCartaoEdicao(selectedId) {
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
      leftSpan.textContent = `(${p.parcela_atual}/${total}) — ${formatDateShort(
        p.data_compra
      )} — ${formatReal(p.valor)}`;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      const btnE = document.createElement("button");
      btnE.className = "btn-secondary";
      btnE.textContent = "Editar";
      btnE.onclick = () => editarParcela(p.id);

      const btnD = document.createElement("button");
      btnD.className = "btn-danger";
      btnD.textContent = "Excluir";
      btnD.onclick = () => excluirParcela(p.id);

      const btnA = document.createElement("button");
      btnA.className = "btn-primary";
      btnA.textContent = "Antecipar";
      btnA.onclick = () => anteciparParcela(p.id);

      actions.appendChild(btnE);
      actions.appendChild(btnD);
      actions.appendChild(btnA);

      li.appendChild(leftSpan);
      li.appendChild(actions);

      lista.appendChild(li);
    });
  }

  document.getElementById("btn-voltar-edicao").onclick = () => {
    state.editingPurchaseFull = null;
    state.editingPurchaseParcels = [];
    showView(viewFaturas);
  };

  document.getElementById("btn-excluir-compra").onclick = excluirCompraCompleta;
  document.getElementById("btn-salvar-edicao").onclick = salvarAlteracoesCompra;


  // ---------------------------------------------------------
  // EDIÇÃO PARCELADA: FUNÇÕES
  // ---------------------------------------------------------
  async function editarParcela(id) {
    const p = state.editingPurchaseParcels.find((x) => x.id === id);
    if (!p) return alert("Parcela não encontrada.");

    const novoValor = prompt("Novo valor da parcela:", p.valor);
    if (novoValor === null) return;

    const novaData = prompt("Nova data da parcela (AAAA-MM-DD):", p.data_compra);
    if (novaData === null) return;

    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({ valor: Number(novoValor), data_compra: novaData })
      .eq("id", id);

    if (error) {
      console.error(error);
      return alert("Erro ao editar.");
    }

    await abrirEdicaoCompraParcelada(p);
    await loadFaturaForSelected();
  }

  async function excluirParcela(id) {
    if (!confirm("Excluir somente esta parcela?")) return;

    const p = state.editingPurchaseParcels.find((x) => x.id === id);
    if (!p) return alert("Parcela não encontrada.");

    const { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Erro ao excluir.");
      return;
    }

    await tryReabrirCompraPorParcela(p);
    await loadFaturaForSelected();
    alert("Parcela excluída.");
  }

  async function excluirCompraCompleta() {
    const parcelas = state.editingPurchaseParcels;
    if (!parcelas || parcelas.length === 0) return;
    if (!confirm("Excluir a compra inteira?")) return;

    const ids = parcelas.map((p) => p.id);

    const { error } = await supabase
      .from("cartao_lancamentos")
      .delete()
      .in("id", ids);

    if (error) {
      console.error(error);
      return alert("Erro ao excluir compra.");
    }

    showView(viewFaturas);
    await loadFaturaForSelected();
    alert("Compra excluída com sucesso.");
  }

  async function anteciparParcela(id) {
    const p = state.editingPurchaseParcels.find(x => x.id === id);
    if (!p) return alert("Parcela não encontrada.");

    const valor = Number(p.valor);
    const hoje = formatISO(new Date());

    if (!confirm(`Antecipar parcela de ${formatReal(valor)} ?`)) return;

    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id: p.cartao_id,
      descricao: `Antecipação ${p.descricao}`,
      valor: -Math.abs(valor),
      data_compra: hoje,
      parcelas: 1,
      parcela_atual: 1,
      tipo: "pagamento",
      billed: false
    }]);

    alert("Parcela antecipada.");
    await abrirEdicaoCompraParcelada(p);
    await loadFaturaForSelected();
  }

  async function salvarAlteracoesCompra() {
    try {
      const parcelasOriginais = state.editingPurchaseParcels;
      if (!parcelasOriginais || parcelasOriginais.length === 0)
        return alert("Nada carregado.");

      const novaDesc = document.getElementById("edit-desc").value.trim();
      const novoValorTotal = Number(
        document.getElementById("edit-valor-total").value || 0
      );
      const novaDataInicial = document.getElementById("edit-data-inicial").value;
      const novoTotalParcelas = Number(
        document.getElementById("edit-total-parcelas").value || 1
      );
      const novoCartaoId = document.getElementById("edit-cartao").value;
      const novaCategoria = document.getElementById("edit-categoria").value;

      if (!novaDesc || !novoValorTotal || !novaDataInicial)
        return alert("Preencha todos os campos.");

      const ids = parcelasOriginais.map((p) => p.id);
      let { error } = await supabase
        .from("cartao_lancamentos")
        .delete()
        .in("id", ids);

      if (error) {
        console.error(error);
        return alert("Erro ao excluir antigas.");
      }

      const valorParcela = Number(
        (novoValorTotal / novoTotalParcelas).toFixed(2)
      );

      const [anoIni, mesIni, diaIni] = novaDataInicial
        .split("-")
        .map(Number);

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

      alert("Compra atualizada.");
      await loadFaturaForSelected();
      showView(viewFaturas);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar edição.");
    }
  }

  async function tryReabrirCompraPorParcela(parcela) {
    if (!parcela) return;

    const descricaoBase = (parcela.descricao || "")
      .replace(/\s*\(\d+\/\d+\)\s*$/, "")
      .trim();

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
  }


  // ---------------------------------------------------------
  // TELA À VISTA
  // ---------------------------------------------------------
  function ensureAvistaViewExists() {
    if (viewEditarAvista) return;

    const right = document.querySelector(".right-column");
    const div = document.createElement("div");
    div.id = "view-editar-avista";
    div.className = "panel view hidden";
    div.innerHTML = `
      <div class="panel-header">
        <h2>Editar compra (À vista)</h2>
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
    right.appendChild(div);
    viewEditarAvista = div;

    document.getElementById("btn-avista-voltar").onclick = () => {
      showView(viewFaturas);
    };
    document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
    document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
  }

  async function abrirEdicaoAvista(lanc) {
    ensureAvistaViewExists();

    document.getElementById("avista-desc").value =
      lanc.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

    document.getElementById("avista-valor").value = Number(lanc.valor);
    document.getElementById("avista-data").value = lanc.data_compra;

    await popularSelectCategoriaAvista(lanc.categoria_id);
    await popularSelectCartaoAvista(lanc.cartao_id);

    viewEditarAvista.dataset.lancId = lanc.id;

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

  async function salvarEdicaoAvista() {
    const id = viewEditarAvista.dataset.lancId;

    const desc = document.getElementById("avista-desc").value.trim();
    const valor = Number(document.getElementById("avista-valor").value || 0);
    const data = document.getElementById("avista-data").value;
    const cat = document.getElementById("avista-categoria").value;
    const cartao = document.getElementById("avista-cartao").value;

    if (!desc || !valor || !data) return alert("Preencha tudo!");

    const { error } = await supabase
      .from("cartao_lancamentos")
      .update({
        descricao: desc,
        valor,
        data_compra: data,
        categoria_id: cat,
        cartao_id: cartao
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return alert("Erro ao salvar.");
    }

    alert("Compra salva!");
    await loadFaturaForSelected();
    showView(viewFaturas);
  }

  async function excluirCompraAvista() {
    const id = viewEditarAvista.dataset.lancId;
    if (!confirm("Excluir compra?")) return;

    await supabase.from("cartao_lancamentos").delete().eq("id", id);

    alert("Compra excluída.");
    await loadFaturaForSelected();
    showView(viewFaturas);
  }


  // ---------------------------------------------------------
  // LANÇAMENTO DE COMPRA
  // ---------------------------------------------------------
  btnAddPurchase.onclick = async () => {
    const cartao_id = selectCartaoLanc.value;
    const descricao = cartDesc.value.trim();
    const valor = Number(cartValor.value || 0);
    const parcelas = Number(cartParcelas.value || 1);
    const parcelaInicial = Number(parcelaInicialInput.value || 1);
    const dataCompra = cartData.value;
    const categoriaSelecionada = selectCategoriaLancCartao.value;

    if (!cartao_id || !descricao || !valor || !dataCompra) {
      return alert("Preencha todos os campos, inclusive data.");
    }

    const [ano, mes, dia] = dataCompra.split("-").map(Number);

    for (let p = parcelaInicial; p <= parcelas; p++) {
      const dt = new Date(ano, mes - 1 + (p - parcelaInicial), dia);
      const dataISO = formatISO(dt);

      const descFinal =
        parcelas === 1 ? descricao : `${descricao} (${p}/${parcelas})`;
      const valorParcela =
        parcelas === 1 ? valor : Number((valor / parcelas).toFixed(2));

      await supabase.from("cartao_lancamentos").insert([{
        user_id: state.user.id,
        cartao_id,
        descricao: descFinal,
        valor: valorParcela,
        data_compra: dataISO,
        parcelas,
        parcela_atual: p,
        categoria_id: categoriaSelecionada || null,
        tipo: "compra",
        billed: false
      }]);
    }

    cartDesc.value = "";
    cartValor.value = "";
    cartParcelas.value = 1;
    cartData.value = "";
    parcelaInicialInput.value = 1;

    await loadFaturaForSelected();
    alert("Compra lançada!");
  };

  btnCancelPurchase.onclick = () => {
    showView(viewFaturas);
  };


  // ---------------------------------------------------------
  // PAGAMENTO ANTECIPADO
  // ---------------------------------------------------------
  btnPagamentoAntecipado.onclick = async () => {
    await loadSelectsForLanc();
    contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
    valorPagAntecipado.value = "";
    dataPagAntecipado.value = formatISO(new Date());
    showView(boxPagAntecipado);
  };

  btnConfirmarPagAntecipado.onclick = async () => {
    const conta = contaPagAntecipado.value;
    const valor = Number(valorPagAntecipado.value || 0);
    const data = dataPagAntecipado.value;
    const cartaoId = selectCartaoFaturas.value;

    if (!conta || !valor || !data) return alert("Preencha tudo.");

    await supabase.from("cartao_lancamentos").insert([{
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

    alert("Pagamento antecipado registrado.");
    showView(viewFaturas);
    await loadFaturaForSelected();
  };


  // ---------------------------------------------------------
  // HISTÓRICO
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // CONTAS
  // ---------------------------------------------------------
  async function loadSelectsForLanc() {
    await loadCategorias();

    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", state.user.id);

    selectContaPagamento.innerHTML = "";
    (contas || []).forEach((c) => {
      selectContaPagamento.appendChild(
        new Option(
          `${c.nome} (${formatReal(c.saldo_atual || c.saldo_inicial)})`,
          c.id
        )
      );
    });
  }


  // ---------------------------------------------------------
  // INICIALIZAÇÃO FINAL
  // ---------------------------------------------------------
  try {
    await loadCards();
    await loadCategorias();

    popularMesFatura();
    popularFaturasLancamento();

    showView(viewFaturas);
  } catch (err) {
    console.error("Erro na inicialização do cartao.js:", err);
  }

})();
