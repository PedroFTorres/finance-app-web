// ========================= HELPERS =========================

function formatDate(d) {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  return (
    String(x.getDate()).padStart(2, "0") +
    "/" +
    String(x.getMonth() + 1).padStart(2, "0") +
    "/" +
    x.getFullYear()
  );
}

function formatReal(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
// ========================= VARIÁVEIS GLOBAIS =========================

let currentUser = null;
let editing = { type: null, id: null };
let lancamentoParaBaixa = null;

let chartDashboard = null;
let chartRecCat = null;
let chartDesCat = null;

// ========================= ELEMENTOS DO DOM =========================
// --- elementos faltantes relacionados a lançamentos (filtrar / período personalizado)
const periodoLanc = document.getElementById("periodo-lanc");
const dataInicioLanc = document.getElementById("data-inicio-lanc");
const dataFimLanc = document.getElementById("data-fim-lanc");
const btnFiltrarLanc = document.getElementById("btn-filtrar-lanc");

// Telas
const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

// Menus topo
const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

// Contas
const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const contaDataSaldo = document.getElementById("conta-data-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

// Categorias
const categoriaNome = document.getElementById("categoria-nome");
const btnAddCategoria = document.getElementById("btn-add-categoria");
const listaCategorias = document.getElementById("lista-categorias");

// Lançamentos
const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const categoriaLanc = document.getElementById("categoria-lanc");
const selectContaLanc = document.getElementById("select-conta-lanc");

const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// Totais e listas
const saldoAtualEl = document.getElementById("saldo-atual");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

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

// ========================= EXTRATO TABLE (CORREÇÃO) =========================

const extratoTableElement = document.getElementById("table-extrato");

// tbody do extrato:
let tableExtrato = null;

if (extratoTableElement) {
    tableExtrato = extratoTableElement.querySelector("tbody");
} else {
    console.warn("⚠️ table-extrato NÃO encontrado no DOM. Verifique o app.html.");
}


// Modal baixa
const modalBaixa = document.getElementById("modal-baixa");
const dataBaixaInput = document.getElementById("data-baixa");
const jurosInput = document.getElementById("juros-baixa");
const descontoInput = document.getElementById("desconto-baixa");
const contaBaixaSelect = document.getElementById("conta-baixa-select");
const confirmarBaixaBtn = document.getElementById("confirmar-baixa");
const cancelarBaixaBtn = document.getElementById("cancelar-baixa");

// ========================= LOGIN =========================

supabase.auth.getSession().then(({ data }) => {
  if (!data.session) return (window.location.href = "login.html");
  currentUser = data.session.user;
  document.getElementById("user-email").textContent = currentUser.email;
  initApp();
});

document.getElementById("btn-logout").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// ========================= INICIALIZAÇÃO =========================
async function initApp() {

  // esconde todas as telas
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  await loadCategorias();
  await loadContas();
  subscribeToChanges();

  // tabela do extrato
  const t = document.getElementById("table-extrato");
  if (t) tableExtrato = t.querySelector("tbody");

  // tela inicial correta
  showScreen("dashboard");
}

// ========================= CATEGORIAS =========================

async function loadCategorias() {
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  categoriaLanc.innerHTML = "";
  listaCategorias.innerHTML = "";

  (data || []).forEach((cat) => {
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

  await supabase
    .from("categorias")
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

// ➕ Adicionar opção "Todas as contas"
selectContas.appendChild(new Option("Todas as Contas", "all"));
selectExtrato.appendChild(new Option("Todas as Contas", "all"));


  (data || []).forEach((c) => {
    selectContas.appendChild(
      new Option(`${c.nome} (${formatReal(c.saldo_inicial)})`, c.id)
    );
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

btnAddConta.onclick = async () => {
  const nome = contaNome.value.trim();
  const saldo = Number(contaSaldo.value || 0);
  const data_saldo = contaDataSaldo.value;

  if (!nome) return alert("Informe o nome da conta.");
  if (!data_saldo) return alert("Informe a data do saldo.");

  await supabase.from("contas_bancarias").insert([
    {
      id: crypto.randomUUID(),
      nome,
      saldo_inicial: saldo,
      saldo_atual: saldo,
      data_saldo,
      user_id: currentUser.id,
    },
  ]);

  contaNome.value = "";
  contaSaldo.value = "";
  contaDataSaldo.value = "";

  await loadContas();
};


// ========================= RECALCULAR SALDO =========================

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

  let c = 0;
  let d = 0;

  (movs || []).forEach((m) => {
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
// ========================= LANÇAMENTOS — ADICIONAR =========================

btnAddLanc.onclick = async () => {
  const desc = descLanc.value.trim();
  const valor = Number(valorLanc.value || 0);
  const data = dataLanc.value;
  const tipo = tipoLanc.value;
  const conta_id = selectContaLanc.value;
  const categoria_id = categoriaLanc.value;

  if (!desc || !valor || !data)
    return alert("Preencha todos os campos do lançamento.");

  // ========================= EDIÇÃO =========================
  if (editing.type) {
    const tabela = editing.type === "receita" ? "receitas" : "despesas";

    await supabase
      .from(tabela)
      .update({
        descricao: desc,
        valor,
        data,
        conta_id,
        categoria_id,
      })
      .eq("id", editing.id);

    stopEdit();
    await refreshLancamentos();
    await renderExtrato();
    return;
  }

  // tabela correspondente
  const tabela = tipo === "receita" ? "receitas" : "despesas";

  // ========================= RECORRÊNCIA =========================
  const tipoRec = document.getElementById("recorrencia-tipo").value;
  const parcelas = Number(
    document.getElementById("recorrencia-parcelas").value || 1
  );

  if (tipoRec !== "none" && parcelas > 1) {
    let dataAtual = new Date(data + "T00:00:00");

    for (let i = 0; i < parcelas; i++) {
      const dataFormatada =
        dataAtual.getFullYear() +
        "-" +
        String(dataAtual.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(dataAtual.getDate()).padStart(2, "0");

      await supabase.from(tabela).insert([
        {
          id: crypto.randomUUID(),
          descricao: `${desc} (${i + 1}/${parcelas})`,
          valor,
          data: dataFormatada,
          conta_id,
          categoria_id,
          user_id: currentUser.id,
          baixado: false,
        },
      ]);

      // avançar a data
      if (tipoRec === "monthly") dataAtual.setMonth(dataAtual.getMonth() + 1);
      else if (tipoRec === "fortnight")
        dataAtual.setDate(dataAtual.getDate() + 15);
      else if (tipoRec === "weekly")
        dataAtual.setDate(dataAtual.getDate() + 7);
      else if (tipoRec === "annual")
        dataAtual.setFullYear(dataAtual.getFullYear() + 1);
    }

    // limpar campos
    descLanc.value = "";
    valorLanc.value = "";
    dataLanc.value = "";

    await refreshLancamentos();
    await renderExtrato();
    return;
  }

  // ========================= LANÇAMENTO NORMAL =========================

  await supabase.from(tabela).insert([
    {
      id: crypto.randomUUID(),
      descricao: desc,
      valor,
      data,
      conta_id,
      categoria_id,
      user_id: currentUser.id,
      baixado: false,
    },
  ]);

  descLanc.value = "";
  valorLanc.value = "";
  dataLanc.value = "";

  await refreshLancamentos();
  await renderExtrato();
};


// ========================= EDIÇÃO =========================

function startEdit(type, item) {
  editing = { type, id: item.id };
  tipoLanc.value = type;
  valorLanc.value = item.valor;
  descLanc.value = item.descricao;
  dataLanc.value = item.data;
  selectContaLanc.value = item.conta_id;
  categoriaLanc.value = item.categoria_id || "";

  btnAddLanc.textContent = "Salvar";
  btnCancelEdit.classList.remove("hidden");
}

function stopEdit() {
  editing = { type: null, id: null };
  descLanc.value = "";
  valorLanc.value = "";
  dataLanc.value = "";

  btnAddLanc.textContent = "Adicionar";
  btnCancelEdit.classList.add("hidden");
}

btnCancelEdit.onclick = () => stopEdit();


// ========================= EXCLUIR LANÇAMENTO =========================

async function deleteItem(type, id) {
  if (!confirm("Excluir este lançamento?")) return;

  const tabela = type === "receita" ? "receitas" : "despesas";

  await supabase.from(tabela).delete().eq("id", id);

  // remover movimentação vinculada
  const { data: mv } = await supabase
    .from("movimentacoes")
    .select("id,conta_id")
    .eq("lancamento_id", id)
    .maybeSingle();

  if (mv) {
    await supabase.from("movimentacoes").delete().eq("id", mv.id);
    await recalcularSaldo(mv.conta_id);
  }

  await refreshLancamentos();
  await renderExtrato();
}


// ========================= REFRESH LANÇAMENTOS =========================

btnFiltrarLanc.onclick = () => refreshLancamentos();

async function refreshLancamentos() {
  const conta_id = selectContas.value;

  const now = new Date();
  let inicio, fim;
  const p = periodoLanc.value;

  if (p === "mes_atual") {
    inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;
    const last = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${last}`;
  } else if (p === "mes_anterior") {
    const ano = now.getFullYear();
    const mes = now.getMonth();
    inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const last = new Date(ano, mes, 0).getDate();
    fim = `${ano}-${String(mes).padStart(2, "0")}-${last}`;
  } else if (p === "ultimos_30") {
    const past = new Date(now.getTime() - 30 * 86400000);
    inicio = past.toISOString().slice(0, 10);
    fim = now.toISOString().slice(0, 10);
  } else {
    inicio = dataInicioLanc.value;
    fim = dataFimLanc.value;
  }

 let queryRec, queryDes;

if (conta_id === "all") {
  // Buscar receitas de todas as contas
  queryRec = supabase
    .from("receitas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");

  // Buscar despesas de todas as contas (inclui conta_id null)
  queryDes = supabase
    .from("despesas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");

} else {
  // Buscar receitas da conta selecionada
  queryRec = supabase
    .from("receitas")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("conta_id", conta_id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");

  // Buscar despesas da conta selecionada
  queryDes = supabase
    .from("despesas")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("conta_id", conta_id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");
}

const [R, D] = await Promise.all([queryRec, queryDes]);


  listReceitas.innerHTML = "";
  listDespesas.innerHTML = "";

  let tr = 0;
  let td = 0;

  (R.data || []).forEach((i) => {
    tr += Number(i.valor || 0);
    listReceitas.appendChild(buildLancItem(i, "receita"));
  });

  (D.data || []).forEach((i) => {
    td += Number(i.valor || 0);
    listDespesas.appendChild(buildLancItem(i, "despesa"));
  });

  totalReceitasEl.textContent = formatReal(tr);
  totalDespesasEl.textContent = formatReal(td);

  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("saldo_atual")
    .eq("id", conta_id)
    .maybeSingle();

  saldoAtualEl.textContent = formatReal(conta?.saldo_atual || 0);

  await recalcularSaldo(conta_id);
}


// ========================= CRIAR ITEM NA LISTA =========================

function buildLancItem(item, type) {
  const li = document.createElement("li");
  li.style.display = "flex";
  li.style.justifyContent = "space-between";

  const left = document.createElement("div");
  const right = document.createElement("div");

  left.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(
    item.valor
  )}`;
  if (item.baixado) left.textContent += " — (BAIXADO)";

  const b1 = document.createElement("button");
  b1.textContent = "Editar";
  b1.onclick = () => startEdit(type, item);

  const b2 = document.createElement("button");
  b2.textContent = "Excluir";
  b2.onclick = () => deleteItem(type, item.id);

  right.appendChild(b1);
  right.appendChild(b2);

  if (!item.baixado) {
    const b3 = document.createElement("button");
    b3.textContent = "Baixar";
    b3.onclick = () => baixarLancamento(type, item);
    right.appendChild(b3);
  }

  li.appendChild(left);
  li.appendChild(right);

  return li;
}
// ========================= BAIXAR LANÇAMENTO (ABRIR MODAL) =========================

async function baixarLancamento(type, item) {
  lancamentoParaBaixa = { type, item };

  // carregar contas no select
  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("user_id", currentUser.id);

  contaBaixaSelect.innerHTML = "";
  (contas || []).forEach((c) => {
    contaBaixaSelect.appendChild(
      new Option(
        `${c.nome} (${formatReal(c.saldo_atual || c.saldo_inicial)})`,
        c.id
      )
    );
  });

  // valores iniciais
  dataBaixaInput.value = new Date().toISOString().slice(0, 10);
  jurosInput.value = "";
  descontoInput.value = "";

  // abrir modal
  modalBaixa.classList.remove("hidden");
}


// ========================= CONFIRMAR BAIXA — MODAL =========================

confirmarBaixaBtn.onclick = async () => {
  if (!lancamentoParaBaixa)
    return alert("Nenhum lançamento selecionado para baixa.");

  const dataBaixa = dataBaixaInput.value;
  const juros = Number(jurosInput.value || 0);
  const desconto = Number(descontoInput.value || 0);
  const conta_id = contaBaixaSelect.value;

  const { type, item } = lancamentoParaBaixa;

  // pegar conta existente
  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("id", conta_id)
    .single();

  let novoSaldo = Number(conta.saldo_atual || 0);

  // ajustar saldo
  if (type === "receita") novoSaldo += Number(item.valor);
  else novoSaldo -= Number(item.valor);

  await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: novoSaldo })
    .eq("id", conta_id);

  // marcar lançamento como baixado
  const tabela = type === "receita" ? "receitas" : "despesas";

  await supabase
    .from(tabela)
    .update({ baixado: true, data_baixa: dataBaixa })
    .eq("id", item.id);

  // inserir movimentação principal
  const movId = crypto.randomUUID();
  await supabase.from("movimentacoes").insert([
    {
      id: movId,
      user_id: currentUser.id,
      conta_id,
      tipo: type === "receita" ? "credito" : "debito",
      valor: item.valor,
      descricao: item.descricao,
      data: dataBaixa,
      lancamento_id: item.id,
    },
  ]);

  // ========================= JUROS (DESPESA) =========================
  if (juros > 0) {
    const catId = await getOrCreateCategoria("Juros/Multa");
    const despId = crypto.randomUUID();

    // cria despesa juros
    await supabase.from("despesas").insert([
      {
        id: despId,
        user_id: currentUser.id,
        conta_id,
        descricao: `Juros/Multa — ${item.descricao}`,
        valor: juros,
        data: dataBaixa,
        categoria_id: catId,
        baixado: true,
        data_baixa: dataBaixa,
      },
    ]);

    // movimentação débito
    await supabase.from("movimentacoes").insert([
      {
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        conta_id,
        tipo: "debito",
        valor: juros,
        descricao: `Juros/Multa — ${item.descricao}`,
        data: dataBaixa,
        lancamento_id: despId,
      },
    ]);

    novoSaldo -= juros;
    await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: novoSaldo })
      .eq("id", conta_id);
  }

  // ========================= DESCONTO (RECEITA) =========================
  if (desconto > 0) {
    const catId = await getOrCreateCategoria("Desconto");
    const recId = crypto.randomUUID();

    await supabase.from("receitas").insert([
      {
        id: recId,
        user_id: currentUser.id,
        conta_id,
        descricao: `Desconto — ${item.descricao}`,
        valor: desconto,
        data: dataBaixa,
        categoria_id: catId,
        baixado: true,
        data_baixa: dataBaixa,
      },
    ]);

    // movimentação crédito
    await supabase.from("movimentacoes").insert([
      {
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        conta_id,
        tipo: "credito",
        valor: desconto,
        descricao: `Desconto — ${item.descricao}`,
        data: dataBaixa,
        lancamento_id: recId,
      },
    ]);

    novoSaldo += desconto;
    await supabase
      .from("contas_bancarias")
      .update({ saldo_atual: novoSaldo })
      .eq("id", conta_id);
  }

  // fechar modal
  modalBaixa.classList.add("hidden");
  lancamentoParaBaixa = null;

  await recalcularSaldo(conta_id);
  await refreshLancamentos();
  await renderExtrato();
};


// ========================= CANCELAR MODAL =========================

cancelarBaixaBtn.onclick = () => {
  modalBaixa.classList.add("hidden");
  lancamentoParaBaixa = null;
};


// ========================= GET OR CREATE CATEGORIA =========================

async function getOrCreateCategoria(nome) {
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .eq("nome", nome)
    .maybeSingle();

  if (data) return data.id;

  const created = await supabase
    .from("categorias")
    .insert([{ id: crypto.randomUUID(), nome }])
    .select()
    .maybeSingle();

  return created?.data?.id || created?.id;
}
// ========================= EXTRATO — FILTRAR =========================

btnFiltrarExtrato.onclick = () => renderExtrato();

async function renderExtrato() {
  const conta_id = selectExtrato.value;
  if (!conta_id || !tableExtrato) return;

  await recalcularSaldo(conta_id);

  const now = new Date();
  let inicio, fim;
  const p = periodoExtrato.value;

  if (p === "mes_atual") {
    inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;
    const last = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    fim = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${last}`;
  } else if (p === "mes_anterior") {
    const ano = now.getFullYear();
    const mes = now.getMonth();
    inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const last = new Date(ano, mes, 0).getDate();
    fim = `${ano}-${String(mes).padStart(2, "0")}-${last}`;
  } else if (p === "ultimos_30") {
    const past = new Date(now.getTime() - 30 * 86400000);
    inicio = past.toISOString().slice(0, 10);
    fim = now.toISOString().slice(0, 10);
  } else {
    inicio = dataInicio.value;
    fim = dataFim.value;
  }

  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("saldo_inicial,data_saldo,saldo_atual")
    .eq("id", conta_id)
    .single();

  const si = Number(conta.saldo_inicial || 0);
  const dataInicial = conta.data_saldo;

  // puxar movimentações
 let movQuery;

if (conta_id === "all") {
  movQuery = supabase
    .from("movimentacoes")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");
} else {
  movQuery = supabase
    .from("movimentacoes")
    .select("*")
    .eq("conta_id", conta_id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data");
}

const { data: movs } = await movQuery;


  const linhas = [];

  // saldo inicial
  if (si !== 0 && dataInicial)
    linhas.push({
      tipo: "inicial",
      data: dataInicial,
      descricao: "SALDO INICIAL",
      valor: si,
    });

  (movs || []).forEach((m) => {
    linhas.push({
      tipo: "mov",
      data: m.data,
      descricao: m.descricao,
      valor: m.valor,
      mov: m,
    });
  });

  // ordenar
  linhas.sort((a, b) => new Date(a.data) - new Date(b.data));

  tableExtrato.innerHTML = "";

  let cred = 0;
  let deb = 0;

  linhas.forEach((l) => {
    const tr = document.createElement("tr");
    const tdAcoes = document.createElement("td");

    // linha de saldo inicial
    if (l.tipo === "inicial") {
      tr.innerHTML = `
        <td>${formatDate(l.data)}</td>
        <td>${l.descricao}</td>
        <td>Crédito</td>
        <td>${formatReal(l.valor)}</td>
      `;
      cred += l.valor;
    } else {
      tr.innerHTML = `
        <td>${formatDate(l.data)}</td>
        <td>${l.descricao}</td>
        <td>${l.mov.tipo === "credito" ? "Crédito" : "Débito"}</td>
        <td>${formatReal(l.valor)}</td>
      `;

      if (l.mov.tipo === "credito") cred += l.valor;
      else deb += l.valor;

      const btn = document.createElement("button");
      btn.textContent = "Cancelar Baixa";
      btn.onclick = () => cancelarBaixaMovimentacao(l.mov);
      tdAcoes.appendChild(btn);
    }

    tr.appendChild(tdAcoes);
    tableExtrato.appendChild(tr);
  });

  document.getElementById("total-receitas-extrato").textContent =
    formatReal(cred);
  document.getElementById("total-despesas-extrato").textContent =
    formatReal(deb);
  document.getElementById("saldo-periodo-extrato").textContent =
    formatReal(cred - deb);
  document.getElementById("saldo-atual-conta-extrato").textContent =
    formatReal(conta.saldo_atual);
  document.getElementById("total-valor").textContent =
    formatReal(cred - deb);
}


// ========================= CANCELAR BAIXA =========================

async function cancelarBaixaMovimentacao(mov) {
  if (!confirm("Deseja cancelar esta baixa?")) return;

  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("*")
    .eq("id", mov.conta_id)
    .single();

  let novoSaldo = Number(conta.saldo_atual || 0);

  // desfazer crédito/débito
  if (mov.tipo === "credito") novoSaldo -= Number(mov.valor);
  else novoSaldo += Number(mov.valor);

  await supabase
    .from("contas_bancarias")
    .update({ saldo_atual: novoSaldo })
    .eq("id", mov.conta_id);

  // apagar a movimentação
  await supabase.from("movimentacoes").delete().eq("id", mov.id);

  // desfazer marcação de baixa no lançamento original
  await supabase
    .from("receitas")
    .update({ baixado: false, data_baixa: null })
    .eq("id", mov.lancamento_id);

  await supabase
    .from("despesas")
    .update({ baixado: false, data_baixa: null })
    .eq("id", mov.lancamento_id);

  await recalcularSaldo(mov.conta_id);
  await refreshLancamentos();
  await renderExtrato();
}
// ========================= DASHBOARD =========================

async function loadDashboard() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${last}`;

  // Receitas e despesas do mês
  const rec = await supabase
    .from("receitas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const des = await supabase
    .from("despesas")
    .select("*")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const totalR = (rec.data || []).reduce(
    (s, x) => s + Number(x.valor || 0),
    0
  );
  const totalD = (des.data || []).reduce(
    (s, x) => s + Number(x.valor || 0),
    0
  );

  document.getElementById("dash-period").textContent = `${mes}/${ano}`;
  document.getElementById("dash-receber").textContent = formatReal(totalR);
  document.getElementById("dash-pagar").textContent = formatReal(totalD);
  document.getElementById("dash-saldo-atual").textContent = formatReal(
    totalR - totalD
  );
  document.getElementById("dash-saldo-previsto").textContent = formatReal(
    totalR - totalD
  );

  // ========================= GRÁFICO GERAL =========================
  const ctx = document.getElementById("chart-dashboard");

  if (chartDashboard) chartDashboard.destroy();

 chartDashboard = new Chart(ctx, {
  type: "bar",
  data: {
    labels: ["Receitas", "Despesas"],
    datasets: [
      {
        label: "Resumo do mês",
        data: [totalR, totalD],
        backgroundColor: ["#18c55f", "#e63946"], // verde / vermelho
      },
    ],
  },

    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true },
      },
    },
  });

  await renderGraficoReceitasPorCategoria(inicio, fim);
  await renderGraficoDespesasPorCategoria(inicio, fim);
}


// ========================= GRÁFICO RECEITAS POR CATEGORIA =========================

async function renderGraficoReceitasPorCategoria(inicio, fim) {
  const { data } = await supabase
    .from("receitas")
    .select("valor,categoria_id,categorias(nome)")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const grupos = {};

  (data || []).forEach((r) => {
    const nome = r.categorias?.nome || "Sem categoria";
    grupos[nome] = (grupos[nome] || 0) + Number(r.valor || 0);
  });

  const labels = Object.keys(grupos);
  const valores = Object.values(grupos);

  const ctx = document.getElementById("chart-receitas-categorias");

chartRecCat = new Chart(ctx, {
  type: "bar",
  data: {
    labels,
    datasets: [
      {
        label: "Receitas por Categoria",
        data: valores,
        backgroundColor: "#18c55f",
      },
    ],
  },
  options: {
    responsive: true,
  },
});
}  

// ========================= GRÁFICO DESPESAS POR CATEGORIA =========================

async function renderGraficoDespesasPorCategoria(inicio, fim) {
  const { data } = await supabase
    .from("despesas")
    .select("valor,categoria_id,categorias(nome)")
    .eq("user_id", currentUser.id)
    .gte("data", inicio)
    .lte("data", fim);

  const grupos = {};

  (data || []).forEach((r) => {
    const nome = r.categorias?.nome || "Sem categoria";
    grupos[nome] = (grupos[nome] || 0) + Number(r.valor || 0);
  });

  const labels = Object.keys(grupos);
  const valores = Object.values(grupos);

  const ctx = document.getElementById("chart-despesas-categorias");

 if (chartDesCat) chartDesCat.destroy();
chartDesCat = new Chart(ctx, {
  type: "bar",
  data: {
    labels,
    datasets: [
      {
        label: "Despesas por Categoria",
        data: valores,
        backgroundColor: "#e63946", // vermelho
      },
    ],
  },
  options: {
    responsive: true,
  },
});  
  }

// ========================= SUBSCRIBE SUPABASE =========================

function subscribeToChanges() {
  // Receitas → atualiza lançamentos
  supabase
    .channel("rec")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "receitas" },
      () => refreshLancamentos()
    )
    .subscribe();

  // Despesas → atualiza lançamentos
  supabase
    .channel("des")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "despesas" },
      () => refreshLancamentos()
    )
    .subscribe();

  // Movimentações → atualiza extrato
  supabase
    .channel("mov")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "movimentacoes" },
      () => renderExtrato()
    )
    .subscribe();

  // Categorias → recarrega lista
  supabase
    .channel("cats")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "categorias" },
      () => loadCategorias()
    )
    .subscribe();
}


