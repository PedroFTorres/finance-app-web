// =========================
//  Finance App - app.js
//  (com edição/exclusão de lançamentos)
// =========================

// Variáveis globais
let currentUser = null;
let editing = { type: null, id: null }; // { type: "receita"|"despesa", id: <uuid> }

// Verificar sessão ao abrir o app
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

// Logout (substituir botão existente)
const logoutBtn = document.getElementById("btn-logout");
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  };
}

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
const btnCancelEdit = document.getElementById('btn-cancel-edit');

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

  if (error) {
    console.error("Erro ao carregar contas:", error);
    return;
  }

  selectContas.innerHTML = "";

  data.forEach(conta => {
    const opt = document.createElement("option");
    opt.value = conta.id;
    // garante que saldo_inicial exista
    const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
    opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
    selectContas.appendChild(opt);
  });

  if (data.length > 0) {
    selectContas.value = data[0].id;
    refreshMovements();
  } else {
    // se não houver contas, limpar movimentos
    listReceitas.innerHTML = "";
    listDespesas.innerHTML = "";
    saldoAtualEl.textContent = "";
    totalReceitasEl.textContent = "";
    totalDespesasEl.textContent = "";
  }
}


// =========================
//  ADICIONAR CONTA
// =========================
if (btnAddConta) {
  btnAddConta.onclick = async () => {
    const nome = contaNome.value.trim();
    const saldo = parseFloat(contaSaldo.value || 0);

    if (!nome) return alert("Informe o nome da conta!");

    const { error } = await supabase
      .from("contas_bancarias")
      .insert([{
        nome,
        saldo_inicial: saldo,
        saldo_atual: saldo,
        user_id: currentUser.id,
      }]);

    if (error) return alert(error.message);

    contaNome.value = "";
    contaSaldo.value = "";
    await loadContas();
  };
}


// =========================
//  ADICIONAR / SALVAR LANÇAMENTO
// =========================
if (btnAddLanc) {
  btnAddLanc.onclick = async () => {
    const valor = parseFloat(valorLanc.value);
    const desc = descLanc.value.trim();
    const data = dataLanc.value;
    const tipo = tipoLanc.value;
    const conta_id = selectContas.value;

    if (!valor || !desc || !data) return alert("Preencha todos os campos!");

    // Se estamos editando, atualiza a linha correspondente
    if (editing.type && editing.id) {
      const table = editing.type === "receita" ? "receitas" : "despesas";
      const { error } = await supabase
        .from(table)
        .update({
          descricao: desc,
          valor,
          data,
          conta_id
        })
        .eq("id", editing.id)
        .eq("user_id", currentUser.id);

      if (error) return alert(error.message);

      // limpar estado de edição
      stopEdit();
      refreshMovements();
      return;
    }

    // caso padrão: inserir novo
    const payload = {
      descricao: desc,
      valor,
      data,
      conta_id,
      user_id: currentUser.id
    };

    if (tipo === "receita") {
      const { error } = await supabase.from("receitas").insert([payload]);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("despesas").insert([payload]);
      if (error) return alert(error.message);
    }

    // limpar campos
    valorLanc.value = "";
    descLanc.value = "";
    dataLanc.value = "";

    refreshMovements();
  };
}

// Cancelar edição
if (btnCancelEdit) {
  btnCancelEdit.onclick = () => {
    stopEdit();
  };
}

function startEdit(type, item) {
  // type = "receita" | "despesa"
  // item = objeto da linha (tem id, descricao, valor, data, conta_id)
  editing.type = type;
  editing.id = item.id;

  // preencher formulário com dados
  tipoLanc.value = type; // ajusta o select
  valorLanc.value = Number(item.valor).toFixed(2);
  descLanc.value = item.descricao;
  dataLanc.value = item.data;
  // tenta selecionar a conta
  if (item.conta_id) {
    selectContas.value = item.conta_id;
  }

  // ajustar botões / UI
  if (btnAddLanc) btnAddLanc.textContent = "Salvar";
  if (btnCancelEdit) btnCancelEdit.classList.remove("hidden");
}

function stopEdit() {
  editing.type = null;
  editing.id = null;

  // limpar formulário
  valorLanc.value = "";
  descLanc.value = "";
  dataLanc.value = "";
  if (btnAddLanc) btnAddLanc.textContent = "Adicionar";

  if (btnCancelEdit) btnCancelEdit.classList.add("hidden");
}


// =========================
//  EXCLUIR LANÇAMENTO
// =========================
async function deleteItem(type, id) {
  const conf = confirm("Deseja realmente excluir esse lançamento?");
  if (!conf) return;

  const table = type === "receita" ? "receitas" : "despesas";
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) return alert(error.message);

  refreshMovements();
}


// =========================
//  LISTAR RECEITAS & DESPESAS
// =========================
async function refreshMovements() {
  const conta_id = selectContas.value;
  if (!conta_id) return;

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order('data', { ascending: true }),
    supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order('data', { ascending: true })
  ]);

  const receitas = r.data || [];
  const despesas = d.data || [];

  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  let totalR = 0;
  let totalD = 0;

  receitas.forEach(item => {
    totalR += Number(item.valor || 0);
    const li = document.createElement("li");
    li.textContent = `${item.data} — ${item.descricao} — R$ ${Number(item.valor).toFixed(2)}`;

    // botões editar / excluir
    const btns = document.createElement("div");
    btns.style.display = "inline-block";
    btns.style.float = "right";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.onclick = () => startEdit("receita", item);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.onclick = () => deleteItem("receita", item.id);

    btns.appendChild(editBtn);
    btns.appendChild(delBtn);
    li.appendChild(btns);

    listReceitas.appendChild(li);
  });

  despesas.forEach(item => {
    totalD += Number(item.valor || 0);
    const li = document.createElement("li");
    li.textContent = `${item.data} — ${item.descricao} — R$ ${Number(item.valor).toFixed(2)}`;

    // botões editar / excluir
    const btns = document.createElement("div");
    btns.style.display = "inline-block";
    btns.style.float = "right";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.onclick = () => startEdit("despesa", item);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Excluir";
    delBtn.onclick = () => deleteItem("despesa", item.id);

    btns.appendChild(editBtn);
    btns.appendChild(delBtn);
    li.appendChild(btns);

    listDespesas.appendChild(li);
  });

  totalReceitasEl.textContent = `R$ ${totalR.toFixed(2)}`;
  totalDespesasEl.textContent = `R$ ${totalD.toFixed(2)}`;

  // calcular saldo inicial com segurança (evita crash se text diferente)
  const opt = selectContas.selectedOptions[0];
  let saldoInicial = 0;
  if (opt) {
    const m = opt.textContent.match(/\(R\$ *([0-9.,]+)\)/);
    if (m) saldoInicial = parseFloat(m[1].replace(",", "."));
  }

  const saldoAtual = (saldoInicial + totalR) - totalD;
  saldoAtualEl.textContent = `R$ ${Number(saldoAtual).toFixed(2)}`;
}


// =========================
//  REALTIME
// =========================
function subscribeToChanges() {
  // escuta mudanças em receitas e despesas (qualquer usuário) e atualiza se for do usuário atual
  supabase.channel("rt_receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, payload => {
      // Só atualizar se a mudança for do currentUser (segurança + performance)
      if (!payload.record) return;
      if (payload.record.user_id !== currentUser.id) return;
      refreshMovements();
    })
    .subscribe();

  supabase.channel("rt_despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, payload => {
      if (!payload.record) return;
      if (payload.record.user_id !== currentUser.id) return;
      refreshMovements();
    })
    .subscribe();
}
