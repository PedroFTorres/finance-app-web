// =========================
//  Finance App - app.js (versão com 'Baixar' implementado)
//  Adicionado: botão "Baixar" na tela de Lançamentos (Opção A)
//  Observação: este arquivo substitui/atualiza o app.js existente.
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
    user_id: currentUser.id,
    baixado: false
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

// -------------------------
// Criar li com estilo (agora com botão "Baixar")
// -------------------------
function createLancamentoItem(item, type) {
  const li = document.createElement("li");

  li.style.fontFamily = `"Courier New", monospace`;
  li.style.fontWeight = "bold";
  li.style.marginBottom = "10px";

  li.style.color = type === "receita" ? "green" : "red";

  const textSpan = document.createElement("span");
  textSpan.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  if (item.baixado) {
    // estilo para baixado
    li.style.opacity = "0.6";
    const baixadoTag = document.createElement("small");
    baixadoTag.textContent = " (baixado)";
    textSpan.appendChild(baixadoTag);
  }

  li.appendChild(textSpan);

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

  const baixarBtn = document.createElement("button");
  baixarBtn.textContent = "Baixar";
  baixarBtn.style.marginLeft = "5px";
  baixarBtn.onclick = () => baixarLancamento(type, item);

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  // somente mostrar baixar se não estiver baixado
  if (!item.baixado) actions.appendChild(baixarBtn);

  li.appendChild(actions);

  return li;
}

// -------------------------
// Função de Baixar (Opção A: perguntar a conta)
// -------------------------
async function baixarLancamento(type, item) {
  try {
    // buscar contas do usuário para apresentar opções
    const { data: contas, error: errContas } = await supabase
      .from("contas_bancarias")
      .select("id, nome, saldo_atual, saldo_inicial")
      .eq("user_id", currentUser.id)
      .order("created_at");

    if (errContas) throw errContas;

    if (!contas || contas.length === 0) return alert("Nenhuma conta encontrada. Crie uma conta antes de baixar o lançamento.");

    // montar mensagem com opções
    let msg = "Escolha a conta para baixar:\n";
    contas.forEach((c, idx) => {
      const saldoText = Number(c.saldo_atual || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      msg += `${idx + 1}) ${c.nome} — ${saldoText} — id:${c.id}\n`;
    });
    msg += "\nDigite o número da conta (ex: 1) ou deixe vazio para usar a conta do lançamento:";

    const resposta = prompt(msg, "");

    let contaEscolhidaId = null;

    if (!resposta || resposta.trim() === "") {
      contaEscolhidaId = item.conta_id; // usar conta do lançamento
    } else {
      const num = parseInt(resposta, 10);
      if (!isNaN(num) && num >= 1 && num <= contas.length) {
        contaEscolhidaId = contas[num - 1].id;
      } else {
        // talvez o usuário colou o id direto
        const byId = contas.find(c => c.id === resposta.trim());
        if (byId) contaEscolhidaId = byId.id;
        else return alert('Entrada inválida. Operação cancelada.');
      }
    }

    // buscar a conta selecionada
    const { data: conta, error: errConta } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("id", contaEscolhidaId)
      .single();

    if (errConta) throw errConta;

    // calcular novo saldo
    let novoSaldo = conta.saldo_atual || 0;
    if (type === "receita") novoSaldo = parseFloat(novoSaldo) + parseFloat(item.valor);
    else novoSaldo = parseFloat(novoSaldo) - parseFloat(item.valor);

    // atualizar saldo da conta
    const { error: errUpdateConta } = await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: novoSaldo })
      .eq("id", contaEscolhidaId);

    if (errUpdateConta) throw errUpdateConta;

    // marcar lançamento como baixado
    const table = type === "receita" ? "receitas" : "despesas";

    const { error: errUpdateLanc } = await supabase
      .from(table)
      .update({ baixado: true, data_baixa: new Date().toISOString().slice(0,10) })
      .eq("id", item.id);

    if (errUpdateLanc) throw errUpdateLanc;

    alert('Lançamento baixado com sucesso!');
    refreshMovements();

  } catch (err) {
    console.error(err);
    alert('Erro ao baixar lançamento: ' + (err.message || JSON.stringify(err)));
  }
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
