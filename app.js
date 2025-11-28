// =========================
// Finance App - app.js COMPLETO
// Dashboard, Extrato (tabela), Recorrência, Contas, Realtime
// =========================

// -------------------------
// Utilitários
// -------------------------
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatReal(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function genId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// -------------------------
// Sessão / Estado Global
// -------------------------
let currentUser = null;
let editing = { type: null, id: null };
let sortState = { key: "data", dir: "desc" };
let dashboardChart = null;

// -------------------------
// Seletores da página
// -------------------------
const userEmailEl = document.getElementById("user-email");
const btnLogout = document.getElementById("btn-logout");

const menuDashboardBtn = document.getElementById("menu-dashboard");
const menuContasBtn = document.getElementById("menu-contas");
const menuLancamentosBtn = document.getElementById("menu-lancamentos");

const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLancamentos = document.getElementById("tela-lancamentos");

// Contas
const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

// Extrato
const selectContasExtrato = document.getElementById("select-contas-extrato");
const periodoExtrato = document.getElementById("periodo-extrato");
const dataInicio = document.getElementById("data-inicio");
const dataFim = document.getElementById("data-fim");
const btnFiltrarExtrato = document.getElementById("btn-filtrar-extrato");

const tableBody = document.querySelector("#table-extrato tbody");
const totalValorEl = document.getElementById("total-valor");
const totalReceitasExtrato = document.getElementById("total-receitas-extrato");
const totalDespesasExtrato = document.getElementById("total-despesas-extrato");
const saldoPeriodoExtrato = document.getElementById("saldo-periodo-extrato");
const saldoAtualContaExtrato = document.getElementById("saldo-atual-conta-extrato");

// Lançamentos
const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const selectContaLanc = document.getElementById("select-conta-lanc");

const recTipo = document.getElementById("recorrencia-tipo");
const recParcelas = document.getElementById("recorrencia-parcelas");

const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// Listas
const listReceitas = document.getElementById("list-receitas");
const listDespesas = document.getElementById("list-despesas");

// Dashboard
const chartCanvas = document.getElementById("chart-dashboard");


// -------------------------
// LOGIN / SESSÃO SUPABASE
// -------------------------
supabase.auth.getSession().then(({ data }) => {
  if (!data?.session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = data.session.user;
  if (userEmailEl) userEmailEl.textContent = currentUser.email;
  initApp();
}).catch(err => {
  console.error("Erro ao obter sessão:", err);
  window.location.href = "login.html";
});

if (btnLogout) {
  btnLogout.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  };
}

// -------------------------
// INICIALIZAÇÃO PRINCIPAL
// -------------------------
async function initApp() {

  // MENU SUPERIOR
  if (menuDashboardBtn) menuDashboardBtn.onclick = () => showScreen("dashboard");
  if (menuContasBtn) menuContasBtn.onclick = () => showScreen("contas");
  if (menuLancamentosBtn) menuLancamentosBtn.onclick = () => showScreen("lancamentos");

  // ABA EXTRATO
  if (periodoExtrato) periodoExtrato.onchange = onPeriodoChange;
  if (btnFiltrarExtrato) btnFiltrarExtrato.onclick = () => loadExtrato();
  if (selectContasExtrato) selectContasExtrato.onchange = () => loadExtrato();

  // Ordenação por clique nos headers
  document.querySelectorAll("#table-extrato thead th[data-key]").forEach(th => {
    th.onclick = () => toggleSort(th.getAttribute("data-key"));
  });

  // Adicionar conta
  if (btnAddConta) btnAddConta.onclick = addConta;

  // Adicionar lançamento
  if (btnAddLanc) btnAddLanc.onclick = addLancamento;
  if (btnCancelEdit) btnCancelEdit.onclick = stopEdit;

  await loadContas();
  subscribeToChanges();

  showScreen("contas");
  updateDashboard();
}

// -------------------------
// TROCA DE TELAS
// -------------------------
function showScreen(name) {

  // Oculta tudo
  telaDashboard?.classList.add("hidden");
  telaContas?.classList.add("hidden");
  telaLancamentos?.classList.add("hidden");

  // Remove 'active'
  menuDashboardBtn?.classList.remove("active");
  menuContasBtn?.classList.remove("active");
  menuLancamentosBtn?.classList.remove("active");

  if (name === "dashboard") {
    telaDashboard.classList.remove("hidden");
    menuDashboardBtn.classList.add("active");
    updateDashboard();
  }

  else if (name === "contas") {
    telaContas.classList.remove("hidden");
    menuContasBtn.classList.add("active");
  }

  else if (name === "lancamentos") {
    telaLancamentos.classList.remove("hidden");
    menuLancamentosBtn.classList.add("active");
    refreshMovements();
  }
}

// -------------------------
// CARREGAR CONTAS
// -------------------------
async function loadContas() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  // LIMPA SELECTS
  selectContas.innerHTML = "";
  selectContasExtrato.innerHTML = "";
  selectContaLanc.innerHTML = "";

  if (!data || data.length === 0) return;

  data.forEach(conta => {
    const text = `${conta.nome} (R$ ${Number(conta.saldo_inicial).toFixed(2)})`;

    let op1 = document.createElement("option");
    op1.value = conta.id;
    op1.textContent = text;

    let op2 = op1.cloneNode(true);
    let op3 = op1.cloneNode(true);

    selectContas.appendChild(op1);
    selectContasExtrato.appendChild(op2);
    selectContaLanc.appendChild(op3);
  });

  // SELECIONA PRIMEIRA CONTA
  if (selectContas.options.length > 0) {
    selectContas.value = selectContas.options[0].value;
  }
  if (selectContasExtrato.options.length > 0) {
    selectContasExtrato.value = selectContasExtrato.options[0].value;
  }
  if (selectContaLanc.options.length > 0) {
    selectContaLanc.value = selectContaLanc.options[0].value;
  }

  loadExtrato();
  refreshMovements();
}

