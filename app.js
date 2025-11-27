// =========================
//  Finance App - app.js
//  (versão final e corrigida)
// =========================

// Variáveis globais
let currentUser = null;

// 🔐 1. Verificar sessão ao abrir o app
supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    // Se não estiver logado, volta para o login
    window.location.href = "login.html";
  } else {
    currentUser = data.session.user;
    document.getElementById("user-email").textContent = currentUser.email;
    initApp();
  }
});

// 🔐 2. Logout
document.getElementById("btn-logout").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};


// =========================
// ELEMENTOS DO APP
// =========================

const selectContas = document.getElementById('select-contas');
const contaNome = document.getElementById('conta-nome');
const contaSaldo = document.getElementById('conta-saldo');
const btnAddConta = document.getElementById('btn-add-conta');

const tipoLanc = document.getElementById('tipo-lancamento');
const valorLanc = document.getElementById('valor-lanc');
const descLanc = document.getElementById('desc-lanc');
const dataLanc = document.getElementById('data-lanc');
const btnAddLanc = document.getElementById('btn-add-lanc');

const saldoAtualEl = document.getElementById('saldo-atual');
const totalReceitasEl = document.getElementById('total-receitas');
const totalDespesasEl = document.getElementById('total-despesas');

const listReceitas = document.getElementById('list-receitas');
const listDespesas = document.getElementById('list-despesas');


// =========================
//  APP PRINCIPAL
// =========================

async function initApp() {
  await loadContas();
  subscribeToChanges();
}


// =========================
//  CARREGAR CONTAS
// =========================

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
    opt.value = conta.id;
    opt.textContent = `${conta.nome} (R$ ${conta.saldo_inicial.toFixed(2)})`;
    selectContas.appendChild(opt);
  });

  if (data.length > 0) {
    selectContas.value = data[0].id;
    refreshMovements();
  }
}


// =========================
//  ADICIONAR CONTA
// =========================

btnAddConta.onclick = async () => {
  const nome = contaNome.value.trim();
  const saldo = parseFloat(contaSaldo.value || 0);

  if (!nome) return alert("Informe o nome da conta!");

  const { error } = await supabase
    .from("contas_bancarias")
    .insert([
      {
        nome,
        saldo_inicial: saldo,
        saldo_atual: saldo,
        user_id: currentUser.id,
      }
    ]);

  if (error) return alert(error.message);

  contaNome.value = "";
  contaSaldo.value = "";

  loadContas();
};


// =========================
//  ADICIONAR LANÇAMENTO
// =========================

btnAddLanc.onclick = async () => {
  const valor = parseFloat(valorLanc.value);
  const desc = descLanc.value.trim();
  const data = dataLanc.value;
  const tipo = tipoLanc.value;
  const conta_id = selectContas.value;

  if (!valor || !desc || !data) return alert("Preencha todos os campos!");

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


// =========================
//  LISTAR RECEITAS & DESPESAS
// =========================

async function refreshMovements() {
  const conta_id = selectContas.value;

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id),

    supabase.from("despesas").select("*")
      .eq("conta_id", conta_id)
      .eq("user_id", currentUser.id)
  ]);

  const receitas = r.data || [];
  const despesas = d.data || [];

  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  let totalR = 0;
  let totalD = 0;

  receitas.forEach(item => {
    totalR += item.valor;
    const li = document.createElement("li");
    li.textContent = `${item.data} — ${item.descricao} — R$ ${item.valor.toFixed(2)}`;
    listReceitas.appendChild(li);
  });

  despesas.forEach(item => {
    totalD += item.valor;
    const li = document.createElement("li");
    li.textContent = `${item.data} — ${item.descricao} — R$ ${item.valor.toFixed(2)}`;
    listDespesas.appendChild(li);
  });

  totalReceitasEl.textContent = `R$ ${totalR.toFixed(2)}`;
  totalDespesasEl.textContent = `R$ ${totalD.toFixed(2)}`;

  const saldoInicial = parseFloat(
    selectContas.selectedOptions[0].text.match(/\(R\$ ([0-9.]+)\)/)[1]
  );

  saldoAtualEl.textContent = `R$ ${(saldoInicial + totalR - totalD).toFixed(2)}`;
}


// =========================
//  REALTIME
// =========================

function subscribeToChanges() {
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, refreshMovements)
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, refreshMovements)
    .subscribe();
}

