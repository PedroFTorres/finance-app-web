// =========================
//  Finance App - app.js (menu topo adicionado)
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

// MENU elementos
const menuContasBtn = document.getElementById('menu-contas');
const menuLancamentosBtn = document.getElementById('menu-lancamentos');
const telaContas = document.getElementById('tela-contas');
const telaLancamentos = document.getElementById('tela-lancamentos');

// -------------------------
// Inicialização
// -------------------------

async function initApp() {
  // carregar contas e movimentos iniciais
  await loadContas();
  subscribeToChanges();

  // bind do menu
  menuContasBtn.onclick = () => showContas();
  menuLancamentosBtn.onclick = () => showLancamentos();

  // mostrar a tela padrão (contas)
  showContas();
}

// -------------------------
// Funções de troca de tela
// -------------------------

function showContas() {
  telaContas.classList.remove('hidden');
  telaLancamentos.classList.add('hidden');

  menuContasBtn.classList.add('active');
  menuLancamentosBtn.classList.remove('active');
}

function showLancamentos() {
  telaContas.classList.add('hidden');
  telaLancamentos.classList.remove('hidden');

  menuContasBtn.classList.remove('active');
  menuLancamentosBtn.classList.add('active');

  // sempre que abrir lançamentos, atualiza movimentos
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
