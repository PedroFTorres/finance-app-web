document.addEventListener("DOMContentLoaded", () => {

  // -----------------------
  // Toast simples
  // -----------------------
  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) { alert(message); return; }
    const toast = document.createElement("div");
    toast.className = "toast";
    if (type === "error") toast.classList.add("error");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // -----------------------
  // Estado
  // -----------------------
  const state = {
    user: null,
    cards: [],
    categories: [],
    editingPurchaseFull: null,
    editingPurchaseParcels: [],
    faturaAtual: null,
  };

  // -----------------------
  // Elementos DOM (todos os IDs usados pelo app)
  // -----------------------
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

  // view edição à vista criada dinamicamente quando necessário
  let viewEditarAvista = document.getElementById("view-editar-avista") || null;

  const btnSaveCard = document.getElementById("btn-save-card");
  const btnCancelCard = document.getElementById("btn-cancel-card");

  // inputs novo cartão
  const cardNome = document.getElementById("card-nome");
  const cardLimite = document.getElementById("card-limite");
  const cardDiaFechamento = document.getElementById("card-dia-fechamento");
  const cardDiaVencimento = document.getElementById("card-dia-vencimento");

  // faturas / navegação por mês
  const selectCartaoFaturas = document.getElementById("select-cartao-faturas");
  const selectMesFaturas = document.getElementById("select-mes-faturas");
  const mesDisplay = document.getElementById("mes-display");
  const btnMesPrev = document.getElementById("mes-prev");
  const btnMesNext = document.getElementById("mes-next");

  const faturaSummary = document.getElementById("fatura-summary");
  const listaComprasFatura = document.getElementById("lista-compras-fatura");

  // pagamento / gerar despesa
  const selectContaPagamento = document.getElementById("select-conta-pagamento");
  const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");
  const btnFecharFatura = document.getElementById("btn-fechar-fatura");
  const btnPagarFatura = document.getElementById("btn-pagar-fatura");

  // lançamento
  const selectCartaoLanc = document.getElementById("select-cartao-lanc");
  const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");
  const cartDesc = document.getElementById("cart-desc");
  const cartValor = document.getElementById("cart-valor");
  const cartData = document.getElementById("cart-data");
  const cartParcelas = document.getElementById("cart-parcelas");
  const parcelaInicialInput = document.getElementById("parcela-inicial");

  // fat navigation small
  const fatDisplay = document.getElementById("fat-display");
  const btnFatPrev = document.getElementById("fat-prev");
  const btnFatNext = document.getElementById("fat-next");

  const selectFaturaInicial = document.getElementById("select-fatura-inicial");
  const btnAddPurchase = document.getElementById("btn-add-purchase");
  const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

  // pagamento antecipado
  const btnPagamentoAntecipado = document.getElementById("btn-pagamento-antecipado");
  const contaPagAntecipado = document.getElementById("conta-pag-antecipado");
  const valorPagAntecipado = document.getElementById("valor-pag-antecipado");
  const dataPagAntecipado = document.getElementById("data-pag-antecipado");
  const btnConfirmarPagAntecipado = document.getElementById("btn-confirmar-pag-antecipado");

  // histórico
  const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

  // modal editar parcela
  const modalEditarParcela = document.getElementById("modal-editar-parcela");
  const modalParcelaValor = document.getElementById("modal-parcela-valor");
  const modalParcelaData = document.getElementById("modal-parcela-data");
  const modalParcelaSalvar = document.getElementById("modal-parcela-salvar");
  const modalParcelaCancelar = document.getElementById("modal-parcela-cancelar");

  // pequenas iniciais de mês
  let mesFatura = new Date();
  let mesLanc = new Date();

  // -----------------------
  // Helpers simples
  // -----------------------
  function formatReal(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatISO(d) {
    return new Date(d).toISOString().slice(0, 10);
  }

  function displayMes(dateObj) {
    const meses = [
      "janeiro","fevereiro","março","abril","maio","junho",
      "julho","agosto","setembro","outubro","novembro","dezembro"
    ];
    return `${meses[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }

  // -----------------------
  // View controller seguro
  // -----------------------
  function hideAllViews() {
    [
      viewNewCard, viewFaturas, viewLancamento, viewHistorico,
      boxPagAntecipado, viewEditarCompra, viewEditarAvista
    ].filter(Boolean).forEach(v => v.classList.add("hidden"));
  }

  function showView(el) {
    hideAllViews();
    if (el && el.classList) el.classList.remove("hidden");
  }

  // -----------------------
  // Eventos estáticos (topo / atalhos)
  // -----------------------
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = "app.html";
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
      window.location.href = "login.html";
    });
  }

  const navFatura = document.getElementById("nav-fatura");
  const navLancamento = document.getElementById("nav-lancamento");
  const navHistorico = document.getElementById("nav-historico");

  if (navFatura) {
    navFatura.addEventListener("click", async () => {
      try { await loadFaturasSelect(); } catch(e){ console.error(e); }
      showView(viewFaturas);
    });
  }

  if (navLancamento) {
    navLancamento.addEventListener("click", async () => {
      try { await loadSelectsForLanc(); } catch(e){ console.error(e); }
      popularFaturasLancamento();
      showView(viewLancamento);
    });
  }

  if (navHistorico) {
    navHistorico.addEventListener("click", async () => {
      try { await loadHistoricoFaturas(); } catch(e){ console.error(e); }
      showView(viewHistorico);
    });
  }

  // -----------------------
  // Verifica sessão e inicia a lógica principal
  // -----------------------
  (async () => {
    const sessionResp = await supabase.auth.getSession();
    if (!sessionResp.data.session) {
      window.location.href = "login.html";
      return;
    }
    state.user = sessionResp.data.session.user;
    if (userEmail) userEmail.textContent = state.user.email;
        // -----------------------------------------------------
    // CARREGAR CARTÕES DO USUÁRIO
    // -----------------------------------------------------
    async function loadCards() {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        showToast("Erro ao carregar cartões", "error");
        return;
      }

      state.cards = data || [];
      renderCards();
      populateCardSelects();
    }

    // -----------------------------------------------------
    // RENDERIZAR LISTA DE CARTÕES NA COLUNA ESQUERDA
    // -----------------------------------------------------
    function renderCards() {
      if (!cardsList) return;
      cardsList.innerHTML = "";

      state.cards.forEach((c) => {
        const div = document.createElement("div");
        div.className = "card-item";

        div.innerHTML = `
          <div>
            <strong>${c.nome}</strong><br>
            Limite: ${formatReal(c.limite)}<br>
            Fecha dia ${c.dia_fechamento} • Venc ${c.dia_vencimento}
          </div>
          <div class="card-actions">
            <button class="btn-view-faturas" data-id="${c.id}">Faturas</button>
            <button class="btn-lancar" data-id="${c.id}">Lançar</button>
            <button class="btn-delete" data-id="${c.id}">Excluir</button>
          </div>
        `;

        cardsList.appendChild(div);
      });

      // VINCULAR EVENTOS
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
          if (!confirm("Excluir cartão?")) return;

          await supabase.from("cartoes_credito")
            .delete()
            .eq("id", btn.dataset.id);

          await loadCards();
          showToast("Cartão excluído.");
        };
      });
    }

    // -----------------------------------------------------
    // POPULAR SELECTs COM A LISTA DE CARTÕES
    // -----------------------------------------------------
    function populateCardSelects() {
      if (!selectCartaoFaturas || !selectCartaoLanc) return;

      selectCartaoFaturas.innerHTML = "";
      selectCartaoLanc.innerHTML = "";

      state.cards.forEach((card) => {
        selectCartaoFaturas.appendChild(new Option(card.nome, card.id));
        selectCartaoLanc.appendChild(new Option(card.nome, card.id));
      });
    }

    // -----------------------------------------------------
    // CARREGAR CATEGORIAS
    // -----------------------------------------------------
    async function loadCategorias() {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nome");

      if (error) {
        console.error(error);
        showToast("Erro ao carregar categorias", "error");
        return;
      }

      state.categories = data || [];

      if (selectCategoriaLancCartao) {
        selectCategoriaLancCartao.innerHTML = "";
        state.categories.forEach((cat) =>
          selectCategoriaLancCartao.appendChild(
            new Option(cat.nome, cat.id)
          )
        );
      }
    }

    // -----------------------------------------------------
    // NAVEGAÇÃO POR MÊS — FATURA
    // -----------------------------------------------------
    function popularMesFatura() {
      if (mesDisplay)
        mesDisplay.textContent = displayMes(mesFatura);

      if (selectMesFaturas)
        selectMesFaturas.value =
          `${mesFatura.getFullYear()}-${String(mesFatura.getMonth() + 1).padStart(2, "0")}`;
    }

    if (btnMesPrev)
      btnMesPrev.onclick = () => {
        mesFatura.setMonth(mesFatura.getMonth() - 1);
        popularMesFatura();
        loadFaturaForSelected();
      };

    if (btnMesNext)
      btnMesNext.onclick = () => {
        mesFatura.setMonth(mesFatura.getMonth() + 1);
        popularMesFatura();
        loadFaturaForSelected();
      };

    // -----------------------------------------------------
    // NAVEGAÇÃO POR MÊS — LANÇAMENTO
    // -----------------------------------------------------
    function popularFaturasLancamento() {
      if (fatDisplay)
        fatDisplay.textContent = displayMes(mesLanc);

      if (selectFaturaInicial)
        selectFaturaInicial.value =
          `${mesLanc.getFullYear()}-${String(mesLanc.getMonth() + 1).padStart(2, "0")}`;
    }

    if (btnFatPrev)
      btnFatPrev.onclick = () => {
        mesLanc.setMonth(mesLanc.getMonth() - 1);
        popularFaturasLancamento();
      };

    if (btnFatNext)
      btnFatNext.onclick = () => {
        mesLanc.setMonth(mesLanc.getMonth() + 1);
        popularFaturasLancamento();
      };

    // -----------------------------------------------------
    // CARREGAR FATURAS AO SELECIONAR CARTÃO
    // -----------------------------------------------------
    async function loadFaturasSelect() {
      await loadCards();
      await loadCategorias();
      popularMesFatura();
      await loadSelectsForLanc();

      if (selectCartaoFaturas && selectCartaoFaturas.options.length > 0)
        await loadFaturaForSelected();
      else
        showView(viewNewCard);
    }

    // -----------------------------------------------------
    // CARREGAR LISTA DE COMPRAS DA FATURA
    // -----------------------------------------------------
    async function loadFaturaForSelected() {
      if (!selectCartaoFaturas || !selectMesFaturas) return;

      const cartaoId = selectCartaoFaturas.value;
      const ym = selectMesFaturas.value;

      if (!cartaoId || !ym) {
        faturaSummary.innerHTML = "<div>Nenhum cartão/mês selecionado</div>";
        listaComprasFatura.innerHTML = "";
        state.faturaAtual = null;
        updateButtonsForFatura();
        return;
      }

      const [ano, mes] = ym.split("-").map(Number);
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

      const { data: compras, error } = await supabase
        .from("cartao_lancamentos")
        .select("*")
        .eq("cartao_id", cartaoId)
        .gte("data_compra", inicio)
        .lte("data_compra", fim)
        .order("data_compra");

      if (error) {
        console.error(error);
        listaComprasFatura.innerHTML = "<li>Erro ao carregar fatura</li>";
        showToast("Erro ao carregar fatura", "error");
        return;
      }

      const total = compras.reduce((acc, c) => acc + Number(c.valor), 0);

      const card = state.cards.find(x => x.id === cartaoId);

      faturaSummary.innerHTML =
        `<div class="big">${card?.nome || "Cartão"}</div>
         <div>${ym}</div>
         <div class="big">${formatReal(total)}</div>
         <div id="status-fatura" style="margin-top:8px;"></div>`;

      // preencher lista da fatura
      listaComprasFatura.innerHTML = "";
      compras.forEach((c) => {
        const baseDesc = (c.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${new Date(c.data_compra + "T00:00:00").toLocaleDateString("pt-BR")}
          — ${baseDesc}</span>
          <span>${formatReal(c.valor)}</span>`;
        li.onclick = () => {
          if (c.parcelas <= 1) abrirEdicaoAvista(c);
          else abrirEdicaoCompraParcelada(c);
        };
        listaComprasFatura.appendChild(li);
      });

      // checar se existe registro de fatura (fechada/paga)
      const { data: faturaDB } = await supabase
        .from("cartao_faturas")
        .select("*")
        .eq("user_id", state.user.id)
        .eq("cartao_id", cartaoId)
        .eq("ano", ano)
        .eq("mes", mes)
        .maybeSingle();

      state.faturaAtual = faturaDB || null;

      // preencher data vencimento
      if (!state.faturaAtual && card) {
        const venc = new Date(ano, mes - 1, card.dia_vencimento);
        dataVencimentoFatura.value = formatISO(venc);
      } else if (state.faturaAtual) {
        dataVencimentoFatura.value = state.faturaAtual.data_vencimento || "";
      }

      updateButtonsForFatura();
    }

    // -----------------------------------------------------
    // ATUALIZAR BOTÕES DE FATURA (fechar / pagar / reabrir)
    // -----------------------------------------------------
    function updateButtonsForFatura() {
      const btnReabrirExistente = document.getElementById("btn-reabrir-fatura");
      if (btnReabrirExistente) btnReabrirExistente.remove();

      const statusEl = document.getElementById("status-fatura");

      // Se existe fatura registrada
      if (state.faturaAtual) {

        // fatura fechada
        btnFecharFatura.disabled = true;
        btnFecharFatura.textContent = "Fatura Fechada";

        // fatura paga
        if (state.faturaAtual.pago) {
          btnPagarFatura.disabled = true;
          btnPagarFatura.textContent = "Fatura Paga";
          statusEl.textContent = "FATURA PAGA";
          return;
        }

        // fechada mas não paga
        btnPagarFatura.disabled = false;
        btnPagarFatura.textContent = "Pagar Fatura";
        statusEl.textContent = "FATURA FECHADA";

        // botão reabrir
        const btn = document.createElement("button");
        btn.id = "btn-reabrir-fatura";
        btn.className = "btn-secondary";
        btn.style.marginLeft = "8px";
        btn.textContent = "Reabrir Fatura";
        btn.onclick = reabrirFatura;
        btnFecharFatura.parentNode.appendChild(btn);

      } else {
        // fatura ainda não criada
        btnFecharFatura.disabled = false;
        btnFecharFatura.textContent = "Fechar Fatura";

        btnPagarFatura.disabled = false;
        btnPagarFatura.textContent = "Gerar Despesa";

        if (statusEl) statusEl.textContent = "";
      }
    }
    // -----------------------------------------------------
    // FECHAR FATURA
    // -----------------------------------------------------
    if (btnFecharFatura) {
      btnFecharFatura.onclick = async () => {
        try {
          const cartaoId = selectCartaoFaturas.value;
          const venc = dataVencimentoFatura.value;
          const ym = selectMesFaturas.value;

          if (!cartaoId) return showToast("Selecione um cartão.", "error");
          if (!venc) return showToast("Informe o vencimento.", "error");
          if (state.faturaAtual) return showToast("Fatura já fechada.", "error");

          const [ano, mes] = ym.split("-").map(Number);
          const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
          const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

          // buscar compras do período
          const { data: compras } = await supabase
            .from("cartao_lancamentos")
            .select("*")
            .eq("cartao_id", cartaoId)
            .gte("data_compra", inicio)
            .lte("data_compra", fim);

          const total = compras.reduce((s, c) => s + Number(c.valor), 0);

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
            console.error(error);
            return showToast("Erro ao fechar fatura.", "error");
          }

          await loadFaturaForSelected();
          showToast("Fatura fechada com sucesso.");

        } catch (err) {
          console.error(err);
          showToast("Erro ao fechar fatura.", "error");
        }
      };
    }

    // -----------------------------------------------------
    // PAGAR FATURA
    // -----------------------------------------------------
    if (btnPagarFatura) {
      btnPagarFatura.onclick = async () => {
        try {
          if (!state.faturaAtual)
            return showToast("Feche a fatura antes de pagar.", "error");

          if (state.faturaAtual.pago)
            return showToast("Essa fatura já está paga.", "error");

          const contaId = selectContaPagamento.value;
          const venc = dataVencimentoFatura.value;

          if (!contaId) return showToast("Selecione a conta.", "error");

          const total = Number(state.faturaAtual.valor_total || 0);
          if (total <= 0)
            return showToast("Fatura sem valor.", "error");

          // criar despesa baixada
          const despId = crypto.randomUUID();
          const { error: errDesp } = await supabase.from("despesas").insert([{
            id: despId,
            user_id: state.user.id,
            conta_id: contaId,
            descricao: "Pagamento de fatura",
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

          // atualizar saldo da conta
          const { data: conta } = await supabase
            .from("contas_bancarias")
            .select("*")
            .eq("id", contaId)
            .single();

          const novoSaldo = Number(conta.saldo_atual || 0) - total;
          await supabase.from("contas_bancarias")
            .update({ saldo_atual: novoSaldo })
            .eq("id", contaId);

          // registrar movimentação
          await supabase.from("movimentacoes").insert([{
            id: crypto.randomUUID(),
            user_id: state.user.id,
            conta_id: contaId,
            tipo: "debito",
            valor: total,
            descricao: "Pagamento de fatura",
            data: venc,
            lancamento_id: despId
          }]);

          // marcar como paga
          await supabase.from("cartao_faturas")
            .update({ pago: true, status: "paga" })
            .eq("id", state.faturaAtual.id);

          showToast("Fatura paga!");
          await loadFaturaForSelected();

        } catch (err) {
          console.error(err);
          showToast("Erro ao pagar fatura.", "error");
        }
      };
    }

    // -----------------------------------------------------
    // REABRIR FATURA FECHADA
    // -----------------------------------------------------
    async function reabrirFatura() {
      if (!state.faturaAtual)
        return showToast("Nenhuma fatura selecionada.", "error");

      if (state.faturaAtual.pago)
        return showToast("Não é possível reabrir fatura paga.", "error");

      if (!confirm("Deseja realmente reabrir a fatura?"))
        return;

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
      showToast("Fatura reaberta.");
    }

    // -----------------------------------------------------
    // LANÇAR COMPRA NO CARTÃO
    // -----------------------------------------------------
    if (btnAddPurchase) {
      btnAddPurchase.onclick = async () => {
        try {
          const cartaoId = selectCartaoLanc.value;
          const descricao = cartDesc.value.trim();
          const valor = Number(cartValor.value || 0);
          const parcelas = Number(cartParcelas.value || 1);
          const parcelaInicial = Number(parcelaInicialInput.value || 1);
          const dataCompra = cartData.value;
          const categoriaId = selectCategoriaLancCartao?.value || null;

          if (!cartaoId || !descricao || !valor || !dataCompra)
            return showToast("Preencha todos os campos.", "error");

          const [ano, mes] = dataCompra.split("-").map(Number);

          // impedir lançamento em fatura fechada
          const { data: fat } = await supabase
            .from("cartao_faturas")
            .select("*")
            .eq("user_id", state.user.id)
            .eq("cartao_id", cartaoId)
            .eq("ano", ano)
            .eq("mes", mes)
            .maybeSingle();

          if (fat && fat.status === "fechada")
            return showToast("Essa fatura já está fechada.", "error");

          // gerar parcelas
          const [y, m, d] = dataCompra.split("-").map(Number);

          for (let p = parcelaInicial; p <= parcelas; p++) {
            const dt = new Date(y, (m - 1) + (p - parcelaInicial), d);
            const dataISO = formatISO(dt);

            const valorParcela =
              parcelas === 1 ? valor :
              Number((valor / parcelas).toFixed(2));

            const descFinal =
              parcelas === 1 ? descricao :
              `${descricao} (${p}/${parcelas})`;

            await supabase.from("cartao_lancamentos").insert([{
              user_id: state.user.id,
              cartao_id: cartaoId,
              descricao: descFinal,
              valor: valorParcela,
              data_compra: dataISO,
              parcelas,
              parcela_atual: p,
              categoria_id: categoriaId,
              tipo: "compra",
              billed: false
            }]);
          }

          // limpar inputs
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
    }

    // -----------------------------------------------------
    // CANCELAR LANÇAMENTO — VOLTA PARA FATURAS
    // -----------------------------------------------------
    if (btnCancelPurchase) {
      btnCancelPurchase.onclick = () => {
        cartDesc.value = "";
        cartValor.value = "";
        cartParcelas.value = 1;
        cartData.value = "";
        parcelaInicialInput.value = 1;
        showView(viewFaturas);
      };
    }

    // -----------------------------------------------------
    // PAGAMENTO ANTECIPADO
    // -----------------------------------------------------
    if (btnPagamentoAntecipado) {
      btnPagamentoAntecipado.onclick = async () => {
        await loadSelectsForLanc();
        if (contaPagAntecipado)
          contaPagAntecipado.innerHTML = selectContaPagamento.innerHTML;

        if (valorPagAntecipado) valorPagAntecipado.value = "";
        if (dataPagAntecipado) dataPagAntecipado.value = formatISO(new Date());

        showView(boxPagAntecipado);
      };
    }

    if (btnConfirmarPagAntecipado) {
      btnConfirmarPagAntecipado.onclick = async () => {
        const conta = contaPagAntecipado?.value || null;
        const valor = Number(valorPagAntecipado?.value || 0);
        const data = dataPagAntecipado?.value || null;
        const cartaoId = selectCartaoFaturas?.value || null;

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
    }
    // -----------------------------------------------------
    // HISTÓRICO DE FATURAS
    // -----------------------------------------------------
    async function loadHistoricoFaturas() {
      const { data, error } = await supabase
        .from("cartao_faturas")
        .select("*, cartoes_credito(nome)")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        showToast("Erro ao carregar histórico", "error");
        return;
      }

      if (!listaFaturasHistorico) return;

      listaFaturasHistorico.innerHTML = "";

      (data || []).forEach((f) => {
        const li = document.createElement("li");
        li.textContent =
          `${f.cartoes_credito?.nome} • ${f.mes}/${f.ano} — ` +
          `${formatReal(f.valor_total)} — ` +
          `${f.pago ? "Paga" : f.status}`;
        listaFaturasHistorico.appendChild(li);
      });
    }

    // -----------------------------------------------------
    // SELECTS AUXILIARES (categorias, contas, etc)
    // -----------------------------------------------------
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

    // =====================================================================
    // EDIÇÃO DE COMPRA À VISTA
    // =====================================================================

    // Criar tela de edição à vista caso não exista
    function ensureAvistaViewExists() {
      if (viewEditarAvista) return;

      const container = document.querySelector(".right-column") || document.body;

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

      container.appendChild(div);
      viewEditarAvista = div;

      // vincular botões
      document.getElementById("btn-avista-voltar").onclick = () => showView(viewFaturas);
      document.getElementById("btn-avista-salvar").onclick = salvarEdicaoAvista;
      document.getElementById("btn-avista-excluir").onclick = excluirCompraAvista;
    }

    // Abrir tela de edição à vista
    async function abrirEdicaoAvista(item) {
      ensureAvistaViewExists();

      document.getElementById("avista-desc").value =
        (item.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

      document.getElementById("avista-valor").value = item.valor;
      document.getElementById("avista-data").value =
        item.data_compra || item.data || "";

      await popularSelectCategoriaAvista(item.categoria_id);
      await popularSelectCartaoAvista(item.cartao_id);

      viewEditarAvista.dataset.lancId = item.id;
      showView(viewEditarAvista);
    }

    // Select categoria edição à vista
    async function popularSelectCategoriaAvista(id) {
      const { data } = await supabase
        .from("categorias")
        .select("*")
        .order("nome");

      const sel = document.getElementById("avista-categoria");
      if (!sel) return;

      sel.innerHTML = "";

      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === id) op.selected = true;
        sel.appendChild(op);
      });
    }

    // Select cartão edição à vista
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

    // Salvar compra à vista
    async function salvarEdicaoAvista() {
      const id = viewEditarAvista.dataset.lancId;

      const desc = document.getElementById("avista-desc").value.trim();
      const valor = Number(document.getElementById("avista-valor").value || 0);
      const data = document.getElementById("avista-data").value;
      const categoria = document.getElementById("avista-categoria").value;
      const cartao = document.getElementById("avista-cartao").value;

      if (!desc || !valor || !data)
        return showToast("Preencha todos os campos!", "error");

      const { error } = await supabase
        .from("cartao_lancamentos")
        .update({
          descricao: desc,
          valor,
          data_compra: data,
          categoria_id: categoria,
          cartao_id: cartao
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        return showToast("Erro ao salvar", "error");
      }

      showToast("Compra atualizada!");
      await loadFaturaForSelected();
      showView(viewFaturas);
    }

    // Excluir compra à vista
    async function excluirCompraAvista() {
      const id = viewEditarAvista.dataset.lancId;

      if (!confirm("Deseja realmente excluir esta compra?"))
        return;

      const { error } = await supabase
        .from("cartao_lancamentos")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(error);
        return showToast("Erro ao excluir compra.", "error");
      }

      showToast("Compra excluída!");
      await loadFaturaForSelected();
      showView(viewFaturas);
    }
    // -----------------------------------------------------
    // EDIÇÃO PARCELADA: abrir, renderizar parcelas, ações
    // -----------------------------------------------------
    async function abrirEdicaoCompraParcelada(item) {
      try {
        const base = (item.descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

        const { data: parcelasData, error } = await supabase
          .from("cartao_lancamentos")
          .select("*")
          .eq("cartao_id", item.cartao_id)
          .ilike("descricao", `${base}%`)
          .order("parcela_atual", { ascending: true });

        if (error || !parcelasData || parcelasData.length === 0) {
          console.error(error);
          return showToast("Não foi possível carregar parcelas.", "error");
        }

        state.editingPurchaseParcels = parcelasData;
        state.editingPurchaseFull = parcelasData[0];

        // preencher campos gerais de edição (se existirem)
        const editDescEl = document.getElementById("edit-desc");
        if (editDescEl) editDescEl.value = base;

        const editValorTotal = document.getElementById("edit-valor-total");
        if (editValorTotal) editValorTotal.value = parcelasData.reduce((s, p) => s + Number(p.valor || 0), 0);

        const editDataInicial = document.getElementById("edit-data-inicial");
        if (editDataInicial) editDataInicial.value = parcelasData[0].data_compra;

        const editTotalParcelas = document.getElementById("edit-total-parcelas");
        if (editTotalParcelas) editTotalParcelas.value = parcelasData.length;

        await popularSelectCategoriaEdicao(state.editingPurchaseFull.categoria_id);
        await popularSelectCartaoEdicao(state.editingPurchaseFull.cartao_id);

        renderParcelasEdicao();
        showView(viewEditarCompra);

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

        li.innerHTML = `
          <div class="parcela-info">
            <span class="parcela-num">(${p.parcela_atual}/${total})</span>
            <span class="parcela-data">${new Date(p.data_compra + "T00:00:00").toLocaleDateString("pt-BR")}</span>
            <span class="parcela-valor">${formatReal(p.valor)}</span>
          </div>
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

    // -----------------------------------------------------
    // MODAL: editar parcela (abrir, salvar, cancelar)
    // -----------------------------------------------------
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
      try {
        const novoValor = Number(modalParcelaValor ? modalParcelaValor.value : 0);
        const novaData = modalParcelaData ? modalParcelaData.value : null;

        if (!novaData || !novoValor) return showToast("Preencha todos os campos.", "error");

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
      } catch (err) {
        console.error(err);
        showToast("Erro ao salvar parcela.", "error");
      }
    };

    // -----------------------------------------------------
    // EXCLUIR PARCELA
    // -----------------------------------------------------
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

    // -----------------------------------------------------
    // ANTECIPAR PARCELA
    // -----------------------------------------------------
    async function anteciparParcela(id) {
      const parcela = state.editingPurchaseParcels.find(p => p.id === id);
      if (!parcela) return showToast("Parcela não encontrada.", "error");

      if (!confirm(`Antecipar parcela de ${formatReal(parcela.valor)}?`)) return;

      const hoje = formatISO(new Date());

      const { error } = await supabase.from("cartao_lancamentos").insert([{
        user_id: state.user.id,
        cartao_id: parcela.cartao_id,
        descricao: `Antecipação ${parcela.descricao || ""}`,
        valor: -Math.abs(parcela.valor),
        data_compra: hoje,
        parcelas: 1,
        parcela_atual: 1,
        tipo: "pagamento",
        billed: false
      }]);

      if (error) {
        console.error(error);
        return showToast("Erro ao antecipar parcela.", "error");
      }

      showToast("Parcela antecipada.");
      await loadFaturaForSelected();
    }

    // -----------------------------------------------------
    // FUNÇÕES AUXILIARES PARA EDIÇÃO (selects em tela de edição)
    // -----------------------------------------------------
    async function popularSelectCategoriaEdicao(id) {
      const { data } = await supabase.from("categorias").select("*").order("nome");
      const sel = document.getElementById("edit-categoria");
      if (!sel) return;
      sel.innerHTML = "";
      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === id) op.selected = true;
        sel.appendChild(op);
      });
    }

    async function popularSelectCartaoEdicao(id) {
      const { data } = await supabase
        .from("cartoes_credito")
        .select("*")
        .eq("user_id", state.user.id);

      const sel = document.getElementById("edit-cartao");
      if (!sel) return;
      sel.innerHTML = "";
      (data || []).forEach((c) => {
        const op = new Option(c.nome, c.id);
        if (c.id === id) op.selected = true;
        sel.appendChild(op);
      });
    }

    // -----------------------------------------------------
    // INICIALIZAÇÃO FINAL
    // -----------------------------------------------------
    (async () => {
      try {
        await loadCards();
        await loadCategorias();
        popularMesFatura();
        popularFaturasLancamento();

        // abrir view padrão
        if (viewFaturas) showView(viewFaturas);
        else if (viewNewCard) showView(viewNewCard);
      } catch (err) {
        console.error(err);
        showToast("Erro ao iniciar aplicação.", "error");
      }
    })();