// -------------------------
// ADICIONAR CONTA
// -------------------------
async function addConta() {
  const nome = contaNome.value.trim();
  const saldo = parseFloat(contaSaldo.value || 0);

  if (!nome) return alert("Informe o nome da conta.");

  const { error } = await supabase.from("contas_bancarias").insert([{
    nome,
    saldo_inicial: saldo,
    saldo_atual: saldo,
    user_id: currentUser.id
  }]);

  if (error) return alert(error.message);

  contaNome.value = "";
  contaSaldo.value = "";
  loadContas();
}

// -------------------------
// EXTRATO: LÓGICA DE PERÍODO
// -------------------------
function onPeriodoChange() {
  const v = periodoExtrato.value;

  if (v === "personalizado") {
    dataInicio.classList.remove("hidden");
    dataFim.classList.remove("hidden");
  } else {
    dataInicio.classList.add("hidden");
    dataFim.classList.add("hidden");
  }
}

function getRangeFromPeriodo() {
  const today = new Date();
  const tipo = periodoExtrato.value;

  let start, end;

  if (tipo === "mes_atual") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }
  else if (tipo === "mes_anterior") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  }
  else if (tipo === "ultimos_30") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    end = today;
  }
  else if (tipo === "personalizado") {
    if (!dataInicio.value || !dataFim.value) {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      start = new Date(dataInicio.value + "T00:00:00");
      end = new Date(dataFim.value + "T00:00:00");
    }
  }
  else {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  return { start, end };
}

