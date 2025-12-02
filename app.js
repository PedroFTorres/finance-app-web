// ========================= HELPERS =========================

function formatDate(d) {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  return String(x.getDate()).padStart(2, "0") + "/" +
         String(x.getMonth() + 1).padStart(2, "0") + "/" +
         x.getFullYear();
}

function formatReal(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}


// ========================= VARIÁVEIS GLOBAIS =========================

let currentUser = null;
let editing = { type: null, id: null };

let lancamentoParaBaixa = null; // ← usado pelo modal

let chartDashboard = null;
let chartRecCat = null;
let chartDesCat = null;


// ========================= ELEMENTOS =========================

// Telas
const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

// Menus
const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

// Inputs conta
const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const contaDataSaldo = document.getElementById("conta-data-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

// Inputs lançamentos
const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const categoriaLanc = document.getElementById("categoria-lanc");
const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const selectContaLanc = document.getElementById("select-conta-lanc");

// Totais
const saldoAtualEl = document.getElementById("saldo-atual");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

// Listas
const listReceitas = document.getElementById("list-receitas");
const listDespesas = document.getElementById("list-despesas");

// Extrato
const tabCadastro = document.getElementById("tab-cadastro");
const tabExtrato = document.getElementById("tab-extrato");
const tabCategorias = document.getElementById("tab-categorias");

const selectExtrato = document.getElementById("select-contas-extrato");
const periodoExtrato = document.getElementById("periodo-extrato");
const dataInicio = document.getElementById("data-inicio");
const dataFim = document.getElementById("data-fim");
const btnFiltrarExtrato = document.getElementById("btn-filtrar-extrato");

let tableExtrato = null;


// Modal de baixa
const modal = document.getElementById("modal-baixa");
const dataBaixaInput = document.getElementById("data-baixa");
const jurosInput = document.getElementById("juros-baixa");
const descontoInput = document.getElementById("desconto-baixa");
const contaBaixaSelect = document.getElementById("conta-baixa-select");
const confirmarBaixaBtn = document.getElementById("confirmar-baixa");
const cancelarBaixaBtn = document.getElementById("cancelar-baixa");


// ========================= LOGIN =========================

supabase.auth.getSession().then(({ data }) => {
  if (!data.session) return window.location.href = "login.html";
  currentUser = data.session.user;
  document.getElementById("user-email").textContent = currentUser.email;
  initApp();
});

document.getElementById("btn-logout").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};


// ========================= INÍCIO DO APP =========================

async function initApp() {
  await loadCategorias();
  await loadContas();

  subscribeToChanges();

  document.addEventListener("DOMContentLoaded", () => {
    const t = document.getElementById("table-extrato");
    if (t) tableExtrato = t.querySelector("tbody");
  });

  showScreen("contas");
}
// ========================= CATEGORIAS =========================

async function loadCategorias() {
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  categoriaLanc.innerHTML = "";
  listaCategorias.innerHTML = "";

  (data || []).forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.nome;
    categoriaLanc.appendChild(opt);

    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";

    const span = document.createElement("span");
    span.textContent = cat.nome;

    const btn = document.createElement("button");
    btn.textContent = "Excluir";
    btn.onclick = () => deleteCategoria(cat.id);

    li.appendChild(span);
    li.appendChild(btn);
    listaCategorias.appendChild(li);
  });
}

btnAddCategoria.onclick = async () => {
  const nome = categoriaNome.value.trim();
  if (!nome) return alert("Informe o nome da categoria.");

  await supabase.from("categorias")
    .insert([{ id: crypto.randomUUID(), nome }]);

  categoriaNome.value = "";
  await loadCategorias();
};

async function deleteCategoria(id) {
  if (!confirm("Excluir categoria?")) return;

  await supabase.from("categorias").delete().eq("id", id);
  await supabase.from("receitas").update({ categoria_id: null }).eq("categoria_id", id);
  await supabase.from("despesas").update({ categoria_id: null }).eq("categoria_id", id);

  await loadCategorias();
}


// ========================= CONTAS =========================

