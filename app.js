// === ELEMENTOS DA TELA ===
const authSection = document.getElementById('auth');
const appSection = document.getElementById('app');

const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const btnSignup = document.getElementById('btn-signup');
const btnSignin = document.getElementById('btn-signin');
const btnLogout = document.getElementById('btn-logout');

const userArea = document.getElementById('user-area');

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

let currentUser = null;


// === AUTENTICAÇÃO ===
function showAuth() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
}

function showApp() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  userArea.textContent = currentUser.email;
}


btnSignup.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass = passInput.value.trim();

  const { error } = await supabase.auth.signUp({ email, password: pass });
  if (error) return alert(error.message);

  alert("Conta criada! Agora faça login.");
});


btnSignin.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass = passInput.value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) return alert(error.message);

  currentUser = data.user;
  initApp();
});


btnLogout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  showAuth();
});


// Mantém sessão ativa
supabase.auth.onAuthStateChange((e, session) => {
  if (session?.user) {
    currentUser = session.user;
    initApp();
  } else {
    showAuth();
  }
});


// === APP PRINCIPAL ===

async function initApp() {
  showApp();
  await loadContas();
  subscribeToChanges();
}


// === CONTAS ===
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


btnAddConta.addEventListener("click", async () => {
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
        user_id: currentUser.id
      }
    ]);

  if (error) return alert(error.message);

  contaNome.value = "";
  contaSaldo.value = "";

  loadContas();
});


// === LANÇAMENTOS ===
btnAddLanc.addEventListener("click", async () => {
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
});


// === LISTAR RECEITAS E DESPESAS ===
async function refreshMovements() {
  const conta_id = selectContas.value;

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id),
    supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id)
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


// === REALTIME ===
function subscribeToChanges() {
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, refreshMovements)
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, refreshMovements)
    .subscribe();
}
