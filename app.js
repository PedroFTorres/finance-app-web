// =========================
// Finance App - app.js (FINAL)
// Movimentações + Extrato misto + Cancelar Baixa
// Compatível com UUID (supabase)
// =========================

// -------------------------
// UTILITÁRIOS
// -------------------------
function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}
function formatReal(valor) {
  if (typeof valor !== "number") valor = Number(valor || 0);
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// -------------------------
// SESSÃO E VARS
// -------------------------
let currentUser = null;
let editing = { type: null, id: null };

// -------------------------
// ELEMENTOS DO DOM (declarar primeiro)
// -------------------------
const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

// Contas
const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

// Lançamentos
const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const selectContaLanc = document.getElementById("select-conta-lanc");

// Totais & listas
const saldoAtualEl = document.getElementById("saldo-atual");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

const listReceitas = document.getElementById("list-receitas");
const listDespesas = document.getElementById("list-despesas");

// Abas internas / extrato
const tabCadastro = document.getElementById("tab-cadastro");
const tabExtrato = document.getElementById("tab-extrato");

const selectExtrato = document.getElementById("select-contas-extrato");
const periodoExtrato = document.getElementById("periodo-extrato");
const dataInicio = document.getElementById("data-inicio");
const dataFim = document.getElementById("data-fim");
const btnFiltrarExtrato = document.getElementById("btn-filtrar-extrato");
const tableExtrato = document.getElementById("table-extrato").querySelector("tbody");
const totalValorExtrato = document.getElementById("total-valor");
const totalReceitasExtrato = document.getElementById("total-receitas-extrato");
const totalDespesasExtrato = document.getElementById("total-despesas-extrato");
const saldoPeriodoExtrato = document.getElementById("saldo-periodo-extrato");
const saldoAtualContaExtrato = document.getElementById("saldo-atual-conta-extrato");

// Dashboard
let chartDashboard = null;

// -------------------------
// AUTH
// -------------------------
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
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = "login.html"; };

// -------------------------
// INIT
// -------------------------
async function initApp() {
  await loadContas();
  subscribeToChanges();
}

// -------------------------
// CONTAS
// -------------------------
async function loadContas() {
  try {
    const { data, error } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at");

    if (error) throw error;

    selectContas.innerHTML = "";
    data.forEach(conta => {
      const opt = document.createElement("option");
      const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
      opt.value = conta.id;
      opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
      selectContas.appendChild(opt);
    });

    if (data.length > 0) {
      if (!selectContas.value) selectContas.value = data[0].id;
      await refreshMovements();
    }
  } catch (err) {
    console.error("Erro loadContas:", err);
  }
}

if (btnAddConta) {
  btnAddConta.onclick = async () => {
    try {
      const nome = (contaNome.value || "").trim();
      const saldo = parseFloat(contaSaldo.value || 0);
      if (!nome) return alert("Informe o nome da conta!");
      const { error } = await supabase
        .from("contas_bancarias")
        .insert([{ nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id }]);
      if (error) return alert(error.message);
      contaNome.value = ""; contaSaldo.value = "";
      await loadContas();
    } catch (err) {
      console.error("Erro btnAddConta:", err);
      alert("Erro ao criar conta.");
    }
  };
}

// -------------------------
// POPULAR SELECTS EXTRAS
// -------------------------
async function loadContasExtra() {
  try {
    const { data, error } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at");

    if (error) throw error;

    if (selectExtrato) selectExtrato.innerHTML = "";
    if (selectContaLanc) selectContaLanc.innerHTML = "";

    data.forEach(c => {
      const o1 = document.createElement("option");
      o1.value = c.id; o1.textContent = c.nome;
      const o2 = o1.cloneNode(true);
      if (selectExtrato) selectExtrato.appendChild(o1);
      if (selectContaLanc) selectContaLanc.appendChild(o2);
    });

    if (selectContaLanc && !selectContaLanc.value && data.length > 0) selectContaLanc.value = data[0].id;
    if (selectExtrato && !selectExtrato.value && data.length > 0) selectExtrato.value = data[0].id;
  } catch (err) {
    console.error("Erro loadContasExtra:", err);
  }
}

const originalLoadContas = loadContas;
loadContas = async function () { await originalLoadContas(); await loadContasExtra(); };

