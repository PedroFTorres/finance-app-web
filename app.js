// =========================
//  Finance App - app.js FINAL (com BAIXAR corrigido)
// =========================
// Este arquivo mantém 100% do funcionamento original
// Apenas adiciona o botão BAIXAR + correção do select da conta de lançamento
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
// Variáveis e sessão
// -------------------------
let currentUser = null;
let editing = { type: null, id: null };

supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "login.html";
  } else {
    currentUser = data.session.user;
    document.getElementById("user-email").textContent = currentUser.email;
    initApp();
  }
});

document.getElementById("btn-logout").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// -------------------------
// ELEMENTOS DO DOM
// -------------------------
const selectContas = document.getElementById('select-contas'); // PARA ABA CONTAS

// CORREÇÃO IMPORTANTE → select certo para lançamentos
const selectContaLanc = document.getElementById('select-conta-lanc'); // PARA LANÇAMENTOS

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
// CONTAS BANCÁRIAS
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
// LANÇAMENTOS (CRIA / EDITA / SALVA)
// -------------------------
btnAddLanc.onclick = async () => {
  const valor = parseFloat(valorLanc.value);
  const desc = descLanc.value.trim();
  const data = dataLanc.value;
  const tipo = tipoLanc.value;

  // CORREÇÃO → usar conta da aba de lançamentos
  const conta_id = selectContaLanc.value;

  if (!valor || !desc || !data) return alert("Preencha todos os campos!");

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

  const payload = {
    descricao: desc,
    valor,
    data,
    conta_id,
    user_id: currentUser.id,
    baixado: false
  };

  if (tipo === "receita") await supabase.from("receitas").insert([payload]);
  else await supabase.from("despesas").insert([payload]);

  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";

  refreshMovements();
};

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
// EXCLUIR LANÇAMENTO
// -------------------------
async function deleteItem(type, id) {
  if (!confirm("Deseja excluir este lançamento?")) return;

  const table = type === "receita" ? "receitas" : "despesas";

  await supabase.from(table).delete().eq("id", id);
  refreshMovements();
}

// -------------------------
// LISTAGEM DE LANÇAMENTOS + BOTÃO BAIXAR
// -------------------------
async function refreshMovements() {
  const conta_id = selectContas.value;

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order("data"),
    supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order("data")
  ]);

  const receitas = r.data || [];
  const despesas = d.data || [];

  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  receitas.forEach(item => listReceitas.appendChild(createLancamentoItem(item, "receita")));
  despesas.forEach(item => listDespesas.appendChild(createLancamentoItem(item, "despesa")));
}

function createLancamentoItem(item, type) {
  const li = document.createElement("li");
  li.style.fontFamily = `"Courier New", monospace`;
  li.style.fontWeight = "bold";
  li.style.marginBottom = "10px";
  li.style.color = type === "receita" ? "green" : "red";

  li.innerHTML = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  const actions = document.createElement("span");
  actions.style.float = "right";

  // botão editar
  const btnEdit = document.createElement("button");
  btnEdit.textContent = "Editar";
  btnEdit.style.marginLeft = "5px";
  btnEdit.onclick = () => startEdit(type, item);

  // botão excluir
  const btnDelete = document.createElement("button");
  btnDelete.textContent = "Excluir";
  btnDelete.style.marginLeft = "5px";
  btnDelete.onclick = () => deleteItem(type, item.id);

  // botão BAIXAR somente se não baixado
  if (!item.baixado) {
    const btnBaixar = document.createElement("button");
    btnBaixar.textContent = "Baixar";
    btnBaixar.style.marginLeft = "5px";
    btnBaixar.onclick = () => baixarLancamento(type, item);
    actions.appendChild(btnBaixar);
  }

  actions.appendChild(btnEdit);
  actions.appendChild(btnDelete);

  li.appendChild(actions);

  return li;
}

// -------------------------
// FUNÇÃO BAIXAR LANÇAMENTO
// -------------------------
async function baixarLancamento(type, item) {
  try {
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", currentUser.id);

    let msg = "Escolha a conta:\n";
    contas.forEach((c, i) => {
      msg += `${i + 1}) ${c.nome} (ID:${c.id})\n`;
    });

    msg += "\nDigite o número da conta ou deixe vazio para usar a conta original:";

    const escolha = prompt(msg);
    let contaId = item.conta_id;

    if (escolha && !isNaN(parseInt(escolha))) {
      contaId = contas[parseInt(escolha) - 1].id;
    }

    const conta = contas.find(c => c.id === contaId);
    let novoSaldo = conta.saldo_atual;

    if (type === "receita") novoSaldo += item.valor;
    else novoSaldo -= item.valor;

    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaId);

    const table = type === "receita" ? "receitas" : "despesas";

    await supabase
      .from(table)
      .update({ baixado: true, data_baixa: new Date().toISOString().slice(0,10) })
      .eq("id", item.id);

    alert("Lançamento baixado com sucesso!");
    refreshMovements();

  } catch (e) {
    alert("Erro ao baixar: " + e.message);
  }
}

// -------------------------
// REALTIME (SEM ALTERAÇÃO)
// -------------------------
function subscribeToChanges() {
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" },
      payload => { if (payload.record?.user_id === currentUser.id) refreshMovements(); })
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" },
      payload => { if (payload.record?.user_id === currentUser.id) refreshMovements(); })
    .subscribe();
}

// -------------------------
// (RESTANTE DO SEU ARQUIVO ORIGINAL — DASHBOARD, EXTRATO, ETC)
// -------------------------
// Mantido exatamente como você enviou (sem alterar nada)

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

  const { data } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id);

  selectExtrato.innerHTML = "";
  selectContaLanc.innerHTML = "";

  data.forEach(c => {
    const opt1 = document.createElement("option");
    opt1.value = c.id;
    opt1.textContent = c.nome;

    const opt2 = opt1.cloneNode(true);

    selectExtrato.appendChild(opt1);
    selectContaLanc.appendChild(opt2);
  });
}

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

  const receitas = await supabase
    .from("receitas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const despesas = await supabase
    .from("despesas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const totalR = (receitas.data || []).reduce((s, r) => s + r.valor, 0);
  const totalD = (despesas.data || []).reduce((s, d) => s + d.valor, 0);

  document.getElementById("dash-period").textContent = `${mes}/${ano}`;
  document.getElementById("dash-receber").textContent = formatReal(totalR);
  document.getElementById("dash-pagar").textContent = formatReal(totalD);
  document.getElementById("dash-saldo-atual").textContent = formatReal(totalR - totalD);
  document.getElementById("dash-saldo-previsto").textContent = formatReal(totalR - totalD);

  generateDashboardChart(totalR, totalD);
}

function generateDashboardChart(receitas, despesas) {
  const ctx = document.getElementById("chart-dashboard");
  if (!ctx) return;

  if (chartDashboard) chartDashboard.destroy();

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
      scales: { y: { beginAtZero: true } }
    }
  });
}

btnDash.onclick = () => {
  showScreen("dashboard");
  loadDashboard();
};