// -------------------------
// CARREGAR EXTRATO
// -------------------------
async function loadExtrato() {
  if (!currentUser) return;
  const conta_id = selectContasExtrato.value;
  if (!conta_id) return;

  const { start, end } = getRangeFromPeriodo();
  const startStr = formatISODate(start);
  const endStr = formatISODate(end);

  const [rReceitas, rDespesas] = await Promise.all([
    supabase.from("receitas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .gte("data", startStr)
      .lte("data", endStr),

    supabase.from("despesas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .gte("data", startStr)
      .lte("data", endStr)
  ]);

  const receitas = rReceitas.data || [];
  const despesas = rDespesas.data || [];

  let items = [];

  receitas.forEach(r => items.push({ ...r, tipo: "receita" }));
  despesas.forEach(d => items.push({ ...d, tipo: "despesa" }));

  // ORDENAÇÃO DA TABELA
  items.sort((a, b) => {
    if (sortState.key === "data") {
      const da = new Date(a.data), db = new Date(b.data);
      return sortState.dir === "asc" ? da - db : db - da;
    }
    if (sortState.key === "valor") {
      return sortState.dir === "asc"
        ? a.valor - b.valor
        : b.valor - a.valor;
    }
    const va = String(a[sortState.key] || "").toLowerCase();
    const vb = String(b[sortState.key] || "").toLowerCase();
    if (va < vb) return sortState.dir === "asc" ? -1 : 1;
    if (va > vb) return sortState.dir === "asc" ? 1 : -1;
    return 0;
  });

  renderExtratoTable(items);

  const totalR = receitas.reduce((s, it) => s + Number(it.valor || 0), 0);
  const totalD = despesas.reduce((s, it) => s + Number(it.valor || 0), 0);

  totalReceitasExtrato.textContent = formatReal(totalR);
  totalDespesasExtrato.textContent = formatReal(totalD);
  saldoPeriodoExtrato.textContent = formatReal(totalR - totalD);

  const { data: contasData } = await supabase
    .from("contas_bancarias")
    .select("saldo_inicial")
    .eq("id", conta_id)
    .eq("user_id", currentUser.id)
    .limit(1);

  const saldoInicial = contasData?.[0]?.saldo_inicial || 0;

  saldoAtualContaExtrato.textContent = formatReal(
    saldoInicial + totalR - totalD
  );
}

// -------------------------
// RENDERIZAR TABELA DO EXTRATO
// -------------------------
function renderExtratoTable(items) {
  tableBody.innerHTML = "";
  let totalCalc = 0;

  items.forEach(item => {
    const tr = document.createElement("tr");

    const tdData = document.createElement("td");
    tdData.textContent = formatDate(item.data);

    const tdDesc = document.createElement("td");
    tdDesc.textContent = item.descricao || "";

    const tdTipo = document.createElement("td");
    tdTipo.textContent = item.tipo === "receita" ? "Receita" : "Despesa";
    tdTipo.className = item.tipo === "receita" ? "tipo-receita" : "tipo-despesa";

    const tdValor = document.createElement("td");
    tdValor.textContent = formatReal(item.valor);
    tdValor.style.fontWeight = "bold";
    tdValor.style.color = item.tipo === "despesa" ? "red" : "green";

    const tdActions = document.createElement("td");
    tdActions.className = "actions";

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Editar";
    btnEdit.onclick = () => startEditFromExtrato(item);

    const btnDel = document.createElement("button");
    btnDel.textContent = "Excluir";
    btnDel.onclick = () => deleteFromExtrato(item);

    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdData);
    tr.appendChild(tdDesc);
    tr.appendChild(tdTipo);
    tr.appendChild(tdValor);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);

    totalCalc += item.tipo === "despesa"
      ? -Number(item.valor || 0)
      : Number(item.valor || 0);
  });

  totalValorEl.innerHTML = formatReal(totalCalc);
}

// -------------------------
// ALTERAR ORDEM DA TABELA
// -------------------------
function toggleSort(key) {
  if (sortState.key === key) {
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState.key = key;
    sortState.dir = "desc";
  }
  loadExtrato();
}

// -------------------------
// ADICIONAR LANÇAMENTO (inclui recorrência)
// -------------------------
async function addLancamento() {
  if (!currentUser) return;

  const valor = Number(valorLanc.value);
  const descricao = (descLanc.value || "").trim();
  const data = dataLanc.value;
  const tipo = tipoLanc.value;
  const conta_id = selectContaLanc.value;

  const recorrencia = recTipo.value;
  const parcelas = Math.max(1, parseInt(recParcelas.value || "1"));

  if (!descricao || !valor || !data || !conta_id) {
    return alert("Preencha todos os campos.");
  }

  // -------------------------
  // EDITAR lançamento único
  // -------------------------
  if (editing.type && editing.id) {
    const table = editing.type === "receita" ? "receitas" : "despesas";

    const { error } = await supabase
      .from(table)
      .update({ descricao, valor, data, conta_id })
      .eq("id", editing.id)
      .eq("user_id", currentUser.id);

    if (error) return alert(error.message);

    stopEdit();
    refreshMovements();
    loadExtrato();
    return;
  }

  // -------------------------
  // RECORRÊNCIA
  // -------------------------
  const recGroup = (parcelas > 1 || recorrencia !== "none") ? genId() : null;
  const dates = generateRecurrenceDates(data, parcelas, recorrencia);

  const payloads = dates.map((dt, i) => {
    const p = parcelas > 1 ? ` [${i + 1}/${parcelas}]` : "";
    const tag = recGroup ? ` ||rec=${recGroup}` : "";

    return {
      descricao: descricao + p + tag,
      valor,
      data: dt,
      conta_id,
      user_id: currentUser.id
    };
  });

  const table = tipo === "receita" ? "receitas" : "despesas";

  const { error: insertError } = await supabase
    .from(table)
    .insert(payloads);

  if (insertError) return alert(insertError.message);

  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";
  recTipo.value = "none";
  recParcelas.value = 1;

  refreshMovements();
  loadExtrato();
  updateDashboard();
}