// -------------------------
// LANÇAMENTOS (add/edit/delete)
// -------------------------
if (btnAddLanc) {
  btnAddLanc.onclick = async () => {
    try {
      const valor = parseFloat(valorLanc.value);
      const desc = (descLanc.value || "").trim();
      const data = dataLanc.value;
      const tipo = tipoLanc.value;
      const conta_id = selectContaLanc.value;

      if (!valor || !desc || !data) return alert("Preencha todos os campos!");

      // edição
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

      // adicionar
      const payload = { descricao: desc, valor, data, conta_id, user_id: currentUser.id, baixado: false };
      if (tipo === "receita") await supabase.from("receitas").insert([payload]);
      else await supabase.from("despesas").insert([payload]);

      valorLanc.value = ""; descLanc.value = ""; dataLanc.value = "";
      refreshMovements();
    } catch (err) {
      console.error("Erro btnAddLanc:", err);
      alert("Erro ao adicionar lançamento.");
    }
  };
}

if (btnCancelEdit) btnCancelEdit.onclick = () => stopEdit();

function startEdit(type, item) {
  editing.type = type; editing.id = item.id;
  tipoLanc.value = type; valorLanc.value = item.valor; descLanc.value = item.descricao; dataLanc.value = item.data;
  if (selectContaLanc) selectContaLanc.value = item.conta_id;
  btnAddLanc.textContent = "Salvar"; btnCancelEdit.classList.remove("hidden");
}

function stopEdit() {
  editing = { type: null, id: null };
  valorLanc.value = ""; descLanc.value = ""; dataLanc.value = "";
  if (btnAddLanc) btnAddLanc.textContent = "Adicionar";
  if (btnCancelEdit) btnCancelEdit.classList.add("hidden");
}

async function deleteItem(type, id) {
  try {
    if (!confirm("Deseja excluir este lançamento?")) return;
    const table = type === "receita" ? "receitas" : "despesas";
    const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", currentUser.id);
    if (error) return alert(error.message);
    refreshMovements();
  } catch (err) {
    console.error("Erro deleteItem:", err);
  }
}

// -------------------------
// REFRESH LISTAS (Lançamentos na tela Lançamentos)
// -------------------------
async function refreshMovements() {
  try {
    const conta_id = selectContas.value;

    const [r, d] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order("data"),
      supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).order("data")
    ]);

    const receitas = r.data || [];
    const despesas = d.data || [];

    listReceitas.innerHTML = ""; listDespesas.innerHTML = "";

    let totalR = 0, totalD = 0;
    receitas.forEach(item => { totalR += Number(item.valor || 0); listReceitas.appendChild(createLancamentoItem(item, "receita")); });
    despesas.forEach(item => { totalD += Number(item.valor || 0); listDespesas.appendChild(createLancamentoItem(item, "despesa")); });

    totalReceitasEl.textContent = formatReal(totalR);
    totalDespesasEl.textContent = formatReal(totalD);

    const opt = selectContas.selectedOptions[0];
    const saldoInicial = opt ? parseFloat(opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(",", ".")) : 0;
    saldoAtualEl.textContent = formatReal((saldoInicial + totalR - totalD));
  } catch (err) {
    console.error("Erro refreshMovements:", err);
  }
}

function createLancamentoItem(item, type) {
  const li = document.createElement("li");
  li.style.fontFamily = `"Courier New", monospace`; li.style.fontWeight = "bold"; li.style.marginBottom = "10px";
  li.style.color = type === "receita" ? "green" : "red";

  const textSpan = document.createElement("span");
  textSpan.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;
  if (item.baixado) { li.style.opacity = "0.6"; const t = document.createElement("small"); t.textContent = " (baixado)"; textSpan.appendChild(t); }

  li.appendChild(textSpan);

  const actions = document.createElement("span"); actions.style.float = "right";

  if (!item.baixado) {
    const baixarBtn = document.createElement("button"); baixarBtn.textContent = "Baixar"; baixarBtn.style.marginLeft = "5px";
    baixarBtn.onclick = () => baixarLancamento(type, item);
    actions.appendChild(baixarBtn);
  }

  const editBtn = document.createElement("button"); editBtn.textContent = "Editar"; editBtn.style.marginLeft = "5px"; editBtn.onclick = () => startEdit(type, item);
  const delBtn = document.createElement("button"); delBtn.textContent = "Excluir"; delBtn.style.marginLeft = "5px"; delBtn.onclick = () => deleteItem(type, item.id);

  actions.appendChild(editBtn); actions.appendChild(delBtn);
  li.appendChild(actions);
  return li;
}