async function loadContas() {
  const { data } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id);

  selectContas.innerHTML = "";
  selectExtrato.innerHTML = "";
  selectContaLanc.innerHTML = "";

  (data || []).forEach(c => {
    selectContas.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_inicial)})`, c.id));
    selectExtrato.appendChild(new Option(c.nome, c.id));
    selectContaLanc.appendChild(new Option(c.nome, c.id));
  });

  if (data?.length) {
    selectContas.value = data[0].id;
    selectExtrato.value = data[0].id;
    selectContaLanc.value = data[0].id;

    await recalcularSaldo(selectContas.value);
    await refreshLancamentos();
  }
}


// ========================= SALDO =========================

async function recalcularSaldo(conta_id) {
  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("saldo_inicial")
    .eq("id", conta_id)
    .maybeSingle();

  const si = Number(conta?.saldo_inicial || 0);

  const { data: movs } = await supabase
    .from("movimentacoes")
    .select("tipo,valor")
    .eq("conta_id", conta_id);

  let c = 0, d = 0;

  (movs || []).forEach(m => {
    const v = Number(m.valor || 0);
    if (m.tipo === "credito") c += v;
    else d += v;
  });

  const sf = si + c - d;

  await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: sf })
    .eq("id", conta_id);

  return sf;
}
// ========================= PARTE 5 — SUBSCRIBE, NAV, INICIALIZAÇÃO =========================

// subscribe
function subscribeToChanges() {
  supabase.channel("rec")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, () => refreshLancamentos())
    .subscribe();

  supabase.channel("des")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, () => refreshLancamentos())
    .subscribe();

  supabase.channel("mov")
    .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => renderExtrato())
    .subscribe();

  supabase.channel("cats")
    .on("postgres_changes", { event: "*", schema: "public", table: "categorias" }, () => loadCategorias())
    .subscribe();
}

// telas / navegação
function showScreen(s) {
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  if (s === "dashboard") {
    telaDashboard.classList.remove("hidden");
    btnDash.classList.add("active");
    loadDashboard();
  } else if (s === "contas") {
    telaContas.classList.remove("hidden");
    btnContas.classList.add("active");
  } else {
    telaLanc.classList.remove("hidden");
    btnLanc.classList.add("active");
  }
}

btnDash.onclick = () => showScreen("dashboard");
btnContas.onclick = () => showScreen("contas");
btnLanc.onclick = () => showScreen("lanc");

document.querySelectorAll(".tab-btn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");

    tabCadastro.classList.add("hidden");
    tabExtrato.classList.add("hidden");
    tabCategorias.classList.add("hidden");

    if (b.dataset.tab === "cadastro") tabCadastro.classList.remove("hidden");
    if (b.dataset.tab === "extrato") { tabExtrato.classList.remove("hidden"); renderExtrato(); }
    if (b.dataset.tab === "categorias") tabCategorias.classList.remove("hidden");
  };
});

periodoLanc.onchange = () => {
  if (periodoLanc.value === "personalizado") {
    dataInicioLanc.classList.remove("hidden");
    dataFimLanc.classList.remove("hidden");
  } else {
    dataInicioLanc.classList.add("hidden");
    dataFimLanc.classList.add("hidden");
  }
};

periodoExtrato.onchange = () => {
  if (periodoExtrato.value === "personalizado") {
    dataInicio.classList.remove("hidden");
    dataFim.classList.remove("hidden");
  } else {
    dataInicio.classList.add("hidden");
    dataFim.classList.add("hidden");
  }
};

// inicialização final (garantia)
(async function finalInit() {
  // já carregados no initApp, só reforçar caso a ordem de carregamento mude
  if (!currentUser) {
    const s = await supabase.auth.getSession();
    if (!s?.data?.session) return window.location.href = "login.html";
    currentUser = s.data.session.user;
    document.getElementById("user-email").textContent = currentUser.email;
  }

  // garantir selects/cartões etc caso outros módulos usem
  await loadCategorias();
  await loadContas();

  // setar handlers do modal caso não estejam setados (defensivo)
  confirmarBaixaBtn.onclick = confirmarBaixaBtn.onclick || confirmarBaixaBtn.onclick;
  cancelarBaixaBtn.onclick = cancelarBaixaBtn.onclick || cancelarBaixaBtn.onclick;

  // render inicial
  showScreen("contas");
})();