function generateRecurrenceDates(startDateStr, parcelas, tipo) {
  const arr = [];
  const start = new Date(startDateStr + "T00:00:00");

  for (let i = 0; i < parcelas; i++) {
    const d = new Date(start);

    if (tipo === "monthly") d.setMonth(d.getMonth() + i);
    else if (tipo === "fortnight") d.setDate(d.getDate() + i * 15);
    else if (tipo === "weekly") d.setDate(d.getDate() + i * 7);
    else if (tipo === "annual") d.setFullYear(d.getFullYear() + i);

    arr.push(formatISODate(d));
  }

  return arr;
}

// -------------------------
// RECORRÊNCIA – EXTRATO: editar/excluir
// -------------------------
function extractRecId(descricao) {
  const m = descricao?.match(/\\|\\|rec=([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function stripRecTag(desc) {
  if (!desc) return "";
  return desc
    .replace(/\\|\\|rec=[a-zA-Z0-9]+/, "")
    .replace(/\\s*\\[\\d+\\/\\d+\\]/, "")
    .trim();
}

function startEditFromExtrato(item) {
  showScreen("lancamentos");

  tipoLanc.value = item.tipo;
  valorLanc.value = item.valor;
  descLanc.value = stripRecTag(item.descricao);
  dataLanc.value = item.data;
  selectContaLanc.value = item.conta_id;

  editing.type = item.tipo;
  editing.id = item.id;

  btnAddLanc.textContent = "Salvar";
  btnCancelEdit.classList.remove("hidden");
}

async function deleteFromExtrato(item) {
  if (!item || !item.id) return;

  const recId = extractRecId(item.descricao);

  // -------------------------
  // Registro sem recorrência
  // -------------------------
  if (!recId) {
    if (!confirm("Excluir este lançamento?")) return;

    const table = item.tipo === "receita" ? "receitas" : "despesas";

    await supabase.from(table)
      .delete()
      .eq("id", item.id)
      .eq("user_id", currentUser.id);

    loadExtrato();
    refreshMovements();
    return;
  }

  // -------------------------
  // Registro recorrente — pedir escolha
  // -------------------------
  const choice = prompt(
    "Este lançamento faz parte de uma recorrência.\n" +
    "1 = Excluir apenas esta parcela\n" +
    "2 = Excluir esta e as posteriores"
  );

  const table = item.tipo === "receita" ? "receitas" : "despesas";

  if (choice === "1") {
    await supabase.from(table)
      .delete()
      .eq("id", item.id)
      .eq("user_id", currentUser.id);
  }

  else if (choice === "2") {
    await supabase.from(table)
      .delete()
      .like("descricao", `%||rec=${recId}%`)
      .gte("data", item.data)
      .eq("user_id", currentUser.id);
  }

  loadExtrato();
  refreshMovements();
}
// -------------------------
// PARAR EDIÇÃO
// -------------------------
function stopEdit() {
  editing.type = null;
  editing.id = null;

  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";

  btnAddLanc.textContent = "Adicionar";
  btnCancelEdit.classList.add("hidden");
}

// -------------------------
// ATUALIZAR LISTAS E TOTAIS (Tela Lançamentos)
// -------------------------
async function refreshMovements() {
  if (!currentUser) return;

  const conta_id = selectContas.value;
  if (!conta_id) return;

  const [rReceitas, rDespesas] = await Promise.all([
    supabase.from("receitas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data", { ascending: true }),

    supabase.from("despesas")
      .select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data", { ascending: true })
  ]);

  const receitas = rReceitas.data || [];
  const despesas = rDespesas.data || [];

  // LISTA RECEITAS
  listReceitas.innerHTML = "";
  receitas.forEach(it => {
    const li = document.createElement("li");
    li.style.color = "green";
    li.style.fontWeight = "bold";
    li.textContent = `${formatDate(it.data)} - ${it.descricao} - ${formatReal(it.valor)}`;
    listReceitas.appendChild(li);
  });

  // LISTA DESPESAS
  listDespesas.innerHTML = "";
  despesas.forEach(it => {
    const li = document.createElement("li");
    li.style.color = "red";
    li.style.fontWeight = "bold";
    li.textContent = `${formatDate(it.data)} - ${it.descricao} - ${formatReal(it.valor)}`;
    listDespesas.appendChild(li);
  });

  // TOTAIS
  const totalR = receitas.reduce((s, it) => s + Number(it.valor || 0), 0);
  const totalD = despesas.reduce((s, it) => s + Number(it.valor || 0), 0);

  document.getElementById("total-receitas").textContent = formatReal(totalR);
  document.getElementById("total-despesas").textContent = formatReal(totalD);

  // SALDO ATUAL
  try {
    const opt = selectContas.selectedOptions[0];
    const saldoInicial = parseFloat(
      opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(",", ".")
    );
    document.getElementById("saldo-atual").textContent =
      formatReal(saldoInicial + totalR - totalD);
  } catch {}

  updateDashboard();
}

// -------------------------
// DASHBOARD
// -------------------------
function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0)
  };
}

async function updateDashboard() {
  if (!currentUser) return;

  const today = new Date();
  const { start, end } = getMonthRange(today);

  const startStr = formatISODate(start);
  const endStr = formatISODate(end);
  const todayStr = formatISODate(today);

  document.getElementById("dash-period").textContent =
    `${formatDate(startStr)} — ${formatDate(endStr)}`;

  // Buscar valores
  const [rReceber, rPagar, rContas] = await Promise.all([
    supabase.from("receitas")
      .select("valor")
      .gte("data", todayStr)
      .lte("data", endStr)
      .eq("user_id", currentUser.id),

    supabase.from("despesas")
      .select("valor")
      .gte("data", todayStr)
      .lte("data", endStr)
      .eq("user_id", currentUser.id),

    supabase.from("contas_bancarias")
      .select("saldo_inicial")
      .eq("user_id", currentUser.id)
  ]);

  const totalReceber = (rReceber.data || [])
    .reduce((s, it) => s + Number(it.valor || 0), 0);

  const totalPagar = (rPagar.data || [])
    .reduce((s, it) => s + Number(it.valor || 0), 0);

  const saldoAtual = (rContas.data || [])
    .reduce((s, it) => s + Number(it.saldo_inicial || 0), 0);

  const saldoPrevisto = saldoAtual + totalReceber - totalPagar;

  document.getElementById("dash-receber").textContent = formatReal(totalReceber);
  document.getElementById("dash-pagar").textContent = formatReal(totalPagar);
  document.getElementById("dash-saldo-atual").textContent = formatReal(saldoAtual);
  document.getElementById("dash-saldo-previsto").textContent = formatReal(saldoPrevisto);

  // GRÁFICO
  if (chartCanvas) {
    const ctx = chartCanvas.getContext("2d");

    const data = {
      labels: ["Mês atual"],
      datasets: [
        {
          label: "A Receber",
          data: [totalReceber],
          backgroundColor: "rgba(54,162,235,0.8)"
        },
        {
          label: "A Pagar",
          data: [totalPagar],
          backgroundColor: "rgba(255,99,132,0.8)"
        }
      ]
    };

    const options = {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { position: "bottom" }
      }
    };

    if (dashboardChart) {
      dashboardChart.data = data;
      dashboardChart.options = options;
      dashboardChart.update();
    } else {
      dashboardChart = new Chart(ctx, {
        type: "bar",
        data,
        options
      });
    }
  }
}

