/* ============================================================
   APP.JS FINAL — COMPATÍVEL COM SEU HTML ATUAL
   ============================================================
   - Navegação moderna (data-screen / data-target)
   - Contas funcionando
   - Categorias funcionando
   - Lançamentos funcionando + parcelamento
   - Extrato funcionando
   - Gráficos de receitas/despesas por categoria funcionando
   - Baixa e cancelar baixa
   - Realtime Supabase
   - Sem erros de função inexistente
============================================================ */

(() => {
  "use strict";

  /* ============================================================
     ESTADO GLOBAL
  ============================================================ */
  const STATE = {
    user: null,
    contas: [],
    categorias: [],
    receitas: [],
    despesas: [],
    charts: { recCat: null, desCat: null, resumo: null }
  };

  /* ============================================================
     SELECTORES / IDs DO HTML
  ============================================================ */
  const IDS = {
    userEmail: "user-email",
    logoutBtn: "btn-logout",

    // navegação
    menuBtns: ".menu-btn",
    screens: "[data-screen]",

    // dashboard
    chartRecCat: "chart-receitas-categorias",
    chartDesCat: "chart-despesas-categorias",
    chartResumo: "chart-dashboard",
    dashReceber: "dash-receber",
    dashPagar: "dash-pagar",
    dashSaldo: "dash-saldo-atual",

    // contas
    btnAddConta: "btn-add-conta",
    contaNome: "conta-nome",
    contaSaldo: "conta-saldo",
    contaDataSaldo: "conta-data-saldo",
    selectContasLista: "select-contas-lista",

    // extrato
    selectExtrato: "select-contas-extrato",
    periodoExtrato: "periodo-extrato",
    dataInicioExtrato: "data-inicio",
    dataFimExtrato: "data-fim",
    btnFiltrarExtrato: "btn-filtrar-extrato",
    tableExtrato: "table-extrato",

    // categorias
    categoriaNome: "categoria-nome",
    btnAddCategoria: "btn-add-categoria",
    listaCategorias: "lista-categorias",

    // lançamentos
    selectContas: "select-contas",
    periodoLanc: "periodo-lanc",
    dataInicioLanc: "data-inicio-lanc",
    dataFimLanc: "data-fim-lanc",
    btnFiltrarLanc: "btn-filtrar-lanc",

    tipoLanc: "tipo-lancamento",
    valorLanc: "valor-lanc",
    descLanc: "desc-lanc",
    dataLanc: "data-lanc",
    selectContaLanc: "select-conta-lanc",
    categoriaLanc: "categoria-lanc",
    recorrenciaTipo: "recorrencia-tipo",
    recorrenciaParcelas: "recorrencia-parcelas",
    btnAddLanc: "btn-add-lanc",
    btnCancelEdit: "btn-cancel-edit",

    listReceitas: "list-receitas",
    listDespesas: "list-despesas",

    totalReceitas: "total-receitas",
    totalDespesas: "total-despesas",
    saldoAtual: "saldo-atual"
  };

  /* ============================================================
     HELPERS
  ============================================================ */
  const $ = id => document.getElementById(id);
  const $all = sel => Array.from(document.querySelectorAll(sel));

  const fmt = v =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const fmtDate = d => {
    if (!d) return "";
    const x = new Date(d + "T00:00:00");
    return `${String(x.getDate()).padStart(2, "0")}/${String(
      x.getMonth() + 1
    ).padStart(2, "0")}/${x.getFullYear()}`;
  };

  const uuid = () => crypto.randomUUID();
  const today = () => new Date().toISOString().slice(0, 10);

  /* ============================================================
     AUTH
  ============================================================ */
  async function ensureSession() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return false;
    STATE.user = data.session.user;
    const e = $(IDS.userEmail);
    if (e) e.textContent = STATE.user.email;
    return true;
  }

  /* ============================================================
     SERVIÇOS
  ============================================================ */
  const ContasService = {
    async load() {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("user_id", STATE.user.id)
        .order("nome");
      if (error) {
        console.error("ContasService.load", error);
        return (STATE.contas = []);
      }
      return (STATE.contas = data || []);
    },

    async create({ nome, saldo, data_saldo }) {
      const item = {
        id: uuid(),
        nome,
        saldo_inicial: Number(saldo || 0),
        saldo_atual: Number(saldo || 0),
        data_saldo,
        user_id: STATE.user.id
      };
      const { error } = await supabase
        .from("contas_bancarias")
        .insert([item]);
      if (error) throw error;
      await this.load();
      return item;
    }
  };

  const CategoriasService = {
    async load() {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("nome");

      if (error) {
        console.error("CategoriasService.load", error);
        return (STATE.categorias = []);
      }
      return (STATE.categorias = data || []);
    },

    async add(nome) {
      const item = { id: uuid(), nome };
      const { error } = await supabase.from("categorias").insert([item]);
      if (error) throw error;
      await this.load();
      return item;
    }
  };

  const LancService = {
    async fetch({ tipo, conta_id, inicio, fim }) {
      const tabela = tipo === "receita" ? "receitas" : "despesas";
      let q = supabase
        .from(tabela)
        .select("*")
        .eq("user_id", STATE.user.id)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data");

      if (conta_id !== "all") q = q.eq("conta_id", conta_id);

      const { data, error } = await q;
      if (error) {
        console.error("LancService.fetch", error);
        return [];
      }
      return data || [];
    },

    async insert({ tipo, descricao, valor, data, conta_id, categoria_id }) {
      const tabela = tipo === "receita" ? "receitas" : "despesas";
      const item = {
        id: uuid(),
        user_id: STATE.user.id,
        descricao,
        valor: Number(valor),
        data,
        conta_id: conta_id || null,
        categoria_id: categoria_id || null,
        baixado: false
      };
      const { error } = await supabase.from(tabela).insert([item]);
      if (error) throw error;
      return item;
    },

    async delete({ tipo, id }) {
      const tabela = tipo === "receita" ? "receitas" : "despesas";
      await supabase.from(tabela).delete().eq("id", id);
    }
  };

  const ExtratoService = {
    async fetch({ conta_id, inicio, fim }) {
      let q = supabase
        .from("movimentacoes")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data");

      if (conta_id !== "all") q = q.eq("conta_id", conta_id);

      const { data, error } = await q;
      if (error) {
        console.error("ExtratoService.fetch", error);
        return [];
      }
      return data || [];
    }
  };

  /* ============================================================
     UI (INTERFACE)
  ============================================================ */
  const UI = {
    init() {
      // -----------------------
      // Navegação moderna
      // -----------------------
      $all(IDS.menuBtns).forEach(btn =>
        btn.addEventListener("click", () => {
          App.showScreen(btn.dataset.target);
        })
      );

      // -----------------------
      // Tabs da tela Contas
      // -----------------------
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".tab-btn")
            .forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          const tab = btn.dataset.tab;

          ["tab-cadastro", "tab-extrato", "tab-categorias"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
          });

          const show = document.getElementById("tab-" + tab);
          if (show) show.classList.remove("hidden");

          if (tab === "categorias") UI.renderCategoriasList();
          if (tab === "extrato") App.renderExtrato();
        });
      });

      // -----------------------
      // Período Lançamentos
      // -----------------------
      const pL = $(IDS.periodoLanc);
      if (pL)
        pL.addEventListener("change", () => {
          const show = pL.value === "personalizado";
          $(IDS.dataInicioLanc).classList.toggle("hidden", !show);
          $(IDS.dataFimLanc).classList.toggle("hidden", !show);
        });

      // -----------------------
      // Período Extrato
      // -----------------------
      const pE = $(IDS.periodoExtrato);
      if (pE)
        pE.addEventListener("change", () => {
          const show = pE.value === "personalizado";
          $(IDS.dataInicioExtrato).classList.toggle("hidden", !show);
          $(IDS.dataFimExtrato).classList.toggle("hidden", !show);
        });

      // -----------------------
      // Botão filtrar lançamentos
      // -----------------------
      const btnFL = $(IDS.btnFiltrarLanc);
      if (btnFL)
        btnFL.addEventListener("click", e => {
          e.preventDefault();
          App.refreshLancamentos();
        });

      // -----------------------
      // Botão filtrar extrato
      // -----------------------
      const btnFE = $(IDS.btnFiltrarExtrato);
      if (btnFE)
        btnFE.addEventListener("click", e => {
          e.preventDefault();
          App.renderExtrato();
        });

      // -----------------------
      // Botão logout
      // -----------------------
      const btnLogout = $(IDS.logoutBtn);
      if (btnLogout)
        btnLogout.addEventListener("click", async () => {
          await supabase.auth.signOut();
          window.location = "login.html";
        });

      // -----------------------
      // Botão adicionar categoria
      // -----------------------
      const btnAddCat = $(IDS.btnAddCategoria);
      if (btnAddCat)
        btnAddCat.addEventListener("click", async () => {
          const nome = $(IDS.categoriaNome).value.trim();
          if (!nome) return alert("Informe o nome.");
          await CategoriasService.add(nome);
          await App.reloadContasCategorias();
        });

      // -----------------------
      // Botão adicionar conta
      // -----------------------
      const btnAddConta = $(IDS.btnAddConta);
      if (btnAddConta)
        btnAddConta.addEventListener("click", async () => {
          const nome = $(IDS.contaNome).value.trim();
          const saldo = $(IDS.contaSaldo).value;
          const data_saldo = $(IDS.contaDataSaldo).value;
          if (!nome || !data_saldo) return alert("Preencha todos os campos.");
          await ContasService.create({ nome, saldo, data_saldo });
          await App.reloadContasCategorias();
        });

      // -----------------------
      // Botão adicionar lançamento
      // -----------------------
      const btnAddLanc = $(IDS.btnAddLanc);
      if (btnAddLanc)
        btnAddLanc.addEventListener("click", async () => {
          const tipo = $(IDS.tipoLanc).value;
          const descricao = $(IDS.descLanc).value.trim();
          const valor = Number($(IDS.valorLanc).value || 0);
          const data = $(IDS.dataLanc).value;
          const conta_id = $(IDS.selectContaLanc).value;
          const categoria_id = $(IDS.categoriaLanc).value;

          const recTipo = $(IDS.recorrenciaTipo).value;
          const parcelas = Number($(IDS.recorrenciaParcelas).value || 1);

          if (!descricao || !valor || !data)
            return alert("Complete todos os campos.");

          // Lançamento simples
          if (recTipo === "none" || parcelas <= 1) {
            await LancService.insert({
              tipo,
              descricao,
              valor,
              data,
              conta_id,
              categoria_id
            });

            $(IDS.descLanc).value = "";
            $(IDS.valorLanc).value = "";
            $(IDS.dataLanc).value = "";
            await App.refreshLancamentos();
            return;
          }

          // Lançamento parcelado
          let base = new Date(data + "T00:00:00");

          for (let i = 1; i <= parcelas; i++) {
            let d = new Date(base);
            if (i > 1) {
              if (recTipo === "monthly") d.setMonth(d.getMonth() + (i - 1));
              if (recTipo === "fortnight")
                d.setDate(d.getDate() + 15 * (i - 1));
              if (recTipo === "weekly") d.setDate(d.getDate() + 7 * (i - 1));
              if (recTipo === "annual")
                d.setFullYear(d.getFullYear() + (i - 1));
            }

            const dataParc = d.toISOString().slice(0, 10);
            let vParc = Number((valor / parcelas).toFixed(2));

            if (i === 1) {
              const somaBase = Number((vParc * parcelas).toFixed(2));
              const dif = Number((valor - somaBase).toFixed(2));
              vParc = Number((vParc + dif).toFixed(2));
            }

            await LancService.insert({
              tipo,
              descricao: `${descricao} (${i}/${parcelas})`,
              valor: vParc,
              data: dataParc,
              conta_id,
              categoria_id
            });
          }

          $(IDS.descLanc).value = "";
          $(IDS.valorLanc).value = "";
          $(IDS.dataLanc).value = "";
          await App.refreshLancamentos();
        });

      // -----------------------
      // Cancelar edição
      // -----------------------
      const btnCancel = $(IDS.btnCancelEdit);
      if (btnCancel)
        btnCancel.addEventListener("click", () => {
          $(IDS.descLanc).value = "";
          $(IDS.valorLanc).value = "";
          $(IDS.dataLanc).value = "";
          btnCancel.classList.add("hidden");
          $(IDS.btnAddLanc).textContent = "Adicionar";
        });
    },

    /* ------------------------------------------------------------
       Preencher selects de contas + categorias
    ------------------------------------------------------------ */
    async populateContasCategorias() {
      const selLanc = $(IDS.selectContas);
      const selExt = $(IDS.selectExtrato);
      const selContaLanc = $(IDS.selectContaLanc);
      const selLista = $(IDS.selectContasLista);

      [selLanc, selExt, selContaLanc, selLista].forEach(s => {
        if (s) s.innerHTML = "";
      });

      const addAll = s =>
        s && s.appendChild(new Option("Todas as Contas", "all"));

      addAll(selLanc);
      addAll(selExt);
      addAll(selContaLanc);
      addAll(selLista);

      STATE.contas.forEach(c => {
        const lbl = `${c.nome} (${fmt(c.saldo_atual ?? c.saldo_inicial)})`;

        if (selLanc) selLanc.appendChild(new Option(lbl, c.id));
        if (selExt) selExt.appendChild(new Option(c.nome, c.id));
        if (selContaLanc) selContaLanc.appendChild(new Option(c.nome, c.id));
        if (selLista) selLista.appendChild(new Option(c.nome, c.id));
      });

      // categorias
      const catSelect = $(IDS.categoriaLanc);
      if (catSelect) {
        catSelect.innerHTML = "";
        catSelect.appendChild(new Option("Sem categoria", ""));
        STATE.categorias.forEach(c =>
          catSelect.appendChild(new Option(c.nome, c.id))
        );
      }

      UI.renderCategoriasList();
    },

    /* ------------------------------------------------------------
       Render categorias
    ------------------------------------------------------------ */
    renderCategoriasList() {
      const ul = $(IDS.listaCategorias);
      if (!ul) return;

      ul.innerHTML = "";
      STATE.categorias.forEach(c => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";

        const t = document.createElement("span");
        t.textContent = c.nome;

        const b = document.createElement("button");
        b.textContent = "Excluir";
        b.onclick = async () => {
          if (!confirm("Excluir categoria?")) return;
          await supabase.from("categorias").delete().eq("id", c.id);
          await supabase
            .from("receitas")
            .update({ categoria_id: null })
            .eq("categoria_id", c.id);
          await supabase
            .from("despesas")
            .update({ categoria_id: null })
            .eq("categoria_id", c.id);
          await App.reloadContasCategorias();
        };

        li.appendChild(t);
        li.appendChild(b);
        ul.appendChild(li);
      });
    },

    /* ------------------------------------------------------------
       Render lançamentos
    ------------------------------------------------------------ */
    renderLancamentos({ receitas, despesas }) {
      const ulR = $(IDS.listReceitas);
      const ulD = $(IDS.listDespesas);
      if (ulR) ulR.innerHTML = "";
      if (ulD) ulD.innerHTML = "";

      let TR = 0,
        TD = 0;

      receitas.forEach(r => {
        TR += Number(r.valor);
        if (ulR) ulR.appendChild(UI._linhaLanc(r, "receita"));
      });

      despesas.forEach(d => {
        TD += Number(d.valor);
        if (ulD) ulD.appendChild(UI._linhaLanc(d, "despesa"));
      });

      $(IDS.totalReceitas).textContent = fmt(TR);
      $(IDS.totalDespesas).textContent = fmt(TD);
    },

    /* ------------------------------------------------------------
       Constrói item da lista de lançamentos
    ------------------------------------------------------------ */
    _linhaLanc(item, tipo) {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";

      const l = document.createElement("div");
      l.textContent = `${fmtDate(item.data)} — ${item.descricao} — ${fmt(
        item.valor
      )}`;

      const r = document.createElement("div");

      const btnE = document.createElement("button");
      btnE.textContent = "Editar";
      btnE.onclick = () => startEdit(tipo, item);

      const btnX = document.createElement("button");
      btnX.textContent = "Excluir";
      btnX.onclick = async () => {
        if (!confirm("Excluir?")) return;
        await LancService.delete({ tipo, id: item.id });
        await App.refreshLancamentos();
      };

      r.appendChild(btnE);
      r.appendChild(btnX);

      if (!item.baixado) {
        const btnB = document.createElement("button");
        btnB.textContent = "Baixar";
        btnB.onclick = () => baixarLancamento({ tipo, item });
        r.appendChild(btnB);
      }

      li.appendChild(l);
      li.appendChild(r);
      return li;
    }
  };

  /* ============================================================
     BAIXA
  ============================================================ */
  async function baixarLancamento({ tipo, item }) {
    const conta_id = $(IDS.selectContaLanc).value;
    if (!conta_id || conta_id === "all")
      return alert("Selecione a conta para baixar.");

    const dataBaixa = today();
    const tabela = tipo === "receita" ? "receitas" : "despesas";

    await supabase
      .from(tabela)
      .update({ baixado: true, data_baixa: dataBaixa, conta_id })
      .eq("id", item.id);

    await supabase.from("movimentacoes").insert([
      {
        id: uuid(),
        user_id: STATE.user.id,
        conta_id,
        descricao: item.descricao,
        tipo: tipo === "receita" ? "credito" : "debito",
        valor: item.valor,
        data: dataBaixa,
        lancamento_id: item.id
      }
    ]);

    await App.refreshLancamentos();
    await App.renderExtrato();
  }

  async function cancelarBaixaMovimentacao(mov) {
    if (!confirm("Cancelar baixa?")) return;

    const tabela =
      mov.tipo === "credito" ? "receitas" : "despesas";

    await supabase
      .from("movimentacoes")
      .delete()
      .eq("id", mov.id);

    await supabase
      .from(tabela)
      .update({ baixado: false, data_baixa: null })
      .eq("id", mov.lancamento_id);

    await App.refreshLancamentos();
    await App.renderExtrato();
  }

  /* ============================================================
     EDIÇÃO DE LANÇAMENTO
  ============================================================ */
  function startEdit(tipo, item) {
    $(IDS.tipoLanc).value = tipo;
    $(IDS.descLanc).value = item.descricao;
    $(IDS.valorLanc).value = item.valor;
    $(IDS.dataLanc).value = item.data;
    $(IDS.selectContaLanc).value = item.conta_id || "all";
    $(IDS.categoriaLanc).value = item.categoria_id || "";

    $(IDS.btnAddLanc).textContent = "Salvar";
    $(IDS.btnAddLanc).dataset.editing = "true";
    $(IDS.btnAddLanc).dataset.editId = item.id;

    $(IDS.btnCancelEdit).classList.remove("hidden");
  }

  /* ============================================================
     GRÁFICOS
  ============================================================ */
  async function renderRecPorCategoria(inicio, fim) {
    const { data } = await supabase
      .from("receitas")
      .select("*")
      .eq("user_id", STATE.user.id)
      .gte("data", inicio)
      .lte("data", fim);

    const grupos = {};
    (data || []).forEach(r => {
      const nome =
        STATE.categorias.find(c => c.id === r.categoria_id)?.nome ||
        "Sem categoria";
      grupos[nome] = (grupos[nome] || 0) + Number(r.valor);
    });

    const ctx = $(IDS.chartRecCat);
    if (!ctx) return;

    if (STATE.charts.recCat) STATE.charts.recCat.destroy();

    STATE.charts.recCat = new Chart(ctx, {
      type: "bar",
      data: { labels: Object.keys(grupos), datasets: [{ label: "Receitas", data: Object.values(grupos) }] },
      options: { responsive: true }
    });
  }

  async function renderDesPorCategoria(inicio, fim) {
    const { data } = await supabase
      .from("despesas")
      .select("*")
      .eq("user_id", STATE.user.id)
      .gte("data", inicio)
      .lte("data", fim);

    const grupos = {};
    (data || []).forEach(d => {
      const nome =
        STATE.categorias.find(c => c.id === d.categoria_id)?.nome ||
        "Sem categoria";
      grupos[nome] = (grupos[nome] || 0) + Number(d.valor);
    });

    const ctx = $(IDS.chartDesCat);
    if (!ctx) return;

    if (STATE.charts.desCat) STATE.charts.desCat.destroy();

    STATE.charts.desCat = new Chart(ctx, {
      type: "bar",
      data: { labels: Object.keys(grupos), datasets: [{ label: "Despesas", data: Object.values(grupos) }] },
      options: { responsive: true }
    });
  }

  async function renderResumo(inicio, fim) {
    const r = await supabase
      .from("receitas")
      .select("*")
      .eq("user_id", STATE.user.id)
      .gte("data", inicio)
      .lte("data", fim);

    const d = await supabase
      .from("despesas")
      .select("*")
      .eq("user_id", STATE.user.id)
      .gte("data", inicio)
      .lte("data", fim);

    const totalR = (r.data || []).reduce((s, x) => s + Number(x.valor), 0);
    const totalD = (d.data || []).reduce((s, x) => s + Number(x.valor), 0);

    $(IDS.dashReceber).textContent = fmt(totalR);
    $(IDS.dashPagar).textContent = fmt(totalD);
    $(IDS.dashSaldo).textContent = fmt(totalR - totalD);

    const ctx = $(IDS.chartResumo);
    if (!ctx) return;

    if (STATE.charts.resumo) STATE.charts.resumo.destroy();

    STATE.charts.resumo = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Receitas", "Despesas"],
        datasets: [{ label: "Resumo", data: [totalR, totalD] }]
      },
      options: { responsive: true }
    });
  }

  /* ============================================================
     APP
  ============================================================ */
  const App = {
    async reloadContasCategorias() {
      await Promise.all([ContasService.load(), CategoriasService.load()]);
      await UI.populateContasCategorias();
    },

    async init() {
      UI.init();
      await this.reloadContasCategorias();
      this.showScreen("dashboard");
      this.subscribeRealtime();
      await this.refreshLancamentos();
      await this.loadDashboard();
    },

    showScreen(scr) {
      $all(IDS.screens).forEach(s => s.classList.add("hidden"));
      const el = document.querySelector(`[data-screen="${scr}"]`);
      if (el) el.classList.remove("hidden");

      // atualizar active menu
      $all(IDS.menuBtns).forEach(b => {
        if (b.dataset.target === scr) b.classList.add("active");
        else b.classList.remove("active");
      });

      if (scr === "lanc") this.refreshLancamentos();
      if (scr === "contas") UI.populateContasCategorias();
    },

    subscribeRealtime() {
      supabase
        .channel("receitas")
        .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, () => this.refreshLancamentos())
        .subscribe();

      supabase
        .channel("despesas")
        .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, () => this.refreshLancamentos())
        .subscribe();

      supabase
        .channel("mov")
        .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => this.renderExtrato())
        .subscribe();
    },

    async loadDashboard() {
      const now = new Date();
      const ano = now.getFullYear();
      const mes = now.getMonth() + 1;
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fim = `${ano}-${String(mes).padStart(2, "0")}-${new Date(ano, mes, 0).getDate()}`;

      await renderResumo(inicio, fim);
      await renderRecPorCategoria(inicio, fim);
      await renderDesPorCategoria(inicio, fim);
    },

    async refreshLancamentos() {
      const conta_id = $(IDS.selectContas)?.value || "all";
      const periodo = $(IDS.periodoLanc)?.value || "mes_atual";

      const now = new Date();
      let inicio, fim;

      if (periodo === "mes_atual") {
        inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate()}`;
      } else if (periodo === "personalizado") {
        inicio = $(IDS.dataInicioLanc).value;
        fim = $(IDS.dataFimLanc).value;
      } else {
        // últimos 30 dias etc
        const past = new Date(now.getTime() - 30 * 86400000);
        inicio = past.toISOString().slice(0, 10);
        fim = today();
      }

      const [r, d] = await Promise.all([
        LancService.fetch({ tipo: "receita", conta_id, inicio, fim }),
        LancService.fetch({ tipo: "despesa", conta_id, inicio, fim })
      ]);

      STATE.receitas = r;
      STATE.despesas = d;

      UI.renderLancamentos({ receitas: r, despesas: d });

      if (conta_id === "all") $(IDS.saldoAtual).textContent = "—";
      else {
        const { data } = await supabase
          .from("contas_bancarias")
          .select("saldo_atual")
          .eq("id", conta_id)
          .maybeSingle();
        $(IDS.saldoAtual).textContent = fmt(data?.saldo_atual || 0);
      }
    },

    async renderExtrato() {
      const conta_id = $(IDS.selectExtrato)?.value || "all";
      const pe = $(IDS.periodoExtrato)?.value || "mes_atual";

      let inicio, fim;
      const now = new Date();

      if (pe === "mes_atual") {
        inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate()}`;
      } else if (pe === "personalizado") {
        inicio = $(IDS.dataInicioExtrato).value;
        fim = $(IDS.dataFimExtrato).value;
      } else {
        const past = new Date(now.getTime() - 30 * 86400000);
        inicio = past.toISOString().slice(0, 10);
        fim = today();
      }

      const movs = await ExtratoService.fetch({ conta_id, inicio, fim });

      const tbody = $(IDS.tableExtrato)?.querySelector("tbody");
      if (!tbody) return;
      tbody.innerHTML = "";

      movs.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fmtDate(m.data)}</td>
          <td>${m.descricao}</td>
          <td>${m.tipo === "credito" ? "Crédito" : "Débito"}</td>
          <td>${fmt(m.valor)}</td>
          <td><button>Cancelar Baixa</button></td>
        `;
        tr.querySelector("button").onclick = () => cancelarBaixaMovimentacao(m);
        tbody.appendChild(tr);
      });
    }
  };

  /* ============================================================
     BOOTSTRAP
  ============================================================ */
  (async () => {
    const ok = await ensureSession();
    if (!ok) return (window.location = "login.html");

    await Promise.all([CategoriasService.load(), ContasService.load()]);
    await UI.populateContasCategorias();
    await App.init();

    console.log("APP.JS FINAL CARREGADO ✔");
  })();
})();
