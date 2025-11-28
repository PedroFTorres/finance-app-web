// =========================
//  Finance App - app.js (versão aprimorada)
// =========================

// -------------------------
// Utilidades
// -------------------------

// Formatar data para DD/MM/YYYY
function formatDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Formatar valores no padrão Real
function formatReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// -------------------------
// Variáveis e sessão
// -------------------------

let currentUser = null;
let editing = { type: null, id: null };

// Verificar sessão ao carregar app.html
supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "login.html";
  } else {
    currentUser = data.session.user;
    document.getElementById("user-email").textContent = currentUser.email;
    initApp();
  }
});

// Logout
document.getElementById("btn-logout").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// -------------------------
// Elementos do DOM
// -------------------------

const selectContas = document.getElementById('select-contas');
const contaNome = document.getElementById('conta-nome');
const contaSaldo = document.getElementById('conta-saldo');
const btnAddConta = document.getElementById('btn-add-conta');

const tipoLanc = document.getElementById('tipo-lancamento');
const valorLanc = document.getElementById('valor-lanc');
const descLanc = document.getElementById('desc-lanc');
const dataLanc = document.getElementById('data-lanc');
const btnAddLanc = document.getElementById('btn-add-lanc');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

const saldoAtualEl = document.getElementById('saldo-atual');
const totalReceitasEl = document.getElementById('total-receitas');
const totalDespesasEl = document.getElementById('total-despesas');

const listReceitas = document.getElementById('list-receitas');
const listDespesas = document.getElementById('list-despesas');

// -------------------------
// Inicialização
// -------------------------

async function initApp() {
  await loadContas();
  subscribeToChanges();
}

// -------------------------
// Contas bancárias
// -------------------------

async function loadContas() {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at");

  if (error) return console.error(error);

  selectContas.innerHTML = "";

  data.forEach(conta => {
    const opt = document.createElement("option");
    const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
    opt.value = conta.id;
    opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
    selectContas.appendChild(opt);
  });

  if (data.length > 0) {
    selectContas.value = data[0].id;
    refreshMovements();
  }
}

btnAddConta.onclick = async () => {
  const nome = contaNome.value.trim();
  const saldo = parseFloat(contaSaldo.value || 0);

  if (!nome) return alert("Informe o nome da conta!");

  const { error } = await supabase
    .from("contas_bancarias")
    .insert([
      { nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id }
    ]);

  if (error) return alert(error.message);

  contaNome.value = "";
  contaSaldo.value = "";

  loadContas();
};

// -------------------------
// Criar / Editar lançamentos
// -------------------------

btnAddLanc.onclick = async () => {
  const valor = parseFloat(valorLanc.value);
  const desc = descLanc.value.trim();
  const data = dataLanc.value;
  const tipo = tipoLanc.value;
  const conta_id = selectContas.value;

  if (!valor || !desc || !data) return alert("Preencha todos os campos!");

  // Modo edição
  if (editing.type && editing.id) {
    const table = editing.type === "receita" ? "receitas" : "despesas";

    const { error } = await supabase
      .from(table)
      .update({ descricao: desc, valor, data, conta_id })
      .eq("id", editing.id)
      .eq("user_id", currentUser.id);

    if (error) return alert(error.message);

    stopEdit();
    refreshMovements();
    return;
  }

  // Modo adicionar
  const payload = {
    descricao: desc,
    valor,
    data,
    conta_id,
    user_id: currentUser.id
  };

  if (tipo === "receita") {
    await supabase.from("receitas").insert([payload]);
  } else {
    await supabase.from("despesas").insert([payload]);
  }

  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";

  refreshMovements();
};

btnCancelEdit.onclick = () => stopEdit();

function startEdit(type, item) {
  editing.type = type;
  editing.id = item.id;

  tipoLanc.value = type;
  valorLanc.value = item.valor;
  descLanc.value = item.descricao;
  dataLanc.value = item.data;
  selectContas.value = item.conta_id;

  btnAddLanc.textContent = "Salvar";
  btnCancelEdit.classList.remove("hidden");
}

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
// Excluir lançamento
// -------------------------

async function deleteItem(type, id) {
  if (!confirm("Deseja excluir este lançamento?")) return;

  const table = type === "receita" ? "receitas" : "despesas";

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) return alert(error.message);

  refreshMovements();
}

// -------------------------
// Carregar receitas e despesas
// -------------------------