// -------------------------
// REALTIME (Supabase)
// -------------------------
function subscribeToChanges() {

  supabase.channel("rt_receitas").on(
    "postgres_changes",
    { event: "*", schema: "public", table: "receitas" },
    payload => {
      if (payload.record?.user_id === currentUser.id) {
        refreshMovements();
        loadExtrato();
      }
    }
  ).subscribe();

  supabase.channel("rt_despesas").on(
    "postgres_changes",
    { event: "*", schema: "public", table: "despesas" },
    payload => {
      if (payload.record?.user_id === currentUser.id) {
        refreshMovements();
        loadExtrato();
      }
    }
  ).subscribe();

  supabase.channel("rt_contas").on(
    "postgres_changes",
    { event: "*", schema: "public", table: "contas_bancarias" },
    payload => {
      if (payload.record?.user_id === currentUser.id) {
        loadContas();
        loadExtrato();
      }
    }
  ).subscribe();
}
// -------------------------
// SINCRONIZAR SELECTS (contas)
// -------------------------
function syncSelects() {
  if (!selectContas || !selectContasExtrato || !selectContaLanc) return;

  selectContasExtrato.value = selectContas.value;
  selectContaLanc.value = selectContas.value;

  loadExtrato();
}

// Sempre que mudar a conta na aba "Cadastro", sincroniza
if (selectContas) {
  selectContas.onchange = syncSelects;
}

// -------------------------
// FIM DO ARQUIVO
// -------------------------
console.log("app.js carregado com sucesso!");
