
document.addEventListener("DOMContentLoaded", () => {

  (async () => {
    // --- CHECAGEM BÁSICA ---
    if (typeof supabase === "undefined") {
      alert("Erro: supabase.js não carregado.");
      return;
    }

    // ----------------- Estado -----------------
    const state = {
      user: null,
      cards: [],
      categories: [],
      editingPurchaseFull: null,
      editingPurchaseParcels: [],
      faturaAtual: null, // fatura fechada para cartao+mes atualmente visualizado
    };

    // ----------------- ELEMENTOS DO DOM (IDs do cartao.html) -----------------
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
    let viewEditarAvista = document.getElementById("view-editar-avista"); // gerado dinamicamente
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
    const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
    const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
    const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
    const dataPagAntecipado = document.getElementById("data-pag-antecipado");
    const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");
    const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

    // modal edição parcela
    const modalEditarParcela = document.getElementById("modal-editar-parcela");
    const modalParcelaValor = document.getElementById("modal-parcela-valor");
    const modalParcelaData = document.getElementById("modal-parcela-data");
    const modalParcelaSalvar = document.getElementById("modal-parcela-salvar");
    const modalParcelaCancelar = document.getElementById("modal-parcela-cancelar");

    // --- datas de controle de visualização ---
    let mesFatura = new Date();
    let mesLanc = new Date();

    // ---------- HELPERS ----------
    function formatReal(v) {
      return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    function formatDateShort(d) {
      if(!d) return "";
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("pt-BR");
    }
    function formatISO(d) {
      return new Date(d).toISOString().slice(0, 10);
    }
    function displayMes(dateObj) {
      const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
      return `${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }
    function formatYM(dateObj){
      const a = dateObj.getFullYear();
      const m = String(dateObj.getMonth()+1).padStart(2,"0");
      return `${a}-${m}`;
    }
    function safeNumberFromCurrency(text){
      if(!text) return 0;
      // remove R$ and dots, replace comma with dot
      return Number(text.replace(/[R$\s\.]/g,"").replace(",",".")||0);
    }

    function hideAllViews(){
      if(viewNewCard) viewNewCard.classList.add("hidden");
      if(viewFaturas) viewFaturas.classList.add("hidden");
      if(viewLancamento) viewLancamento.classList.add("hidden");
      if(viewHistorico) viewHistorico.classList.add("hidden");
      if(boxPagAntecipado) boxPagAntecipado.classList.add("hidden");
      if(viewEditarCompra) viewEditarCompra.classList.add("hidden");
      if(viewEditarAvista) viewEditarAvista.classList.add("hidden");
    }
    function showView(v){ hideAllViews(); if(v) v.classList.remove("hidden"); }

    // ----------------- Inicialização sessão -----------------
    const sessionResp = await supabase.auth.getSession();
    if (!sessionResp.data.session) {
      window.location.href = "login.html";
      return;
    }
    state.user = sessionResp.data.session.user;
    if (userEmail) userEmail.textContent = state.user.email;

    // ----------------- Eventos UI -----------------
    if (btnBack) btnBack.onclick = () => window.location.href = "app.html";
    if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = "login.html"; };
    if (document.getElementById("nav-fatura")) document.getElementById("nav-fatura").onclick = () => { showView(viewFaturas); loadFaturasSelect(); };
    if (document.getElementById("nav-lancamento")) document.getElementById("nav-lancamento").onclick = () => { showView(viewLancamento); loadSelectsForLanc(); popularFaturasLancamento(); };
    if (document.getElementById("nav-historico")) document.getElementById("nav-historico").onclick = () => { showView(viewHistorico); loadHistoricoFaturas(); };
    if (btnNewCard) btnNewCard.onclick = () => { showView(viewNewCard); if(cardNome) cardNome.value=""; if(cardLimite) cardLimite.value="0"; if(cardDiaFechamento) cardDiaFechamento.value="5"; if(cardDiaVencimento) cardDiaVencimento.value="25"; };
    if (btnCancelCard) btnCancelCard.onclick = () => showView(viewFaturas);
    if (btnSaveCard) btnSaveCard.onclick = async () => {
      const nome = cardNome.value.trim(); const limite = Number(cardLimite.value||0);
      const diaFech = Number(cardDiaFechamento.value); const diaVenc = Number(cardDiaVencimento.value);
      if(!nome) return alert("Informe o nome do cartão.");
      await supabase.from("cartoes_credito").insert([{ user_id: state.user.id, nome, limite, dia_fechamento: diaFech, dia_vencimento: diaVenc }]);
      await loadCards();
      showView(viewFaturas);
    };

    // Mês de exibição fatura
    function popularMesFatura(){ if(mesDisplay) mesDisplay.textContent = displayMes(mesFatura); if(selectMesFaturas) selectMesFaturas.value = formatYM(mesFatura); }
    if(btnMesPrev) btnMesPrev.onclick = () => { mesFatura.setMonth(mesFatura.getMonth()-1); popularMesFatura(); loadFaturaForSelected(); };
    if(btnMesNext) btnMesNext.onclick = () => { mesFatura.setMonth(mesFatura.getMonth()+1); popularMesFatura(); loadFaturaForSelected(); };

    // Mês para lançamento inicial
    function popularFaturasLancamento(){ if(fatDisplay) fatDisplay.textContent = displayMes(mesLanc); if(selectFaturaInicial) selectFaturaInicial.value = formatYM(mesLanc); }
    if(btnFatPrev) btnFatPrev.onclick = () => { mesLanc.setMonth(mesLanc.getMonth()-1); popularFaturasLancamento(); }
    if(btnFatNext) btnFatNext.onclick = () => { mesLanc.setMonth(mesLanc.getMonth()+1); popularFaturasLancamento(); }

    // ----------------- Carregar Dados Principais -----------------
    async function loadCards(){
      const { data } = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id).order("created_at", { ascending: false });
      state.cards = data || [];
      renderCards();
      populateCardSelects();
    }

    function renderCards(){
      if(!cardsList) return;
      cardsList.innerHTML = "";
      (state.cards||[]).forEach((c) => {
        const el = document.createElement("div");
        el.className = "card-item";
        el.innerHTML = `<div class="card-meta">
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
        btn.onclick = () => { selectCartaoFaturas.value = btn.dataset.id; loadFaturasSelect(); showView(viewFaturas); };
      });
      document.querySelectorAll(".btn-lancar").forEach((btn) => {
        btn.onclick = () => { selectCartaoLanc.value = btn.dataset.id; loadSelectsForLanc(); popularFaturasLancamento(); showView(viewLancamento); };
      });
      document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm("Excluir este cartão?")) return;
          await supabase.from("cartoes_credito").delete().eq("id", btn.dataset.id);
          await loadCards();
        };
      });
    }
        function populateCardSelects(){
      if(!selectCartaoFaturas || !selectCartaoLanc) return;
      selectCartaoFaturas.innerHTML = "";
      selectCartaoLanc.innerHTML = "";
      (state.cards||[]).forEach((card) => {
        selectCartaoFaturas.appendChild(new Option(card.nome, card.id));
        selectCartaoLanc.appendChild(new Option(card.nome, card.id));
      });
    }

    async function loadCategorias(){
      const { data } = await supabase.from("categorias").select("*").order("nome");
      state.categories = data || [];
      if (selectCategoriaLancCartao) {
        selectCategoriaLancCartao.innerHTML = "";
        (state.categories||[]).forEach((cat) => selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id)));
      }
    }

    // ----------------- Faturas -----------------
    async function loadFaturasSelect(){
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

    // principal: carrega compras do cartão no mês selecionado
    async function loadFaturaForSelected(){
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
        .gte("data_compra", inicio)
        .lte("data_compra", fim)
        .order("data_compra");

      if (errCompras) {
        console.error("Erro ao carregar fatura:", errCompras);
        if (listaComprasFatura) listaComprasFatura.innerHTML = "<li>Erro ao carregar fatura.</li>";
        return;
      }

      const total = (compras || []).reduce((s,c) => s + Number(c.valor||0), 0);
      const card = state.cards.find(x => x.id === cartao_id);

      if (faturaSummary) {
        faturaSummary.innerHTML = `<div class="big">${card?.nome || "Cartão"}</div><div>${ym}</div><div class="big">${formatReal(total)}</div>
          <div id="status-fatura" style="margin-top:8px;"></div>`;
      }

      if (listaComprasFatura) {
        listaComprasFatura.innerHTML = "";
        (compras || []).forEach((c) => {
          const li = document.createElement("li");
          const descr = ((c.descricao||"") + "").replace(/\s*\(\d+\/\d+\)\s*$/,"").trim();
          li.innerHTML = `<span>${formatDateShort(c.data_compra)} — ${descr}</span><span>${formatReal(c.valor)}</span>`;
          li.style.cursor = "pointer";
          li.onclick = () => {
            if (Number(c.parcelas||0) === 1) abrirEdicaoAvista(c);
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

      // set data_vencimento default from card if exists (only if no closed fatura)
      if (card && dataVencimentoFatura && !state.faturaAtual) {
        const venc = new Date(ano, mes-1, card.dia_vencimento);
        dataVencimentoFatura.value = formatISO(venc);
      } else if (state.faturaAtual && dataVencimentoFatura) {
        if (state.faturaAtual.data_vencimento) dataVencimentoFatura.value = state.faturaAtual.data_vencimento;
      }

      updateButtonsForFatura();
    }

    function updateButtonsForFatura(){
      // remove any leftover reabrir button first (it will be re-created if needed)
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

        // fatura fechada mas NÃO paga -> allow reabrir
        if (btnPagarFatura) { btnPagarFatura.disabled = false; btnPagarFatura.textContent = "Pagar Fatura"; }
        if (statusEl) statusEl.textContent = "FATURA FECHADA";

        // create "Reabrir Fatura" button appended next to fechar button
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
        // no closed fatura
        if (btnFecharFatura) { btnFecharFatura.disabled = false; btnFecharFatura.textContent = "Fechar Fatura"; }
        if (btnPagarFatura) { btnPagarFatura.disabled = false; btnPagarFatura.textContent = "Gerar Despesa"; }
        if (statusEl) statusEl.textContent = "";
      }
    }
    // FECHAR FATURA — cria registro em cartao_faturas e bloqueia edição
    if (btnFecharFatura) btnFecharFatura.onclick = async () => {
      try {
        const cartaoId = selectCartaoFaturas.value;
        const venc = dataVencimentoFatura.value;
        const ym = selectMesFaturas.value;
        if (!cartaoId) return alert("Selecione um cartão.");
        if (!venc) return alert("Informe o vencimento.");
        if (state.faturaAtual) return alert("Esta fatura já está fechada.");

        const [ano, mes] = ym.split("-").map(Number);
        const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
        const last = new Date(ano, mes, 0).getDate();
        const fim = `${ano}-${String(mes).padStart(2,"0")}-${last}`;

        const { data: compras } = await supabase
          .from("cartao_lancamentos")
          .select("*")
          .eq("cartao_id", cartaoId)
          .gte("data_compra", inicio)
          .lte("data_compra", fim);

        const total = (compras||[]).reduce((s,c) => s + Number(c.valor||0), 0);

        const { error } = await supabase.from("cartao_faturas").insert([{
          user_id: state.user.id,
          cartao_id: cartaoId,
          ano,
          mes,
          valor_total: total,
          data_vencimento: venc,          // <<-- CORREÇÃO: usar data_vencimento
          pago: false,
          status: "fechada"
        }]);

        if (error) {
          console.error("Erro ao fechar fatura:", error);
          return alert("Erro ao fechar fatura. Veja console.");
        }

        // recarregar para atualizar UI e bloquear edições
        await loadFaturaForSelected();
        alert("Fatura fechada com sucesso.");
      } catch (err) {
        console.error("Erro btnFecharFatura:", err);
        alert("Erro ao fechar fatura. Veja console.");
      }
    };

    // GERAR DESPESA / PAGAR FATURA — cria despesa + movimentação e marca fatura paga
    if (btnPagarFatura) btnPagarFatura.onclick = async () => {
      try {
        if (!state.faturaAtual) return alert("Feche a fatura antes de pagar.");
        if (state.faturaAtual.pago) return alert("Esta fatura já foi paga.");
        if (!selectContaPagamento) return alert("Selecione a conta para pagamento.");
        const cartaoId = selectCartaoFaturas?.value;
        const contaId = selectContaPagamento?.value;
        const venc = dataVencimentoFatura?.value;
        if (!contaId) return alert("Selecione a conta para pagamento.");
        const total = Number(state.faturaAtual.valor_total || 0);
        if (total <= 0) return alert("Fatura sem valor.");

        // 1) criar despesa marcada como baixada
        const despId = crypto.randomUUID();
        const { error: errDesp } = await supabase.from("despesas").insert([{
          id: despId,
          user_id: state.user.id,
          conta_id: contaId,
          descricao: `Pagamento fatura cartão ${state.faturaAtual.ano}-${String(state.faturaAtual.mes).padStart(2,"0")}`,
          valor: total,
          data: venc,
          categoria_id: null,
          baixado: true,
          data_baixa: venc
        }]);

        if (errDesp) {
          console.error("Erro ao criar despesa:", errDesp);
          return alert("Erro ao gerar despesa. Veja console.");
        }

        // 2) movimentação e atualiza saldo
        const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id", contaId).single();
        const novoSaldo = Number(conta.saldo_atual || 0) - total;
        await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaId);

        await supabase.from("movimentacoes").insert([{
          id: crypto.randomUUID(),
          user_id: state.user.id,
          conta_id: contaId,
          tipo: "debito",
          valor: total,
          descricao: `Pagamento fatura cartão`,
          data: venc,
          lancamento_id: despId
        }]);

        // 3) marcar fatura como paga
        await supabase.from("cartao_faturas").update({ pago: true, status: "paga", data_vencimento: venc }).eq("id", state.faturaAtual.id);

        alert("Fatura paga com sucesso!");
        await loadFaturaForSelected();
      } catch (err) {
        console.error("Erro btnPagarFatura:", err);
        alert("Erro ao pagar fatura. Veja console.");
      }
    };

    // ----------------- LANÇAR COMPRA -----------------
    if (btnAddPurchase) btnAddPurchase.onclick = async () => {
      try {
        const cartao_id = selectCartaoLanc?.value;
        const descricao = cartDesc?.value?.trim();
        const valor = Number(cartValor?.value || 0);
        const parcelas = Number(cartParcelas?.value || 1);
        const parcelaInicial = Number(parcelaInicialInput?.value || 1);
        const dataCompra = cartData?.value;
        const categoriaSelecionada = selectCategoriaLancCartao?.value;

        if (!cartao_id || !descricao || !valor || !dataCompra) return alert("Preencha todos os campos, inclusive data.");

        // verificar se existe fatura fechada para o mês inicial da compra
        const [ano0, mes0] = dataCompra.split("-").map(Number);
        const { data: f } = await supabase.from("cartao_faturas")
          .select("*")
          .eq("user_id", state.user.id)
          .eq("cartao_id", cartao_id)
          .eq("ano", ano0)
          .eq("mes", mes0)
          .maybeSingle();

        // only block if status === 'fechada'
        if (f && f.status === "fechada") return alert("Não é possível lançar compra: fatura já está fechada para o mês da compra.");

        // cria parcelas
        const [ano, mes, dia] = dataCompra.split("-").map(Number);
        for (let p = parcelaInicial; p <= parcelas; p++) {
          const dt = new Date(ano, (mes-1) + (p - parcelaInicial), dia);
          const dataISO = formatISO(dt);
          const descFinal = parcelas === 1 ? descricao : `${descricao} (${p}/${parcelas})`;
          const valorParcela = parcelas === 1 ? valor : Number((valor/parcelas).toFixed(2));

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

        cartDesc.value = ""; cartValor.value = ""; cartParcelas.value = 1; cartData.value = ""; parcelaInicialInput.value = 1;
        await loadFaturaForSelected();
        alert("Compra lançada!");
      } catch (err) {
        console.error("Erro btnAddPurchase:", err);
        alert("Erro ao lançar compra. Veja console.");
      }
    };

    if (btnCancelPurchase) btnCancelPurchase.onclick = () => { if(cartDesc) cartDesc.value=""; if(cartValor) cartValor.value=""; if(cartParcelas) cartParcelas.value=1; if(cartData) cartData.value=""; if(parcelaInicialInput) parcelaInicialInput.value=1; showView(viewFaturas); };

    // ----------------- PAGAMENTO ANTECIPADO -----------------
    if (btnPagamentoAntecipado) btnPagamentoAntecipado.onclick = async () => {
      await loadSelectsForLanc();
      if (contaPagAntecipado && selectContaPagamento) contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
      if (valorPagAntecipado) valorPagAntecipado.value = "";
      if (dataPagAntecipado) dataPagAntecipado.value = formatISO(new Date());
      showView(boxPagAntecipado);
    };
    if (btnConfirmarPagAntecipado) btnConfirmarPagAntecipado.onclick = async () => {
      const conta = contaPagAntecipado?.value;
      const valor = Number(valorPagAntecipado?.value || 0);
      const data = dataPagAntecipado?.value;
      const cartaoId = selectCartaoFaturas?.value;
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

    // ----------------- HISTÓRICO -----------------
    async function loadHistoricoFaturas(){
      const { data } = await supabase.from("cartao_faturas").select("*, cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at", { ascending: false });
      if(!listaFaturasHistorico) return;
      listaFaturasHistorico.innerHTML = "";
      (data || []).forEach((f) => {
        const li = document.createElement("li");
        li.textContent = `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ${formatReal(f.valor_total||0)} — ${f.pago ? "Paga" : f.status}`;
        listaFaturasHistorico.appendChild(li);
      });
    }

    // ----------------- SELECTS AUXILIARES -----------------
    async function loadSelectsForLanc(){
      await loadCategorias();
      const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);
      if (!selectContaPagamento) return;
      selectContaPagamento.innerHTML = "";
      (contas || []).forEach((c) => selectContaPagamento.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual||c.saldo_inicial)})`, c.id)));
    }
    // ----------------- EDIÇÃO DE COMPRAS (À VISTA / PARCELADAS) -----------------
    function ensureAvistaViewExists(){
      if (viewEditarAvista) return;
      const rightColumn = document.querySelector(".right-column") || document.body;
      const div = document.createElement("div");
      div.id = "view-editar-avista";
      div.className = "panel view hidden";
      div.innerHTML = `<div class="panel-header"><h2>Editar Compra (À vista)</h2><button id="btn-avista-voltar" class="btn-secondary">Voltar</button></div>
        <div class="form">
          <label>Descrição</label><input id="avista-desc">
          <label>Valor</label><input id="avista-valor" type="number" step="0.01">
          <label>Data</label><input id="avista-data" type="date">
          <label>Categoria</label><select id="avista-categoria"></select>
          <label>Cartão</label><select id="avista-cartao"></select>
          <div class="actions-row"><button id="btn-avista-salvar" class="btn-primary">Salvar</button><button id="btn-avista-excluir" class="btn-danger">Excluir</button></div>
        </div>`;
      rightColumn.appendChild(div);
      viewEditarAvista = div;
      document.getElementById("btn-avista-voltar").onclick = () => showView(viewFaturas);
      document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
      document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
    }

    async function abrirEdicaoAvista(lanc){
      ensureAvistaViewExists();
      document.getElementById("avista-desc").value = (lanc.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"").trim();
      document.getElementById("avista-valor").value = Number(lanc.valor);
      document.getElementById("avista-data").value = lanc.data_compra || lanc.data || "";
      await popularSelectCategoriaAvista(lanc.categoria_id);
      await popularSelectCartaoAvista(lanc.cartao_id);
      viewEditarAvista.dataset.lancId = lanc.id;
      showView(viewEditarAvista);
    }

    async function popularSelectCategoriaAvista(selectedId){
      const { data } = await supabase.from("categorias").select("*").order("nome");
      const sel = document.getElementById("avista-categoria");
      sel.innerHTML = "";
      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === selectedId) op.selected = true;
        sel.appendChild(op);
      });
      if (!selectedId && sel.options.length) sel.selectedIndex = 0;
    }
    async function popularSelectCartaoAvista(selectedId){
      const { data } = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id);
      const sel = document.getElementById("avista-cartao");
      sel.innerHTML = "";
      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === selectedId) op.selected = true;
        sel.appendChild(op);
      });
    }

    async function salvarEdicaoAvista(){
      const id = viewEditarAvista.dataset.lancId;
      const desc = document.getElementById("avista-desc").value.trim();
      const valor = Number(document.getElementById("avista-valor").value||0);
      const data = document.getElementById("avista-data").value;
      const cat = document.getElementById("avista-categoria").value;
      const cartao = document.getElementById("avista-cartao").value;
      if (!desc || !valor || !data) return alert("Preencha tudo!");
      const { error } = await supabase.from("cartao_lancamentos").update({ descricao: desc, valor, data_compra: data, categoria_id: cat, cartao_id: cartao }).eq("id", id);
      if (error) { console.error(error); return alert("Erro ao salvar."); }
      alert("Compra salva!");
      await loadFaturaForSelected();
      showView(viewFaturas);
    }

    async function excluirCompraAvista(){
      const id = viewEditarAvista.dataset.lancId;
      if (!confirm("Excluir compra?")) return;
      await supabase.from("cartao_lancamentos").delete().eq("id", id);
      alert("Compra excluída.");
      await loadFaturaForSelected();
      showView(viewFaturas);
    }

    // ----------------- EDIÇÃO PARCELADA (simplificada) -----------------
    async function abrirEdicaoCompraParcelada(compra){
      try {
        const descricaoBase = (compra.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"").trim();
        const q = await supabase.from("cartao_lancamentos").select("*").eq("cartao_id", compra.cartao_id).ilike("descricao", `${descricaoBase}%`).order("parcela_atual", { ascending: true });
        if (!q.data || q.data.length === 0) { alert("Não foi possível carregar as parcelas dessa compra."); return; }
        state.editingPurchaseParcels = q.data;
        state.editingPurchaseFull = q.data[0];
        // preencher campos de edição (existentes no DOM)
        document.getElementById("edit-desc").value = descricaoBase;
        const somaTotal = state.editingPurchaseParcels.reduce((s,p) => s + Number(p.valor||0), 0);
        document.getElementById("edit-valor-total").value = Number(somaTotal.toFixed(2));
        document.getElementById("edit-data-inicial").value = state.editingPurchaseParcels[0].data_compra;
        document.getElementById("edit-total-parcelas").value = state.editingPurchaseParcels.length;
        await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
        await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);
        renderParcelasEdicao();
        showView(viewEditarCompra);
      } catch (err) {
        console.error("abrirEdicaoCompraParcelada:", err);
        alert("Erro ao abrir edição da compra. Veja console.");
      }
    }

    function renderParcelasEdicao(){
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
        const btnEdit = document.createElement("button"); btnEdit.className="btn-secondary"; btnEdit.textContent="Editar";
        btnEdit.onclick = (ev) => { ev.stopPropagation(); abrirModalEditarParcela(p); };
        const btnDel = document.createElement("button"); btnDel.className="btn-danger"; btnDel.textContent="Excluir";
        btnDel.onclick = (ev) => { ev.stopPropagation(); excluirParcela(p.id); };
        const btnAnt = document.createElement("button"); btnAnt.className="btn-primary"; btnAnt.textContent="Antecipar";
        btnAnt.onclick = (ev) => { ev.stopPropagation(); anteciparParcela(p.id); };
        actionsDiv.appendChild(btnEdit); actionsDiv.appendChild(btnDel); actionsDiv.appendChild(btnAnt);
        li.appendChild(leftSpan); li.appendChild(actionsDiv);
        lista.appendChild(li);
      });
    }

    // modal editar parcela
    let parcelaEditandoId = null;
    function abrirModalEditarParcela(parcela){
      parcelaEditandoId = parcela.id;
      if (modalParcelaValor) modalParcelaValor.value = parcela.valor;
      if (modalParcelaData) modalParcelaData.value = parcela.data_compra;
      if (modalEditarParcela) modalEditarParcela.classList.remove("hidden");
    }
    function fecharModalEditarParcela(){ parcelaEditandoId = null; if (modalEditarParcela) modalEditarParcela.classList.add("hidden"); }
    if (modalParcelaSalvar) modalParcelaSalvar.onclick = async () => {
      const novoValor = Number(modalParcelaValor?.value); const novaData = modalParcelaData?.value;
      if (!novaData || !novoValor) return alert("Preencha os campos.");
      const { error } = await supabase.from("cartao_lancamentos").update({ valor: novoValor, data_compra: novaData }).eq("id", parcelaEditandoId);
      if (error) { console.error(error); alert("Erro ao salvar a parcela."); return; }
      fecharModalEditarParcela();
      await loadFaturaForSelected();
      await abrirEdicaoCompraParcelada({ id: parcelaEditandoId }); // reabre para sincronizar
    };
    if (modalParcelaCancelar) modalParcelaCancelar.onclick = fecharModalEditarParcela;

    async function excluirParcela(id){
      if (!confirm("Deseja excluir somente esta parcela?")) return;
      const p = state.editingPurchaseParcels.find(x => x.id === id);
      if (!p) return alert("Parcela não encontrada.");
      const { error } = await supabase.from("cartao_lancamentos").delete().eq("id", id);
      if (error) { console.error(error); alert("Erro ao excluir parcela."); return; }
      await loadFaturaForSelected();
      alert("Parcela excluída.");
    }

    async function anteciparParcela(id){
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

    // salvar alterações compra parcelada
    if (document.getElementById("btn-salvar-edicao")) document.getElementById("btn-salvar-edicao").onclick = async () => {
      try {
        const parcelasOriginais = state.editingPurchaseParcels;
        if (!parcelasOriginais || parcelasOriginais.length === 0) return alert("Nada carregado.");
        const novaDesc = document.getElementById("edit-desc")?.value.trim();
        const novoValorTotal = Number(document.getElementById("edit-valor-total")?.value || 0);
        const novaDataInicial = document.getElementById("edit-data-inicial")?.value;
        const novoTotalParcelas = Number(document.getElementById("edit-total-parcelas")?.value || 1);
        const novoCartaoId = document.getElementById("edit-cartao")?.value;
        const novaCategoria = document.getElementById("edit-categoria")?.value;
        if(!novaDesc||!novoValorTotal||!novaDataInicial) return alert("Preencha todos os campos.");
        const ids = parcelasOriginais.map(p=>p.id);
        let { error } = await supabase.from("cartao_lancamentos").delete().in("id", ids);
        if (error) { console.error(error); return alert("Erro ao excluir antigas."); }
        const valorParcela = Number((novoValorTotal/novoTotalParcelas).toFixed(2));
        const [anoIni, mesIni, diaIni] = novaDataInicial.split("-").map(Number);
        for (let p=1; p<=novoTotalParcelas; p++){
          const dt = new Date(anoIni, mesIni-1+(p-1), diaIni);
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
      } catch (err) { console.error(err); alert("Erro ao salvar edição."); }
    };

    if (document.getElementById("btn-excluir-compra")) document.getElementById("btn-excluir-compra").onclick = async () => {
      if (!state.editingPurchaseFull) return alert("Nenhuma compra selecionada.");
      if (!confirm("Deseja excluir toda a compra (todas as parcelas)?")) return;
      const parcelas = state.editingPurchaseParcels;
      if (!parcelas || parcelas.length === 0) return;
      const ids = parcelas.map(p=>p.id);
      const { error } = await supabase.from("cartao_lancamentos").delete().in("id", ids);
      if (error) { console.error(error); return alert("Erro ao excluir compra."); }
      state.editingPurchaseParcels = [];
      showView(viewFaturas);
      await loadFaturaForSelected();
      alert("Compra excluída com sucesso.");
    };

    // auxiliares usados na edição
    async function popularSelectCategoriaEdicao(selectedId){
      const { data } = await supabase.from("categorias").select("*").order("nome");
      const sel = document.getElementById("edit-categoria");
      if(!sel) return;
      sel.innerHTML = "";
      (data||[]).forEach((c)=>{ const op = new Option(c.nome, c.id); if(c.id===selectedId) op.selected=true; sel.appendChild(op); });
      if(!selectedId && sel.options.length>0) sel.selectedIndex=0;
    }
    async function popularSelectCartaoEdicao(selectedId){
      const { data } = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id);
      const sel = document.getElementById("edit-cartao");
      if(!sel) return;
      sel.innerHTML = "";
      (data||[]).forEach((c)=>{ const op = new Option(c.nome, c.id); if(c.id===selectedId) op.selected=true; sel.appendChild(op); });
    }

    // ----------------- Reabrir Fatura (OPÇÃO A) -----------------
    async function reabrirFatura(){
      if (!state.faturaAtual) return alert("Nenhuma fatura selecionada para reabrir.");
      if (state.faturaAtual.pago) return alert("Não é possível reabrir uma fatura já paga.");
      if (!confirm("Deseja realmente reabrir esta fatura? Isso removerá o registro de fechamento e permitirá editar as compras.")) return;
      try {
        // OPÇÃO A: removemos o registro da tabela cartao_faturas
        const { error } = await supabase.from("cartao_faturas").delete().eq("id", state.faturaAtual.id);
        if (error) {
          console.error("Erro ao reabrir fatura (delete):", error);
          return alert("Erro ao reabrir fatura. Veja console.");
        }

        // Limpa o estado local e recarrega a fatura (agora sem bloqueio)
        state.faturaAtual = null;
        await loadFaturaForSelected();
        alert("Fatura reaberta com sucesso. Agora você pode editar os lançamentos.");
      } catch (err) {
        console.error("Erro reabrirFatura:", err);
        alert("Erro ao reabrir fatura. Veja console.");
      }
    }

    // ----------------- Inicial load -----------------
    try {
      await loadCards();
      await loadCategorias();
      popularMesFatura();
      popularFaturasLancamento();
      showView(viewFaturas);
    } catch (err) {
      console.error("Erro na inicialização do cartao.js:", err);
    }

    // Expor funções (compatibilidade)
    if (typeof abrirEdicaoCompraParcelada === "function") window.abrirEdicaoCompra = abrirEdicaoCompraParcelada;
    window.abrirEdicaoAvista = abrirEdicaoAvista;
    window.editarParcela = abrirModalEditarParcela;
    window.editarParcelaInline = async (id) => {
      const parcela = state.editingPurchaseParcels.find(x => x.id === id);
      if (!parcela) return alert("Parcela não encontrada.");
      const novoValor = prompt("Novo valor da parcela:", parcela.valor);
      if (novoValor === null) return;
      const novaData = prompt("Nova data da parcela (AAAA-MM-DD):", parcela.data_compra);
      if (novaData === null) return;
      await supabase.from("cartao_lancamentos").update({ valor: Number(novoValor), data_compra: novaData }).eq("id", id);
      await loadFaturaForSelected();
      alert("Parcela editada com sucesso.");
    };
    window.excluirParcela = excluirParcela;
    window.anteciparParcela = anteciparParcela;
    window.excluirCompraCompleta = async (id) => {
      const { data } = await supabase.from("cartao_lancamentos").select("*").eq("id", id).maybeSingle();
      if (!data) return alert("Compra não encontrada.");
      const descricaoBase = (data.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"").trim();
      const q = await supabase.from("cartao_lancamentos").select("*").eq("cartao_id", data.cartao_id).ilike("descricao", `${descricaoBase}%`);
      const ids = (q.data||[]).map(x=>x.id);
      if (!ids.length) return alert("Nenhuma parcela encontrada.");
      await supabase.from("cartao_lancamentos").delete().in("id", ids);
      await loadFaturaForSelected();
      alert("Compra excluída.");
    };
    window.salvarAlteracoesCompra = document.getElementById("btn-salvar-edicao") ? (async ()=>{ document.getElementById("btn-salvar-edicao").click(); }) : (async ()=>{ alert("Salvar não disponível"); });

  })();

}); 