async function refreshMovements() {
  const conta_id = selectContas.value;

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data"),

    supabase.from("despesas").select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
      .order("data")
  ]);

  const receitas = r.data || [];
  const despesas = d.data || [];

  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  let totalR = 0;
  let totalD = 0;

  receitas.forEach(item => {
    totalR += item.valor;
    const li = createLancamentoItem(item, "receita");
    listReceitas.appendChild(li);
  });

  despesas.forEach(item => {
    totalD += item.valor;
    const li = createLancamentoItem(item, "despesa");
    listDespesas.appendChild(li);
  });

  totalReceitasEl.textContent = formatReal(totalR);
  totalDespesasEl.textContent = formatReal(totalD);

  const opt = selectContas.selectedOptions[0];
  const saldoInicial = opt ? parseFloat(opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(",", ".")) : 0;

  saldoAtualEl.textContent = formatReal((saldoInicial + totalR - totalD));
}

// Criar li com estilo
function createLancamentoItem(item, type) {
  const li = document.createElement("li");

  li.style.fontFamily = `"Courier New", monospace`;
  li.style.fontWeight = "bold";
  li.style.marginBottom = "10px";

  li.style.color = type === "receita" ? "green" : "red";

  li.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  // Botões de ação
  const actions = document.createElement("span");
  actions.style.float = "right";

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
// Realtime
// -------------------------

function subscribeToChanges() {
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" },
      payload => {
        if (payload.record?.user_id === currentUser.id) refreshMovements();
      })
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" },
      payload => {
        if (payload.record?.user_id === currentUser.id) refreshMovements();
      })
    .subscribe();
}
// ==========================================
// SISTEMA DE TELAS (MENU SUPERIOR)
// ==========================================

const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

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


// ==========================================
// ABAS DENTRO DE CONTAS (Cadastro / Extrato)
// ==========================================

const tabCadastro = document.getElementById("tab-cadastro");
const tabExtrato = document.getElementById("tab-extrato");

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;

    if (tab === "cadastro") {
      tabCadastro.classList.remove("hidden");
      tabExtrato.classList.add("hidden");
    } else {
      tabCadastro.classList.add("hidden");
      tabExtrato.classList.remove("hidden");
    }
  };
});


// ==========================================
// POPULAR SELECTS ADICIONAIS (extrato e lançamento)
// ==========================================

async function loadContasExtra() {
  const selectExtrato = document.getElementById("select-contas-extrato");
  const selectLanc = document.getElementById("select-conta-lanc");

  const { data } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id);

  selectExtrato.innerHTML = "";
  selectLanc.innerHTML = "";

  data.forEach(c => {
    const opt1 = document.createElement("option");
    opt1.value = c.id;
    opt1.textContent = c.nome;

    const opt2 = opt1.cloneNode(true);

    selectExtrato.appendChild(opt1);
    selectLanc.appendChild(opt2);
  });
}

// Chamar sempre quando carregar contas
const originalLoadContas = loadContas;
loadContas = async function () {
  await originalLoadContas(); 
  await loadContasExtra();
};
// ==========================================
// DASHBOARD — GRÁFICO E RESUMO
// ==========================================

let chartDashboard = null;

async function loadDashboard() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;

  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

  // Carregar receitas
  const receitas = await supabase
    .from("receitas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  // Carregar despesas
  const despesas = await supabase
    .from("despesas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const totalR = (receitas.data || []).reduce((s, r) => s + r.valor, 0);
  const totalD = (despesas.data || []).reduce((s, d) => s + d.valor, 0);
  const saldoPrevisto = totalR - totalD;

  document.getElementById("dash-period").textContent = `${mes}/${ano}`;
  document.getElementById("dash-receber").textContent = formatReal(totalR);
  document.getElementById("dash-pagar").textContent = formatReal(totalD);
  document.getElementById("dash-saldo-atual").textContent = formatReal(totalR - totalD);
  document.getElementById("dash-saldo-previsto").textContent = formatReal(saldoPrevisto);

  generateDashboardChart(totalR, totalD);
}


function generateDashboardChart(receitas, despesas) {
  const ctx = document.getElementById("chart-dashboard");

  if (!ctx) return;

  // Se o gráfico já existe, destrói antes de criar outro
  if (chartDashboard) {
    chartDashboard.destroy();
  }

  chartDashboard = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Receitas", "Despesas"],
      datasets: [
        {
          label: "Resumo do mês",
          data: [receitas, despesas],
          backgroundColor: ["green", "red"]
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Executa o dashboard toda vez que abrir a tela
btnDash.onclick = () => {
  showScreen("dashboard");
  loadDashboard();
};

