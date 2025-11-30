// =========================
// Finance App - app.js (FINAL CORRIGIDO)
// Movimentações + Extrato misto + Cancelar Baixa
// Compatível com UUID (Supabase)
// =========================

// -------------------------
// UTILITÁRIOS
// -------------------------
function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}
function formatReal(valor) {
  if (typeof valor !== "number") valor = Number(valor || 0);
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// -------------------------
// SESSÃO E VARIÁVEIS
// -------------------------
let currentUser = null;
let editing = { type: null, id: null };

// -------------------------
// ELEMENTOS DO DOM
// -------------------------
const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const selectContaLanc = document.getElementById("select-conta-lanc");

const saldoAtualEl = document.getElementById("saldo-atual");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

const listReceitas = document.getElementById("list-receitas");
const listDespesas = document.getElementById("list-despesas");

const tabCadastro = document.getElementById("tab-cadastro");
const tabExtrato = document.getElementById("tab-extrato");

const selectExtrato = document.getElementById("select-contas-extrato");
const periodoExtrato = document.getElementById("periodo-extrato");
const dataInicio = document.getElementById("data-inicio");
const dataFim = document.getElementById("data-fim");
const btnFiltrarExtrato = document.getElementById("btn-filtrar-extrato");

let tableExtrato = null;

// CORRIGIDO: só carrega table-extrato depois do HTML carregar
document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("table-extrato");
  if (table) tableExtrato = table.querySelector("tbody");
});

// Dashboard
let chartDashboard = null;

// -------------------------
// AUTENTICAÇÃO
// -------------------------
supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "login.html";
  } else {
    currentUser = data.session.user;
    const userEmailEl = document.getElementById("user-email");
    if (userEmailEl) userEmailEl.textContent = currentUser.email;
    initApp();
  }
});

const btnLogout = document.getElementById("btn-logout");
if (btnLogout) btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// -------------------------
// INICIALIZAÇÃO
// -------------------------
async function initApp() {
  await loadContas();
  subscribeToChanges();
}

// -------------------------
// CONTAS
// -------------------------
async function loadContas() {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at");

  if (error) {
    console.error(error);
    return;
  }

  selectContas.innerHTML = "";
  data.forEach((conta) => {
    const opt = document.createElement("option");
    const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
    opt.value = conta.id;
    opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
    selectContas.appendChild(opt);
  });

  if (data.length > 0) {
    if (!selectContas.value) selectContas.value = data[0].id;
    await refreshMovements();
  }
}

btnAddConta.onclick = async () => {
  const nome = contaNome.value.trim();
  if (!nome) return alert("Informe o nome da conta!");

  const saldo = parseFloat(contaSaldo.value || 0);

  const { error } = await supabase.from("contas_bancarias").insert([
    { nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id },
  ]);

  if (error) return alert(error.message);

  contaNome.value = "";
  contaSaldo.value = "";

  await loadContas();
};

// -------------------------
// POPULAR SELECTS
// -------------------------
async function loadContasExtra() {
  const { data } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at");

  selectExtrato.innerHTML = "";
  selectContaLanc.innerHTML = "";

  data.forEach((c) => {
    const o1 = document.createElement("option");
    o1.value = c.id;
    o1.textContent = c.nome;

    const o2 = o1.cloneNode(true);

    selectExtrato.appendChild(o1);
    selectContaLanc.appendChild(o2);
  });

  if (!selectExtrato.value && data.length > 0) selectExtrato.value = data[0].id;
  if (!selectContaLanc.value && data.length > 0) selectContaLanc.value = data[0].id;
}

const originalLoadContas = loadContas;
loadContas = async function () {
  await originalLoadContas();
  await loadContasExtra();
};

// -------------------------
// LANÇAMENTOS
// -------------------------
btnAddLanc.onclick = async () => {
  const valor = parseFloat(valorLanc.value);
  const desc = descLanc.value.trim();
  const data = dataLanc.value;
  const conta_id = selectContaLanc.value;
  const tipo = tipoLanc.value;

  if (!valor || !desc || !data) return alert("Preencha todos os campos!");

  if (editing.type) {
    const table = editing.type === "receita" ? "receitas" : "despesas";

    await supabase
      .from(table)
      .update({ descricao: desc, valor, data, conta_id })
      .eq("id", editing.id);

    stopEdit();
    refreshMovements();
    return;
  }

  const payload = {
    descricao: desc,
    valor,
    data,
    conta_id,
    user_id: currentUser.id,
    baixado: false,
  };

  if (tipo === "receita") await supabase.from("receitas").insert([payload]);
  else await supabase.from("despesas").insert([payload]);

  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";

  refreshMovements();
};

btnCancelEdit.onclick = () => stopEdit();

function stopEdit() {
  editing = { type: null, id: null };
  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";
  btnAddLanc.textContent = "Adicionar";
  btnCancelEdit.classList.add("hidden");
}

// -------------------------
// EXCLUIR
// -------------------------
async function deleteItem(type, id) {
  if (!confirm("Deseja excluir este lançamento?")) return;
  const table = type === "receita" ? "receitas" : "despesas";
  await supabase.from(table).delete().eq("id", id);
  refreshMovements();
}

