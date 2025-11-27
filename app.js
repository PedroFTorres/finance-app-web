import { supabase } from './supabase.js'

const authSection = document.getElementById('auth')
const appSection = document.getElementById('app')
const userArea = document.getElementById('user-area')

const emailInput = document.getElementById('email')
const passInput = document.getElementById('password')
const btnSignup = document.getElementById('btn-signup')
const btnSignin = document.getElementById('btn-signin')
const btnLogout = document.getElementById('btn-logout')

const selectContas = document.getElementById('select-contas')
const btnAddConta = document.getElementById('btn-add-conta')
const contaNome = document.getElementById('conta-nome')
const contaSaldo = document.getElementById('conta-saldo')

const tipoLanc = document.getElementById('tipo-lancamento')
const valorLanc = document.getElementById('valor-lanc')
const descLanc = document.getElementById('desc-lanc')
const dataLanc = document.getElementById('data-lanc')
const btnAddLanc = document.getElementById('btn-add-lanc')

const saldoAtualEl = document.getElementById('saldo-atual')
const totalReceitasEl = document.getElementById('total-receitas')
const totalDespesasEl = document.getElementById('total-despesas')
const listReceitas = document.getElementById('list-receitas')
const listDespesas = document.getElementById('list-despesas')

let currentUser = null
btnSignup.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  const password = passInput.value.trim()

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return alert(error.message)

  alert("Conta criada! Agora faça login.")
})

btnSignin.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  const password = passInput.value.trim()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return alert(error.message)

  currentUser = data.user
  initApp()
})

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut()
  currentUser = null
  showAuth()
})
function showAuth() {
  authSection.classList.remove('hidden')
  appSection.classList.add('hidden')
}

function showApp() {
  authSection.classList.add('hidden')
  appSection.classList.remove('hidden')
  userArea.textContent = currentUser?.email || ""
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user
    initApp()
  } else {
    currentUser = null
    showAuth()
  }
})
async function initApp() {
  showApp()
  await loadContas()
  subscribeToChanges()
}

async function loadContas() {
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return console.error(error)

  selectContas.innerHTML = ""

  data.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = `${c.nome} (R$ ${Number(c.saldo_inicial || 0).toFixed(2)})`
    selectContas.appendChild(opt)
  })

  if (data.length > 0) selectContas.value = data[0].id
  refreshMovements()
}

btnAddConta.addEventListener('click', async () => {
  const nome = contaNome.value.trim()
  const saldo = parseFloat(contaSaldo.value || 0)

  if (!nome) return alert("Digite o nome da conta")

  const { error } = await supabase.from('contas_bancarias').insert([
    { nome, saldo_inicial: saldo, saldo_atual: saldo }
  ])

  if (error) return alert(error.message)

  contaNome.value = ""
  contaSaldo.value = ""

  loadContas()
})
btnAddLanc.addEventListener('click', async () => {
  const tipo = tipoLanc.value
  const valor = parseFloat(valorLanc.value)
  const descricao = descLanc.value.trim()
  const data = dataLanc.value
  const conta_id = selectContas.value

  if (!valor || !descricao || !data) return alert("Preencha todos os campos")

  if (tipo === "receita") {
    const { error } = await supabase.from("receitas").insert([{ descricao, valor, data, conta_id }])
    if (error) return alert(error.message)
  } else {
    const { error } = await supabase.from("despesas").insert([{ descricao, valor, data, conta_id }])
    if (error) return alert(error.message)
  }

  valorLanc.value = ""
  descLanc.value = ""
  dataLanc.value = ""

  refreshMovements()
})
async function refreshMovements() {
  const conta_id = selectContas.value
  if (!conta_id) return

  const [r, d] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id", conta_id),
    supabase.from("despesas").select("*").eq("conta_id", conta_id)
  ])

  const receitas = r.data || []
  const despesas = d.data || []

  listReceitas.innerHTML = ""
  listDespesas.innerHTML = ""

  let totalR = 0
  let totalD = 0

  receitas.forEach(item => {
    totalR += Number(item.valor)
    const li = document.createElement("li")
    li.textContent = `${item.data} — ${item.descricao} — R$ ${Number(item.valor).toFixed(2)}`
    listReceitas.appendChild(li)
  })

  despesas.forEach(item => {
    totalD += Number(item.valor)
    const li = document.createElement("li")
    li.textContent = `${item.data} — ${item.descricao} — R$ ${Number(item.valor).toFixed(2)}`
    listDespesas.appendChild(li)
  })

  totalReceitasEl.textContent = `R$ ${totalR.toFixed(2)}`
  totalDespesasEl.textContent = `R$ ${totalD.toFixed(2)}`

  const saldoInicial = parseFloat(
    selectContas.selectedOptions[0]?.text.match(/\(R\$\s*([0-9.,]+)\)/)?.[1].replace(",", ".") || 0
  )

  const saldoAtual = (saldoInicial + totalR) - totalD
  saldoAtualEl.textContent = `R$ ${saldoAtual.toFixed(2)}`
}
function subscribeToChanges() {
  supabase.channel("public:receitas")
    .on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, () => refreshMovements())
    .subscribe()

  supabase.channel("public:despesas")
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, () => refreshMovements())
    .subscribe()
}