// ========================= TROCA DE TELAS PRINCIPAIS =========================

function showScreen(s) {
  // Oculta todas
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  // Reseta ativações
  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  // Ativa a tela escolhida
  if (s === "dashboard") {
    telaDashboard.classList.remove("hidden");
    btnDash.classList.add("active");
    loadDashboard();
  } else if (s === "contas") {
    telaContas.classList.remove("hidden");
    btnContas.classList.add("active");
  } else if (s === "lanc") {
    telaLanc.classList.remove("hidden");
    btnLanc.classList.add("active");
  }
}

// botões de menu
btnDash.onclick = () => showScreen("dashboard");
btnContas.onclick = () => showScreen("contas");
btnLanc.onclick = () => showScreen("lanc");


// ========================= TABS (Cadastro / Extrato / Categorias) =========================

document.querySelectorAll(".tab-btn").forEach((b) => {
  b.onclick = () => {
    // remove ativo de todas
    document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));

    b.classList.add("active");

    // esconde todas as tabs
    tabCadastro.classList.add("hidden");
    tabExtrato.classList.add("hidden");
    tabCategorias.classList.add("hidden");

    // mostra a tab correta
    if (b.dataset.tab === "cadastro") {
      tabCadastro.classList.remove("hidden");
    }

    if (b.dataset.tab === "extrato") {
      tabExtrato.classList.remove("hidden");
      renderExtrato();
    }

    if (b.dataset.tab === "categorias") {
      tabCategorias.classList.remove("hidden");
    }
  };
});


// ========================= FILTROS LANÇAMENTOS =========================

periodoLanc.onchange = () => {
  if (periodoLanc.value === "personalizado") {
    dataInicioLanc.classList.remove("hidden");
    dataFimLanc.classList.remove("hidden");
  } else {
    dataInicioLanc.classList.add("hidden");
    dataFimLanc.classList.add("hidden");
  }
};


// ========================= FILTROS EXTRATO =========================

periodoExtrato.onchange = () => {
  if (periodoExtrato.value === "personalizado") {
    dataInicio.classList.remove("hidden");
    dataFim.classList.remove("hidden");
  } else {
    dataInicio.classList.add("hidden");
    dataFim.classList.add("hidden");
  }
};
