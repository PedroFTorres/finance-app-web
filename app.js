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

  # truncated for brevity - full file written in zip below
