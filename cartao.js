/* cartao.js - parte 1/3
   Versão corrigida: inicialização segura para evitar travamento por elementos inexistentes
   Fonte original carregada: :contentReference[oaicite:1]{index=1}
*/

document.addEventListener("DOMContentLoaded", () => {

  // ===========================
  // Toast simples
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

  (async () => {

    // ==========================================
    // Estado
    // ==========================================
    const state = {
      user: null,
      cards: [],
      categories: [],
      editingPurchaseFull: null,
      editingPurchaseParcels: [],
      faturaAtual: null,
    };

    // ==========================================
    // Elementos DOM
    // ==========================================
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

    // CORREÇÃO: viewEditarAvista pode não existir inicialmente → inicializa com null
    let viewEditarAvista = document.getElementById("view-editar-avista") || null;

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

    const modalEditarParcela = document.getElementById("modal-editar-parcela");
    const modalParcelaValor = document.getElementById("modal-parcela-valor");
    const modalParcelaData = document.getElementById("modal-parcela-data");
    const modalParcelaSalvar = document.getElementById("modal-parcela-salvar");
    const modalParcelaCancelar = document.getElementById("modal-parcela-cancelar");

    let mesFatura = new Date();
    let mesLanc = new Date();

    // ==========================================
    // Helpers
    // ==========================================
    function formatReal(v) {
      return Number(v || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }

    function formatISO(d) {
      return new Date(d).toISOString().slice(0, 10);
    }

    function displayMes(dateObj) {
      const meses = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
      ];
      return `${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }

    // ==========================================
    // CORREÇÕES DE INICIALIZAÇÃO (IMPEDIR TRAVAMENTO)
    // ==========================================
    function hideAllViews() {
      [
        viewNewCard,
        viewFaturas,
        viewLancamento,
        viewHistorico,
        boxPagAntecipado,
        viewEditarCompra,
        viewEditarAvista
      ]
      .filter(Boolean) // remove null/undefined
      .forEach(v => v.classList.add("hidden"));
    }

    function showView(v) {
      hideAllViews();
      if (v && v.classList) v.classList.remove("hidden");
    }
// Parte 2/3 — continua

    // ==========================================
    // Sessão
    // ==========================================
    const sessionResp = await supabase.auth.getSession();
    if (!sessionResp.data.session) {
      window.location.href = "login.html";
      return;
    }

    state.user = sessionResp.data.session.user;
    if (userEmail) userEmail.textContent = state.user.email;

    // ==========================================
    // Dados principais
    // ==========================================
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

      // Re-bind buttons (com checagem)
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

    async function loadCategorias() {
      const { data } = await supabase.from("categorias").select("*").order("nome");
      state.categories = data || [];
      if (selectCategoriaLancCartao) {
        selectCategoriaLancCartao.innerHTML = "";
        (state.categories || []).forEach((cat) =>
          selectCategoriaLancCartao.appendChild(new Option(cat.nome, cat.id))
        );
      }
    }

    // ==========================================
    // Faturas: carregar / renderizar / botões
    // ==========================================
    function popularMesFatura() {
      if (mesDisplay) mesDisplay.textContent = displayMes(mesFatura);
      if (selectMesFaturas) selectMesFaturas.value = `${mesFatura.getFullYear()}-${String(mesFatura.getMonth() + 1).padStart(2, "0")}`;
    }
    if (btnMesPrev) btnMesPrev.onclick = () => {
      mesFatura.setMonth(mesFatura.getMonth() - 1);
      popularMesFatura();
      loadFaturaForSelected();
    };
    if (btnMesNext) btnMesNext.onclick = () => {
      mesFatura.setMonth(mesFatura.getMonth() + 1);
      popularMesFatura();
      loadFaturaForSelected();
    };

    function popularFaturasLancamento() {
      if (fatDisplay) fatDisplay.textContent = displayMes(mesLanc);
      if (selectFaturaInicial) selectFaturaInicial.value = `${mesLanc.getFullYear()}-${String(mesLanc.getMonth() + 1).padStart(2, "0")}`;
    }
    if (btnFatPrev) btnFatPrev.onclick = () => { mesLanc.setMonth(mesLanc.getMonth() - 1); popularFaturasLancamento(); };
    if (btnFatNext) btnFatNext.onclick = () => { mesLanc.setMonth(mesLanc.getMonth() + 1); popularFaturasLancamento(); };

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
        .gte("data_compra", inicio)
        .lte("data_compra", fim)
        .order("data_compra");

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
          const descr = ((c.descricao || "") + "").replace(/\s*\(\d+\/\d+\)\s*$/,"").trim();
          li.innerHTML = `<span>${new Date(c.data_compra + "T00:00:00").toLocaleDateString("pt-BR")} — ${descr}</span><span>${formatReal(c.valor)}</span>`;
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
        if (statusEl) statusEl.textContent = "Fatura Fechada".toUpperCase(); // keep same behavior

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

    // FECHAR FATURA
    if (btnFecharFatura) btnFecharFatura.onclick = async () => {
      try {
        const cartaoId = selectCartaoFaturas.value;
        const venc = dataVencimentoFatura.value;
        const ym = selectMesFaturas.value;

        if (!cartaoId) return showToast("Selecione um cartão.", "error");
        if (!venc) return showToast("Informe o vencimento.", "error");
        if (state.faturaAtual) return showToast("Esta fatura já está fechada.", "error");

        const [ano, mes] = ym.split("-").map(Number);
        const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
        const last = new Date(ano, mes, 0).getDate();
        const fim = `${ano}-${String(mes).padStart(2, "0")}-${last}`;

        const { data: compras } = await supabase
          .from("cartao_lancamentos")
          .select("*")
          .eq("cartao_id", cartaoId)
          .gte("data_compra", inicio)
          .lte("data_compra", fim);

        const total = (compras || []).reduce((s, c) => s + Number(c.valor || 0), 0);

        const { error } = await supabase.from("cartao_faturas").insert([{
          user_id: state.user.id,
          cartao_id: cartaoId,
          ano,
          mes,
          valor_total: total,
          data_vencimento: venc,
          pago: false,
          status: "fechada"
        }]);

        if (error) {
          console.error("Erro ao fechar fatura:", error);
          showToast("Erro ao fechar fatura.", "error");
          return;
        }

        await loadFaturaForSelected();
        showToast("Fatura fechada com sucesso.");
      } catch (err) {
        console.error("Erro ao fechar fatura:", err);
        showToast("Erro ao fechar fatura.", "error");
      }
    };
    // Parte 3/3 — final

    // PAGAR FATURA (Gerar despesa)
    if (btnPagarFatura) btnPagarFatura.onclick = async () => {
      try {
        if (!state.faturaAtual) return showToast("Feche a fatura antes de pagar.", "error");
        if (state.faturaAtual.pago) return showToast("Esta fatura já foi paga.", "error");

        const contaId = selectContaPagamento.value;
        const venc = dataVencimentoFatura.value;

        if (!contaId) return showToast("Selecione a conta para pagamento.", "error");

        const total = Number(state.faturaAtual.valor_total || 0);
        if (total <= 0) return showToast("Fatura sem valor.", "error");

        // 1 — Criar despesa baixada
        const despId = crypto.randomUUID();
        const { error: errDesp } = await supabase.from("despesas").insert([{
          id: despId,
          user_id: state.user.id,
          conta_id: contaId,
          descricao: `Pagamento fatura cartão`,
          valor: total,
          data: venc,
          categoria_id: null,
          baixado: true,
          data_baixa: venc
        }]);

        if (errDesp) {
          console.error(errDesp);
          return showToast("Erro ao gerar despesa.", "error");
        }

        // 2 — Atualizar saldo da conta
        const { data: conta } = await supabase.from("contas_bancarias")
          .select("*").eq("id", contaId).single();

        const novoSaldo = Number(conta.saldo_atual || 0) - total;

        await supabase.from("contas_bancarias")
          .update({ saldo_atual: novoSaldo }).eq("id", contaId);

        // 3 — Criar movimentação
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

        // 4 — Marcar fatura como paga
        await supabase.from("cartao_faturas")
          .update({ pago: true, status: "paga", data_vencimento: venc })
          .eq("id", state.faturaAtual.id);

        showToast("Fatura paga com sucesso!");
        await loadFaturaForSelected();

      } catch (err) {
        console.error("Erro ao pagar fatura:", err);
        showToast("Erro ao pagar fatura.", "error");
      }
    };

    // REABRIR FATURA
    async function reabrirFatura() {
      if (!state.faturaAtual)
        return showToast("Nenhuma fatura selecionada.", "error");

      if (state.faturaAtual.pago)
        return showToast("Não é possível reabrir fatura paga.", "error");

      if (!confirm("Deseja realmente reabrir esta fatura?"))
        return;

      try {
        const { error } = await supabase
          .from("cartao_faturas")
          .delete()
          .eq("id", state.faturaAtual.id);

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

    // LANÇAR COMPRA
    if (btnAddPurchase) btnAddPurchase.onclick = async () => {
      try {
        const cartao_id = selectCartaoLanc.value;
        const descricao = cartDesc.value.trim();
        const valor = Number(cartValor.value || 0);
        const parcelas = Number(cartParcelas.value || 1);
        const parcelaInicial = Number(parcelaInicialInput.value || 1);
        const dataCompra = cartData.value;
        const categoriaSelecionada = selectCategoriaLancCartao ? selectCategoriaLancCartao.value : null;

        if (!cartao_id || !descricao || !valor || !dataCompra)
          return showToast("Preencha todos os campos.", "error");

        const [ano0, mes0] = dataCompra.split("-").map(Number);

        const { data: f } = await supabase
          .from("cartao_faturas")
          .select("*")
          .eq("user_id", state.user.id)
          .eq("cartao_id", cartao_id)
          .eq("ano", ano0)
          .eq("mes", mes0)
          .maybeSingle();

        if (f && f.status === "fechada")
          return showToast("Não é possível lançar: fatura fechada.", "error");

        const [ano, mes, dia] = dataCompra.split("-").map(Number);

        for (let p = parcelaInicial; p <= parcelas; p++) {
          const dt = new Date(ano, (mes - 1) + (p - parcelaInicial), dia);
          const dataISO = formatISO(dt);
          const descFinal = parcelas === 1 ? descricao : `${descricao} (${p}/${parcelas})`;
          const valorParcela = parcelas === 1 ? valor : Number((valor / parcelas).toFixed(2));

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
        showToast("Compra lançada!");

      } catch (err) {
        console.error(err);
        showToast("Erro ao lançar compra.", "error");
      }
    };

    if (btnCancelPurchase)
      btnCancelPurchase.onclick = () => {
        cartDesc.value = "";
        cartValor.value = "";
        cartParcelas.value = 1;
        cartData.value = "";
        parcelaInicialInput.value = 1;
        showView(viewFaturas);
      };

    // PAGAMENTO ANTECIPADO
    if (btnPagamentoAntecipado) btnPagamentoAntecipado.onclick = async () => {
      await loadSelectsForLanc();
      if (contaPagAntecipado && selectContaPagamento) contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;
      if (valorPagAntecipado) valorPagAntecipado.value = "";
      if (dataPagAntecipado) dataPagAntecipado.value = formatISO(new Date());
      showView(boxPagAntecipado);
    };

    if (btnConfirmarPagAntecipado) btnConfirmarPagAntecipado.onclick = async () => {
      const conta = contaPagAntecipado ? contaPagAntecipado.value : null;
      const valor = Number(valorPagAntecipado ? valorPagAntecipado.value || 0 : 0);
      const data = dataPagAntecipado ? dataPagAntecipado.value : null;
      const cartaoId = selectCartaoFaturas ? selectCartaoFaturas.value : null;

      if (!conta || !valor || !data)
        return showToast("Preencha todos os campos.", "error");

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

      showToast("Pagamento antecipado registrado.");
      showView(viewFaturas);
      await loadFaturaForSelected();
    };

    // HISTÓRICO DE FATURAS
    async function loadHistoricoFaturas() {
      const { data } = await supabase
        .from("cartao_faturas")
        .select("*, cartoes_credito(nome)")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: false });

      if (listaFaturasHistorico) {
        listaFaturasHistorico.innerHTML = "";
        (data || []).forEach((f) => {
          const li = document.createElement("li");
          li.textContent =
            `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ` +
            `${formatReal(f.valor_total || 0)} — ` +
            `${f.pago ? "Paga" : f.status}`;
          listaFaturasHistorico.appendChild(li);
        });
      }
    }

    // SELECTS AUXILIARES
    async function loadSelectsForLanc() {
      await loadCategorias();
      const { data: contas } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("user_id", state.user.id);

      if (selectContaPagamento) {
        selectContaPagamento.innerHTML = "";
        (contas || []).forEach((c) =>
          selectContaPagamento.appendChild(
            new Option(`${c.nome} (${formatReal(c.saldo_atual)})`, c.id)
          )
        );
      }
    }

    // EDIÇÃO DE COMPRA À VISTA
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
      if (!sel) return;
      sel.innerHTML = "";
      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === id) op.selected = true;
        sel.appendChild(op);
      });
    }

    async function popularSelectCartaoAvista(id) {
      const { data } = await supabase
        .from("cartoes_credito")
        .select("*")
        .eq("user_id", state.user.id);

      const sel = document.getElementById("avista-cartao");
      if (!sel) return;
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

      if (!desc || !valor || !data)
        return showToast("Preencha tudo!", "error");

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

    // EDIÇÃO PARCELADA
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

        const editDescEl = document.getElementById("edit-desc");
        if (editDescEl) editDescEl.value = base;

        const soma = q.data.reduce((s, p) => s + Number(p.valor), 0);
        const editValorTotal = document.getElementById("edit-valor-total");
        if (editValorTotal) editValorTotal.value = soma;

        const editDataInicial = document.getElementById("edit-data-inicial");
        const editTotalParcelas = document.getElementById("edit-total-parcelas");
        if (editDataInicial) editDataInicial.value = q.data[0].data_compra;
        if (editTotalParcelas) editTotalParcelas.value = q.data.length;

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
      if (!lista) return;
      lista.innerHTML = "";

      const parcelas = state.editingPurchaseParcels || [];
      const total = parcelas.length;

      parcelas.forEach((p) => {
        const li = document.createElement("li");
        li.className = "parcela-item";
        li.dataset.parcelaId = p.id;

        li.innerHTML = `
          <span>(${p.parcela_atual}/${total}) — 
            ${new Date(p.data_compra + "T00:00:00").toLocaleDateString("pt-BR")} —
            ${formatReal(p.valor)}
          </span>
          <div class="parcela-actions">
            <button class="btn-secondary btn-edit">Editar</button>
            <button class="btn-danger btn-del">Excluir</button>
            <button class="btn-primary btn-ant">Antecipar</button>
          </div>`;

        const btnEdit = li.querySelector(".btn-edit");
        const btnDel = li.querySelector(".btn-del");
        const btnAnt = li.querySelector(".btn-ant");

        if (btnEdit) btnEdit.onclick = () => abrirModalEditarParcela(p);
        if (btnDel) btnDel.onclick = () => excluirParcela(p.id);
        if (btnAnt) btnAnt.onclick = () => anteciparParcela(p.id);

        lista.appendChild(li);
      });
    }

    // MODAL EDITAR PARCELA
    let parcelaEditandoId = null;

    function abrirModalEditarParcela(parcela) {
      parcelaEditandoId = parcela.id;
      if (modalParcelaValor) modalParcelaValor.value = parcela.valor;
      if (modalParcelaData) modalParcelaData.value = parcela.data_compra;
      if (modalEditarParcela) modalEditarParcela.classList.remove("hidden");
    }

    function fecharModalEditarParcela() {
      parcelaEditandoId = null;
      if (modalEditarParcela) modalEditarParcela.classList.add("hidden");
    }

    if (modalParcelaCancelar) modalParcelaCancelar.onclick = fecharModalEditarParcela;

    if (modalParcelaSalvar) modalParcelaSalvar.onclick = async () => {
      const novoValor = Number(modalParcelaValor ? modalParcelaValor.value : 0);
      const novaData = modalParcelaData ? modalParcelaData.value : null;

      if (!novaData || !novoValor)
        return showToast("Preencha todos os campos.", "error");

      const { error } = await supabase
        .from("cartao_lancamentos")
        .update({ valor: novoValor, data_compra: novaData })
        .eq("id", parcelaEditandoId);

      if (error) {
        console.error(error);
        return showToast("Erro ao salvar parcela.", "error");
      }

      fecharModalEditarParcela();
      await loadFaturaForSelected();
      showToast("Parcela atualizada.");
    };

    // EXCLUIR PARCELA
    async function excluirParcela(id) {
      if (!confirm("Excluir somente esta parcela?")) return;

      const { error } = await supabase
        .from("cartao_lancamentos")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(error);
        return showToast("Erro ao excluir parcela.", "error");
      }

      await loadFaturaForSelected();
      showToast("Parcela excluída.");
    }

    // ANTECIPAR PARCELA
    async function anteciparParcela(id) {
      const parcela = state.editingPurchaseParcels.find((p) => p.id === id);
      if (!parcela)
        return showToast("Parcela não encontrada.", "error");

      if (!confirm(`Antecipar parcela de ${formatReal(parcela.valor)}?`))
        return;

      const hoje = formatISO(new Date());

      await supabase.from("cartao_lancamentos").insert([{
        user_id: state.user.id,
        cartao_id: parcela.cartao_id,
        descricao: `Antecipação ${parcela.descricao}`,
        valor: -Math.abs(parcela.valor),
        data_compra: hoje,
        parcelas: 1,
        parcela_atual: 1,
        tipo: "pagamento",
        billed: false
      }]);

      showToast("Parcela antecipada.");
      await loadFaturaForSelected();
    }

    // INICIALIZAÇÃO FINAL
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

}); 

