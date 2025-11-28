// =========================
//  Finance App - app.js (com Dashboard e Chart.js)
// =========================

// -------------------------
// Utilidades
// -------------------------

function formatDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// -------------------------
// Sessão e variáveis
// -------------------------

let currentUser = null;
let editing = { type: null, id: null };
let dashboardChart = null;

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

// Dashboard DOM
const dashPeriod = document.getElementById('dash-period');
const dashReceber = document.getElementById('dash-receber');
const dashPagar = document.getElementById('dash-pagar');
const dashSaldoAtual = document.getElementById('dash-saldo-atual');
const dashSaldoPrevisto = document.getElementById('dash-saldo-previsto');

// MENU elementos
const menuDashboardBtn = document.getElementById('menu-dashboard');
const menuContasBtn = document.getElementById('menu-contas');
const menuLancamentosBtn = document.getElementById('menu-lancamentos');
const telaDashboard = document.getElementById('tela-dashboard');
const telaContas = document.getElementById('tela-contas');
const telaLancamentos = document.getElementById('tela-lancamentos');

// -------------------------
// Inicialização
// -------------------------

async function initApp() {
  await loadContas();
  subscribeToChanges();

  // bind do menu
  menuDashboardBtn.onclick = () => showDashboard();
  menuContasBtn.onclick = () => showContas();
  menuLancamentosBtn.onclick = () => showLancamentos();

  // mostrar a tela padrão (dashboard)
  showDashboard();
}

// -------------------------
// Funções de troca de tela
// -------------------------

function showDashboard() {
  telaDashboard.classList.remove('hidden');
  telaContas.classList.add('hidden');
  telaLancamentos.classList.add('hidden');

  menuDashboardBtn.classList.add('active');
  menuContasBtn.classList.remove('active');
  menuLancamentosBtn.classList.remove('active');

  updateDashboard();
}

function showContas() {
  telaDashboard.classList.add('hidden');
  telaContas.classList.remove('hidden');
  telaLancamentos.classList.add('hidden');

  menuDashboardBtn.classList.remove('active');
  menuContasBtn.classList.add('active');
  menuLancamentosBtn.classList.remove('active');
}

function showLancamentos() {
  telaDashboard.classList.add('hidden');
  telaContas.classList.add('hidden');
  telaLancamentos.classList.remove('hidden');

  menuDashboardBtn.classList.remove('active');
  menuContasBtn.classList.remove('active');
  menuLancamentosBtn.classList.add('active');

  refreshMovements();
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
// Dashboard: cálculos e gráfico
// -------------------------

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function toISODate(d) {
  return d.toISOString().slice(0,10);
}

async function updateDashboard() {
  if (!currentUser) return;

  const today = new Date();
  const { start, end } = getMonthRange(today);

  const startStr = toISODate(start);
  const endStr = toISODate(end);
  const todayStr = toISODate(today);

  dashPeriod.textContent = `${formatDate(startStr)} — ${formatDate(endStr)}`;

  // Query: apenas lançamentos do mês atual com data >= hoje (futuros no mês)
  const [rReceitas, rDespesas, rContas] = await Promise.all([
    supabase.from("receitas").select("valor").gte("data", todayStr).lte("data", endStr).eq("user_id", currentUser.id),
    supabase.from("despesas").select("valor").gte("data", todayStr).lte("data", endStr).eq("user_id", currentUser.id),
    supabase.from("contas_bancarias").select("saldo_inicial").eq("user_id", currentUser.id)
  ]);

  const receitas = rReceitas.data || [];
  const despesas = rDespesas.data || [];
  const contas = rContas.data || [];

  const totalReceber = receitas.reduce((s, it) => s + (it.valor || 0), 0);
  const totalPagar = despesas.reduce((s, it) => s + (it.valor || 0), 0);
  const saldoAtual = contas.reduce((s, it) => s + (parseFloat(it.saldo_inicial || 0)), 0);
  const saldoPrevisto = saldoAtual + totalReceber - totalPagar;

  dashReceber.textContent = formatReal(totalReceber);
  dashPagar.textContent = formatReal(totalPagar);
  dashSaldoAtual.textContent = formatReal(saldoAtual);
  dashSaldoPrevisto.textContent = formatReal(saldoPrevisto);

  // Atualizar gráfico
  const ctx = document.getElementById('chart-dashboard').getContext('2d');
  const data = {
    labels: ['Mês atual'],
    datasets: [
      {
        label: 'A Receber',
        data: [totalReceber],
        backgroundColor: 'rgba(54, 162, 235, 0.8)'
      },
      {
        label: 'A Pagar',
        data: [totalPagar],
        backgroundColor: 'rgba(255, 99, 132, 0.8)'
      }
    ]
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        stacked: false
      },
      y: {
        beginAtZero: true
      }
    }
  };

  if (dashboardChart) {
    dashboardChart.data = data;
    dashboardChart.options = options;
    dashboardChart.update();
  } else {
    dashboardChart = new Chart(ctx, { type: 'bar', data, options });
  }
}

// -------------------------
// Realtime
// -------------------------

function subscribeToChanges() {
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" },
      payload => {
        if (payload.record?.user_id === currentUser.id) {
          refreshMovements();
          updateDashboard();
        }
      })
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" },
      payload => {
        if (payload.record?.user_id === currentUser.id) {
          refreshMovements();
          updateDashboard();
        }
      })
    .subscribe();

  supabase.channel("rt_contas")
    .on("postgres_changes", { event: "*", schema: "public", table: "contas_bancarias" },
      payload => {
        if (payload.record?.user_id === currentUser.id) {
          loadContas();
          updateDashboard();
        }
      })
    .subscribe();
}