// -------------------------
// BAIXAR: atualiza saldo, marca lançamento e cria movimentacao
// -------------------------
async function baixarLancamento(type, item) {
  try {
    const { data: contas, error: errContas } = await supabase.from("contas_bancarias").select("id, nome, saldo_atual").eq("user_id", currentUser.id).order("created_at");
    if (errContas) throw errContas;
    if (!contas || contas.length === 0) return alert("Nenhuma conta encontrada. Crie uma conta primeiro.");

    let msg = "Escolha a conta para baixar:\n";
    contas.forEach((c, i) => { msg += `${i + 1}) ${c.nome} — ${formatReal(c.saldo_atual || 0)} — id:${c.id}\n`; });
    msg += "\nDigite o número da conta (ex: 1) ou deixe vazio para usar a conta do lançamento:";
    const resposta = prompt(msg, "");

    let contaEscolhidaId = null;
    if (!resposta || resposta.trim() === "") contaEscolhidaId = item.conta_id;
    else {
      const num = parseInt(resposta, 10);
      if (!isNaN(num) && num >= 1 && num <= contas.length) contaEscolhidaId = contas[num - 1].id;
      else {
        const found = contas.find(c => String(c.id) === resposta.trim());
        if (found) contaEscolhidaId = found.id;
        else return alert("Entrada inválida. Operação cancelada.");
      }
    }

    // obter conta atual
    const { data: conta, error: errConta } = await supabase.from("contas_bancarias").select("*").eq("id", contaEscolhidaId).single();
    if (errConta) throw errConta;

    let novoSaldo = parseFloat(conta.saldo_atual || 0);
    if (type === "receita") novoSaldo += parseFloat(item.valor);
    else novoSaldo -= parseFloat(item.valor);

    const { error: errUpdate } = await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaEscolhidaId);
    if (errUpdate) throw errUpdate;

    const table = type === "receita" ? "receitas" : "despesas";
    const { error: errLanc } = await supabase.from(table).update({ baixado: true, data_baixa: new Date().toISOString().slice(0, 10) }).eq("id", item.id);
    if (errLanc) throw errLanc;

    const movPayload = {
      user_id: currentUser.id,
      conta_id: contaEscolhidaId,
      tipo: type === "receita" ? "credito" : "debito",
      valor: item.valor,
      descricao: `Baixa de "${item.descricao}"`,
      data: new Date().toISOString().slice(0, 10),
      lancamento_id: item.id
    };
    const { error: errMov } = await supabase.from("movimentacoes").insert([movPayload]);
    if (errMov) throw errMov;

    alert("Lançamento baixado com sucesso!");
    refreshMovements();
    if (selectExtrato && selectExtrato.value === String(contaEscolhidaId)) renderExtrato();
  } catch (err) {
    console.error("Erro baixarLancamento:", err);
    alert("Erro ao baixar lançamento: " + (err.message || JSON.stringify(err)));
  }
}

// -------------------------
// CANCELAR BAIXA: reverte movimentacao + saldo + lançamento
// -------------------------
async function cancelarBaixaMovimentacao(mov) {
  try {
    if (!confirm("Deseja cancelar esta baixa?")) return;

    // 1) buscar conta atual
    const { data: conta, error: errConta } = await supabase.from("contas_bancarias").select("*").eq("id", mov.conta_id).single();
    if (errConta) throw errConta;

    let novoSaldo = parseFloat(conta.saldo_atual || 0);
    if (mov.tipo === "credito") novoSaldo -= parseFloat(mov.valor);
    else novoSaldo += parseFloat(mov.valor);

    const { error: errSaldo } = await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", mov.conta_id);
    if (errSaldo) throw errSaldo;

    // 2) remover movimentacao
    const { error: errDel } = await supabase.from("movimentacoes").delete().eq("id", mov.id);
    if (errDel) throw errDel;

    // 3) marcar lançamento como não baixado (tenta nas duas tabelas)
    if (mov.lancamento_id) {
      await supabase.from("receitas").update({ baixado: false, data_baixa: null }).eq("id", mov.lancamento_id);
      await supabase.from("despesas").update({ baixado: false, data_baixa: null }).eq("id", mov.lancamento_id);
    }

    alert("Baixa cancelada e saldo revertido.");
    refreshMovements();
    renderExtrato();
  } catch (err) {
    console.error("Erro cancelarBaixaMovimentacao:", err);
    alert("Erro ao cancelar baixa: " + (err.message || JSON.stringify(err)));
  }
}

