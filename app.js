// ELEMENTOS
const userEmailDiv = document.getElementById("user-email")
const selectContas = document.getElementById("select-contas")
const nomeConta = document.getElementById("nova-conta-nome")
const saldoConta = document.getElementById("nova-conta-saldo")
const btnAddConta = document.getElementById("btn-add-conta")

const tipoLanc = document.getElementById("tipo")
const valor = document.getElementById("valor")
const descricao = document.getElementById("descricao")
const data = document.getElementById("data")
const btnLancar = document.getElementById("btn-lancar")

const listaReceitas = document.getElementById("lista-receitas")
const listaDespesas = document.getElementById("lista-despesas")

const spanSaldo = document.getElementById("saldo-atual")
const spanTotalReceitas = document.getElementById("total-receitas")
const spanTotalDespesas = document.getElementById("total-despesas")

const btnSair = document.getElementById("btn-sair")


// FORMATAR DATA
function formatDate(dateString) {
  const d = new Date(dateString)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}


// LOGIN CHECK
async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  userEmailDiv.textContent = user.email
}
checkUser()


// CARREGAR CONTAS
async function loadContas() {
  const { data } = await supabase.from("contas_bancarias").select("*")

  selectContas.innerHTML = ""

  if (!data) return;
  data.forEach(c => {
    const opt = document.createElement("option")
    opt.value = c.id
    opt.textContent = `${c.nome} (R$ ${c.saldo_inicial})`
    selectContas.appendChild(opt)
  })

  refreshMovements()
}


// ADICIONAR CONTA
btnAddConta.onclick = async () => {
  await supabase.from("contas_bancarias").insert({
    nome: nomeConta.value,
    saldo_inicial: Number(saldoConta.value)
  })

  nomeConta.value = ""
  saldoConta.value = ""
  loadContas()
}


// ATUALIZAR LISTAS
async function refreshMovements() {
  const conta = selectContas.value

  const { data: receitas } = await supabase.from("receitas").select("*").eq("conta_id", conta)
  const { data: despesas } = await supabase.from("despesas").select("*").eq("conta_id", conta)

  renderReceitas(receitas)
  renderDespesas(despesas)

  const totalReceitas = receitas.reduce((s, r) => s + Number(r.valor), 0)
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0)

  spanTotalReceitas.textContent = `Total Receitas: R$ ${totalReceitas.toFixed(2)}`
  spanTotalDespesas.textContent = `Total Despesas: R$ ${totalDespesas.toFixed(2)}`
  spanSaldo.textContent = `Saldo Atual: R$ ${(totalReceitas - totalDespesas).toFixed(2)}`
}


// RENDER RECEITAS
function renderReceitas(lista) {
  listaReceitas.innerHTML = ""

  lista.forEach(item => {
    const div = document.createElement("div")
    div.className = "item"

    div.innerHTML = `
      <span>${formatDate(item.data)} — ${item.descricao} — R$ ${item.valor}</span>
      <div class="buttons">
        <button onclick="editarReceita('${item.id}')">✏️</button>
        <button onclick="excluirReceita('${item.id}')">🗑️</button>
      </div>
    `
    listaReceitas.appendChild(div)
  })
}


// RENDER DESPESAS
function renderDespesas(lista) {
  listaDespesas.innerHTML = ""

  lista.forEach(item => {
    const div = document.createElement("div")
    div.className = "item"

    div.innerHTML = `
      <span>${formatDate(item.data)} — ${item.descricao} — R$ ${item.valor}</span>
      <div class="buttons">
        <button onclick="editarDespesa('${item.id}')">✏️</button>
        <button onclick="excluirDespesa('${item.id}')">🗑️</button>
      </div>
    `
    listaDespesas.appendChild(div)
  })
}


// ADICIONAR LANÇAMENTO
btnLancar.onclick = async () => {
  if (!valor.value || !descricao.value || !data.value) {
    alert("Preencha todos os campos!")
    return
  }

  const tabela = tipoLanc.value === "receita" ? "receitas" : "despesas"

  await supabase.from(tabela).insert({
    valor: Number(valor.value),
    descricao: descricao.value,
    data: data.value,
    conta_id: selectContas.value
  })

  valor.value = ""
  descricao.value = ""
  data.value = ""

  refreshMovements()
}


// EDITAR / EXCLUIR
async function excluirReceita(id) {
  await supabase.from("receitas").delete().eq("id", id)
  refreshMovements()
}

async function excluirDespesa(id) {
  await supabase.from("despesas").delete().eq("id", id)
  refreshMovements()
}

async function editarReceita(id) {
  const valorNovo = prompt("Novo valor:")
  const desc = prompt("Nova descrição:")
  const dt = prompt("Nova data (yyyy-mm-dd):")

  await supabase.from("receitas").update({
    valor: valorNovo,
    descricao: desc,
    data: dt
  }).eq("id", id)

  refreshMovements()
}

async function editarDespesa(id) {
  const valorNovo = prompt("Novo valor:")
  const desc = prompt("Nova descrição:")
  const dt = prompt("Nova data (yyyy-mm-dd):")

  await supabase.from("despesas").update({
    valor: valorNovo,
    descricao: desc,
    data: dt
  }).eq("id", id)

  refreshMovements()
}


// SAIR
btnSair.onclick = async () => {
  await supabase.auth.signOut()
  location.reload()
}


// START
loadContas()