// -------------------------
// LISTAGEM
// -------------------------
async function refreshMovements() {
  const conta_id = selectContas.value;

  const [r, d] = await Promise.all([
    supabase
      .from("receitas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data"),
    supabase
      .from("despesas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data"),
  ]);

  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  let totalR = 0,
    totalD = 0;

  r.data.forEach((item) => {
    totalR += Number(item.valor || 0);
    listReceitas.appendChild(createLancamentoItem(item, "receita"));
  });

  d.data.forEach((item) => {
    totalD += Number(item.valor || 0);
    listDespesas.appendChild(createLancamentoItem(item, "despesa"));
  });

  totalReceitasEl.textContent = formatReal(totalR);
  totalDespesasEl.textContent = formatReal(totalD);

  const opt = selectContas.selectedOptions[0];
  const saldoInicial = opt
    ? parseFloat(
        opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(",", ".")
      )
    : 0;

  saldoAtualEl.textContent = formatReal(saldoInicial + totalR - totalD);
}

function createLancamentoItem(item, type) {
  const li = document.createElement("li");
  li.style.fontFamily = `"Courier New", monospace`;
  li.style.fontWeight = "bold";
  li.style.marginBottom = "10px";
  li.style.color = type === "receita" ? "green" : "red";

  const textSpan = document.createElement("span");
  textSpan.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  if (item.baixado) {
    li.style.opacity = "0.6";
    const tag = document.createElement("small");
    tag.textContent = " (baixado)";
    textSpan.appendChild(tag);
  }

  li.appendChild(textSpan);

  const actions = document.createElement("span");
  actions.style.float = "right";

  if (!item.baixado) {
    const baixarBtn = document.createElement("button");
    baixarBtn.textContent = "Baixar";
    baixarBtn.style.marginLeft = "5px";
    baixarBtn.onclick = () => baixarLancamento(type, item);
    actions.appendChild(baixarBtn);
  }

  const editBtn = document.createElement("button");
  editBtn.textContent = "Editar";
  editBtn.style.marginLeft = "5px";
  editBtn.onclick = () => startEdit(type, item);

  const delBtn = document.createElement("button");
  delBtn.textContent = "Excluir";
  delBtn.style.marginLeft = "5px";
  delBtn.onclick = () => deleteItem(type, item.id);

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  li.appendChild(actions);

  return li;
}

// -------------------------
// BAIXAR LANÇAMENTO
// -------------------------
async function baixarLancamento(type, item) {
  try {
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at");

    let msg = "Escolha a conta para baixar:\n";
    contas.forEach((c, i) => {
      msg += `${i + 1}) ${c.nome} — ${formatReal(c.saldo_atual)} — id:${c.id}\n`;
    });
    msg += "\nDigite o número ou deixe vazio para usar a conta original:";

    const resposta = prompt(msg, "");

    let contaEscolhidaId = item.conta_id;

    if (resposta && resposta.trim() !== "") {
      const num = Number(resposta);
      if (!isNaN(num) && num >= 1 && num <= contas.length)
        contaEscolhidaId = contas[num - 1].id;
    }

    const { data: conta } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("id", contaEscolhidaId)
      .single();

    let novoSaldo = Number(conta.saldo_atual);

    if (type === "receita") novoSaldo += Number(item.valor);
    else novoSaldo -= Number(item.valor);

    await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: novoSaldo })
      .eq("id", contaEscolhidaId);

    const table = type === "receita" ? "receitas" : "despesas";

    await supabase
      .from(table)
      .update({ baixado: true, data_baixa: new Date().toISOString().slice(0, 10) })
      .eq("id", item.id);

    const mov = {
      user_id: currentUser.id,
      conta_id: contaEscolhidaId,
      tipo: type === "receita" ? "credito" : "debito",
      valor: item.valor,
      descricao: `Baixa de "${item.descricao}"`,
      data: new Date().toISOString().slice(0, 10),
      lancamento_id: item.id,
    };

    await supabase.from("movimentacoes").insert([mov]);

    alert("Lançamento baixado!");
    refreshMovements();
    renderExtrato();
  } catch (e) {
    console.error(e);
    alert("Erro ao baixar: " + e.message);
  }
}

// -------------------------
// CANCELAR BAIXA
// -------------------------
async function cancelarBaixaMovimentacao(mov) {
  try {
    if (!confirm("Deseja cancelar esta baixa?")) return;

    const { data: conta } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("id", mov.conta_id)
      .single();

    let novoSaldo = Number(conta.saldo_atual);

    if (mov.tipo === "credito") novoSaldo -= Number(mov.valor);
    else novoSaldo += Number(mov.valor);

    await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: novoSaldo })
      .eq("id", mov.conta_id);

    await supabase.from("movimentacoes").delete().eq("id", mov.id);

    await supabase
      .from("receitas")
      .update({ baixado: false, data_baixa: null })
      .eq("id", mov.lancamento_id);

    await supabase
      .from("despesas")
      .update({ baixado: false, data_baixa: null })
      .eq("id", mov.lancamento_id);

    alert("Baixa cancelada!");
    refreshMovements();
    renderExtrato();
  } catch (e) {
    console.error(e);
    alert("Erro ao cancelar baixa: " + e.message);
  }
}