// -------------------------
// REALTIME
// -------------------------
function subscribeToChanges() {
  try {
    supabase.channel("rt_receitas").on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, payload => {
      if (payload.record?.user_id === currentUser.id) refreshMovements();
    }).subscribe();

    supabase.channel("rt_despesas").on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, payload => {
      if (payload.record?.user_id === currentUser.id) refreshMovements();
    }).subscribe();

    supabase.channel("rt_contas").on("postgres_changes", { event: "*", schema: "public", table: "contas_bancarias" }, payload => {
      refreshMovements(); renderExtrato();
    }).subscribe();

    supabase.channel("rt_movimentacoes").on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, payload => {
      renderExtrato();
    }).subscribe();
  } catch (err) {
    console.error("Erro subscribeToChanges:", err);
  }
}

// -------------------------
// SISTEMA DE TELAS (menu superior)
// -------------------------
function showScreen(target) {
  telaDashboard.classList.add("hidden"); telaContas.classList.add("hidden"); telaLanc.classList.add("hidden");
  btnDash.classList.remove("active"); btnContas.classList.remove("active"); btnLanc.classList.remove("active");
  if (target === "dashboard") { telaDashboard.classList.remove("hidden"); btnDash.classList.add("active"); }
  else if (target === "contas") { telaContas.classList.remove("hidden"); btnContas.classList.add("active"); }
  else if (target === "lanc") { telaLanc.classList.remove("hidden"); btnLanc.classList.add("active"); }
}
btnDash.onclick = () => { showScreen("dashboard"); loadDashboard(); };
btnContas.onclick = () => showScreen("contas");
btnLanc.onclick = () => showScreen("lanc");

// -------------------------
// ABAS DENTRO DE CONTAS
// -------------------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    if (tab === "cadastro") { tabCadastro.classList.remove("hidden"); tabExtrato.classList.add("hidden"); }
    else { tabCadastro.classList.add("hidden"); tabExtrato.classList.remove("hidden"); }
  };
});

// -------------------------
// EXTRATO (misturado por data: receitas + despesas + movimentacoes)
// -------------------------
if (btnFiltrarExtrato) btnFiltrarExtrato.onclick = () => renderExtrato();