// -------------------------
// REALTIME
// -------------------------
function subscribeToChanges() {
  try {
    supabase
      .channel("rt_movimentacoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimentacoes" },
        () => renderExtrato()
      )
      .subscribe();
  } catch (e) {
    console.error("Erro realtime:", e);
  }
}

// -------------------------
// SISTEMA DE TELAS
// -------------------------
function showScreen(target) {
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  if (target === "dashboard") {
    telaDashboard.classList.remove("hidden");
    btnDash.classList.add("active");
    loadDashboard();
  } else if (target === "contas") {
    telaContas.classList.remove("hidden");
    btnContas.classList.add("active");
  } else if (target === "lanc") {
    telaLanc.classList.remove("hidden");
    btnLanc.classList.add("active");
  }
}

btnDash.onclick = () => showScreen("dashboard");
btnContas.onclick = () => showScreen("contas");
btnLanc.onclick = () => showScreen("lanc");

// -------------------------
// ABAS INTERNAS
// -------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.onclick = () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");

    const tab = btn.dataset.tab;

    if (tab === "cadastro") {
      tabCadastro.classList.remove("hidden");
      tabExtrato.classList.add("hidden");
    } else {
      tabCadastro.classList.add("hidden");
      tabExtrato.classList.remove("hidden");
      renderExtrato();
    }
  };
});

// -------------------------
// EXTRATO
// -------------------------
btnFiltrarExtrato.onclick = () => renderExtrato();

async function renderExtrato() {
  try {
    if (!tableExtrato) return;

    const conta_id = selectExtrato.value;
    const now = new Date();

    let inicio, fim;

    const periodo = periodoExtrato.value;
    if (periodo === "mes_atual") {
      inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-01`;
      const last = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(last).padStart(2, "0")}`;
    } else if (periodo === "ultimos_30") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      inicio = `${past.getFullYear()}-${String(
        past.getMonth() + 1
      ).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(now.getDate()).padStart(2, "0")}`;
    } else if (periodo === "personalizado") {
      inicio = dataInicio.value;
      fim = dataFim.value;
    } else {
      inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-01`;
      const last = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(last).padStart(2, "0")}`;
    }

    const [recRes, despRes, movRes] = await Promise.all([
      supabase
        .from("receitas")
        .select("*")
        .eq("conta_id", conta_id)
        .gte("data", inicio)
        .lte("data", fim),

      supabase
        .from("despesas")
        .select("*")
        .eq("conta_id", conta_id)
        .gte("data", inicio)
        .lte("data", fim),

      supabase
        .from("movimentacoes")
        .select("*")
        .eq("conta_id", conta_id)
        .gte("data", inicio)
        .lte("data", fim),
    ]);

    const unified = [];

    (recRes.data || []).forEach((r) =>
      unified.push({
        tipo: "receita",
        data: r.data,
        descricao: r.descricao,
        valor: Number(r.valor),
      })
    );

    (despRes.data || []).forEach((d) =>
      unified.push({
        tipo: "despesa",
        data: d.data,
        descricao: d.descricao,
        valor: Number(d.valor),
      })
    );

    (movRes.data || []).forEach((m) =>
      unified.push({
        tipo: "mov",
        data: m.data,
        descricao: m.descricao,
        valor: Number(m.valor),
        mov: m,
      })
    );

    unified.sort(
      (a, b) =>
        new Date(a.data + "T00:00:00") - new Date(b.data + "T00:00:00")
    );

    tableExtrato.innerHTML = "";

    unified.forEach((row) => {
      const tr = document.createElement("tr");
      const tdAcoes = document.createElement("td");

      if (row.tipo === "receita") {
        tr.innerHTML = `<td>${formatDate(row.data)}</td>
        <td>${row.descricao}</td>
        <td>Receita</td>
        <td>${formatReal(row.valor)}</td>`;
      } else if (row.tipo === "despesa") {
        tr.innerHTML = `<td>${formatDate(row.data)}</td>
        <td>${row.descricao}</td>
        <td>Despesa</td>
        <td>${formatReal(row.valor)}</td>`;
      } else {
        tr.innerHTML = `<td>${formatDate(row.data)}</td>
        <td>${row.descricao}</td>
        <td>Movimentação</td>
        <td>${formatReal(row.valor)}</td>`;

        const btn = document.createElement("button");
        btn.textContent = "Cancelar Baixa";
        btn.onclick = () => cancelarBaixaMovimentacao(row.mov);
        tdAcoes.appendChild(btn);
      }

      tr.appendChild(tdAcoes);
      tableExtrato.appendChild(tr);
    });

    const { data: conta } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("id", conta_id)
      .single();

    saldoAtualContaExtrato.textContent = formatReal(
      conta?.saldo_atual || 0
    );
  } catch (e) {
    console.error("Erro no extrato:", e);
  }
}