async function renderExtrato() {
  try {
    const conta_id = selectExtrato.value;
    const now = new Date();

    // período
    let inicio = null, fim = null;
    const periodo = periodoExtrato.value;
    if (periodo === "mes_atual") {
      inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-01`;
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if (periodo === "mes_anterior") {
      const ano = now.getFullYear(); const mes = now.getMonth();
      inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
      const last = new Date(ano, mes, 0).getDate();
      fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if (periodo === "ultimos_30") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      inicio = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2,"0")}-${String(past.getDate()).padStart(2,"0")}`;
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    } else if (periodo === "personalizado") {
      inicio = dataInicio.value; fim = dataFim.value;
    } else {
      // default mês atual
      inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-01`;
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    }

    // buscar dados
    const [recRes, despRes, movRes] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id", conta_id).gte("data", inicio).lte("data", fim).order("data"),
      supabase.from("despesas").select("*").eq("conta_id", conta_id).gte("data", inicio).lte("data", fim).order("data"),
      supabase.from("movimentacoes").select("*").eq("conta_id", conta_id).gte("data", inicio).lte("data", fim).order("data")
    ]);

    const rec = recRes.data || [];
    const desp = despRes.data || [];
    const mov = movRes.data || [];

    const unified = [];

    rec.forEach(r => unified.push({ id: `r-${r.id}`, tipo_item: 'receita', data: r.data, descricao: r.descricao, valor: Number(r.valor || 0), original: r }));
    desp.forEach(d => unified.push({ id: `d-${d.id}`, tipo_item: 'despesa', data: d.data, descricao: d.descricao, valor: Number(d.valor || 0), original: d }));
    mov.forEach(mv => unified.push({ id: `m-${mv.id}`, tipo_item: 'movimentacao', data: mv.data, descricao: mv.descricao, valor: Number(mv.valor || 0), mov: mv }));

    // ordenar por data asc
    unified.sort((a, b) => new Date(a.data + "T00:00:00") - new Date(b.data + "T00:00:00"));

    // render tabela
    tableExtrato.innerHTML = "";
    let totalReceitas = 0, totalDespesas = 0;

    unified.forEach(row => {
      const tr = document.createElement("tr");
      const actionsTd = document.createElement("td");
      actionsTd.classList.add("actions");

      if (row.tipo_item === "receita") {
        tr.innerHTML = `<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td class="tipo-receita">Receita</td><td>${formatReal(row.valor)}</td>`;
        totalReceitas += row.valor;
      } else if (row.tipo_item === "despesa") {
        tr.innerHTML = `<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td class="tipo-despesa">Despesa</td><td>${formatReal(row.valor)}</td>`;
        totalDespesas += row.valor;
      } else if (row.tipo_item === "movimentacao") {
        // estilo bancário
        const tipoText = row.mov.tipo === "credito" ? "Crédito" : "Débito";
        tr.innerHTML = `<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td class="tipo-mov">Movimentação</td><td>${formatReal(row.valor)}</td>`;
        // botão cancelar baixa (se tiver lancamento)
        if (row.mov && row.mov.lancamento_id) {
          const btn = document.createElement("button");
          btn.textContent = "Cancelar Baixa";
          btn.onclick = () => cancelarBaixaMovimentacao(row.mov);
          actionsTd.appendChild(btn);
        }
      }

      tr.appendChild(actionsTd);
      tableExtrato.appendChild(tr);
    });

    totalReceitasExtrato.textContent = formatReal(totalReceitas);
    totalDespesasExtrato.textContent = formatReal(totalDespesas);
    totalValorExtrato.textContent = formatReal(totalReceitas - totalDespesas);
    saldoPeriodoExtrato.textContent = formatReal(totalReceitas - totalDespesas);

    // saldo atual da conta
    const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id", conta_id).single();
    if (conta) saldoAtualContaExtrato.textContent = formatReal(conta.saldo_atual || 0);
  } catch (err) {
    console.error("Erro renderExtrato:", err);
  }
}

// -------------------------
// DASHBOARD
// -------------------------
async function loadDashboard() {
  try {
    const agora = new Date(); const ano = agora.getFullYear(); const mes = agora.getMonth() + 1;
    const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2, "0")}-${ultimoDia}`;

    const receitas = await supabase.from("receitas").select("*").eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim);
    const despesas = await supabase.from("despesas").select("*").eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim);

    const totalR = (receitas.data || []).reduce((s, r) => s + Number(r.valor || 0), 0);
    const totalD = (despesas.data || []).reduce((s, d) => s + Number(d.valor || 0), 0);

    document.getElementById("dash-period").textContent = `${mes}/${ano}`;
    document.getElementById("dash-receber").textContent = formatReal(totalR);
    document.getElementById("dash-pagar").textContent = formatReal(totalD);
    document.getElementById("dash-saldo-atual").textContent = formatReal(totalR - totalD);
    document.getElementById("dash-saldo-previsto").textContent = formatReal(totalR - totalD);

    generateDashboardChart(totalR, totalD);
  } catch (err) {
    console.error("Erro loadDashboard:", err);
  }
}
function generateDashboardChart(receitas, despesas) {
  try {
    const ctx = document.getElementById("chart-dashboard");
    if (!ctx) return;
    if (chartDashboard) chartDashboard.destroy();
    chartDashboard = new Chart(ctx, {
      type: "bar",
      data: { labels: ["Receitas", "Despesas"], datasets: [{ label: "Resumo do mês", data: [receitas, despesas], backgroundColor: ["green", "red"] }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  } catch (err) { console.error("Erro generateDashboardChart:", err); }
}

// -------------------------
// SUBSCRIBE REALTIME
// -------------------------
function subscribeToChanges() {
  try {
    supabase.channel("rt_receitas").on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, payload => {
      if (payload.record?.user_id === currentUser.id) refreshMovements();
    }).subscribe();
    supabase.channel("rt_despesas").on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, payload => {
      if (payload.record?.user_id === currentUser.id) refreshMovements();
    }).subscribe();
    supabase.channel("rt_contas").on("postgres_changes", { event: "*", schema: "public", table: "contas_bancarias" }, payload => {
      refreshMovements(); renderExtrato();
    }).subscribe();
    supabase.channel("rt_movimentacoes").on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, payload => {
      renderExtrato();
    }).subscribe();
  } catch (err) { console.error("Erro subscribeToChanges:", err); }
}

// -------------------------
// INICIALIZAÇÃO / OBSERVERS
// -------------------------
showScreen("contas");
if (selectContas) selectContas.onchange = () => refreshMovements();
if (selectContaLanc) selectContaLanc.onchange = () => { /* só altera formulário */ };
if (selectExtrato) selectExtrato.onchange = () => renderExtrato();
if (periodoExtrato) periodoExtrato.onchange = () => {
  if (periodoExtrato.value === "personalizado") { dataInicio.classList.remove("hidden"); dataFim.classList.remove("hidden"); }
  else { dataInicio.classList.add("hidden"); dataFim.classList.add("hidden"); }
};
