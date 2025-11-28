// =========================
// Finance App - app.js (completo, dashboard, extrato em tabela, recorrência)
// =========================

// -------------------------
// Utilitários
// -------------------------
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatReal(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function genId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// -------------------------
// Sessão e estado global
// -------------------------
let currentUser = null;
let editing = { type: null, id: null }; // when editing an individual launch
let sortState = { key: 'data', dir: 'desc' }; // extrato sort
let dashboardChart = null;

// -------------------------
// Selectors (DOM)
// -------------------------
const userEmailEl = document.getElementById('user-email');
const btnLogout = document.getElementById('btn-logout');

const menuDashboardBtn = document.getElementById('menu-dashboard');
const menuContasBtn = document.getElementById('menu-contas');
const menuLancamentosBtn = document.getElementById('menu-lancamentos');

const telaDashboard = document.getElementById('tela-dashboard');
const telaContas = document.getElementById('tela-contas');
const telaLancamentos = document.getElementById('tela-lancamentos');

// Contas - cadastro tab
const selectContas = document.getElementById('select-contas');
const contaNome = document.getElementById('conta-nome');
const contaSaldo = document.getElementById('conta-saldo');
const btnAddConta = document.getElementById('btn-add-conta');

// Contas - extrato tab
const selectContasExtrato = document.getElementById('select-contas-extrato');
const periodoExtrato = document.getElementById('periodo-extrato');
const dataInicio = document.getElementById('data-inicio');
const dataFim = document.getElementById('data-fim');
const btnFiltrarExtrato = document.getElementById('btn-filtrar-extrato');
const tableBody = document.querySelector('#table-extrato tbody');
const totalValorEl = document.getElementById('total-valor');
const totalReceitasExtrato = document.getElementById('total-receitas-extrato');
const totalDespesasExtrato = document.getElementById('total-despesas-extrato');
const saldoPeriodoExtrato = document.getElementById('saldo-periodo-extrato');
const saldoAtualContaExtrato = document.getElementById('saldo-atual-conta-extrato');

// Lançamentos screen
const tipoLanc = document.getElementById('tipo-lancamento');
const valorLanc = document.getElementById('valor-lanc');
const descLanc = document.getElementById('desc-lanc');
const dataLanc = document.getElementById('data-lanc');
const selectContaLanc = document.getElementById('select-conta-lanc');
const recTipo = document.getElementById('recorrencia-tipo');
const recParcelas = document.getElementById('recorrencia-parcelas');
const btnAddLanc = document.getElementById('btn-add-lanc');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

const listReceitas = document.getElementById('list-receitas');
const listDespesas = document.getElementById('list-despesas');

const chartCanvas = document.getElementById('chart-dashboard');

// -------------------------
// Inicialização de sessão
// -------------------------
supabase.auth.getSession().then(({ data }) => {
  if (!data?.session) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = data.session.user;
  if (userEmailEl) userEmailEl.textContent = currentUser.email || '';
  initApp();
}).catch(err => {
  console.error('Erro ao obter sessão:', err);
  window.location.href = 'login.html';
});

btnLogout && (btnLogout.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

// -------------------------
// Init app
// -------------------------
async function initApp() {
  // bind menu
  menuDashboardBtn && (menuDashboardBtn.onclick = () => showScreen('dashboard'));
  menuContasBtn && (menuContasBtn.onclick = () => showScreen('contas'));
  menuLancamentosBtn && (menuLancamentosBtn.onclick = () => showScreen('lancamentos'));

  // tabs inside Contas are set in HTML; event binding handled in HTML snippet previously added

  // extrato controls
  periodoExtrato && (periodoExtrato.onchange = onPeriodoChange);
  btnFiltrarExtrato && (btnFiltrarExtrato.onclick = () => loadExtrato());
  selectContasExtrato && (selectContasExtrato.onchange = () => loadExtrato());

  // table sorting headers
  document.querySelectorAll('#table-extrato thead th[data-key]').forEach(th => {
    th.style.cursor = 'pointer';
    th.onclick = () => { toggleSort(th.getAttribute('data-key')); };
  });

  // bind add account
  btnAddConta && (btnAddConta.onclick = addConta);

  // bind add lancamento
  btnAddLanc && (btnAddLanc.onclick = addLancamento);
  btnCancelEdit && (btnCancelEdit.onclick = stopEdit);

  // load base data
  await loadContas();
  subscribeToChanges();
  // show default screen
  showScreen('contas');
  // render dashboard
  updateDashboard();
}

// -------------------------
// Screen switching
// -------------------------
function showScreen(name) {
  // hide all
  telaDashboard && telaDashboard.classList.add('hidden');
  telaContas && telaContas.classList.add('hidden');
  telaLancamentos && telaLancamentos.classList.add('hidden');

  // deactivate menu
  menuDashboardBtn && menuDashboardBtn.classList.remove('active');
  menuContasBtn && menuContasBtn.classList.remove('active');
  menuLancamentosBtn && menuLancamentosBtn.classList.remove('active');

  if (name === 'dashboard') {
    telaDashboard.classList.remove('hidden');
    menuDashboardBtn.classList.add('active');
    updateDashboard();
  } else if (name === 'contas') {
    telaContas.classList.remove('hidden');
    menuContasBtn.classList.add('active');
  } else {
    telaLancamentos.classList.remove('hidden');
    menuLancamentosBtn.classList.add('active');
    refreshMovements();
  }
}

// -------------------------
// Contas: load / add
// -------------------------
async function loadContas() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('contas_bancarias')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  // clear selects
  selectContas && (selectContas.innerHTML = '');
  selectContasExtrato && (selectContasExtrato.innerHTML = '');
  selectContaLanc && (selectContaLanc.innerHTML = '');

  if (!data || data.length === 0) {
    // nothing yet
    return;
  }

  data.forEach(conta => {
    const opt = document.createElement('option');
    opt.value = conta.id;
    const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
    opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
    // append clones to other selects
    selectContas && selectContas.appendChild(opt.cloneNode(true));
    selectContasExtrato && selectContasExtrato.appendChild(opt.cloneNode(true));
    selectContaLanc && selectContaLanc.appendChild(opt.cloneNode(true));
  });

  // sync selects
  if (selectContas && selectContas.options.length > 0) {
    selectContas.value = selectContas.options[0].value;
  }
  if (selectContasExtrato && selectContasExtrato.options.length > 0) {
    selectContasExtrato.value = selectContasExtrato.options[0].value;
  }
  if (selectContaLanc && selectContaLanc.options.length > 0) {
    selectContaLanc.value = selectContaLanc.options[0].value;
  }

  // load extrato for default account
  loadExtrato();
  refreshMovements();
}

// -------------------------
// Add conta
// -------------------------
async function addConta() {
  const nome = (contaNome && contaNome.value || '').trim();
  const saldo = parseFloat(contaSaldo && contaSaldo.value || 0);
  if (!nome) return alert('Informe o nome da conta');
  const { error } = await supabase.from('contas_bancarias').insert([{
    nome,
    saldo_inicial: saldo,
    saldo_atual: saldo,
    user_id: currentUser.id
  }]);
  if (error) return alert(error.message);
  contaNome.value = '';
  contaSaldo.value = '';
  await loadContas();
}

// -------------------------
// Extrato: período helpers
// -------------------------
function onPeriodoChange() {
  const v = periodoExtrato.value;
  if (v === 'personalizado') {
    dataInicio.classList.remove('hidden');
    dataFim.classList.remove('hidden');
  } else {
    dataInicio.classList.add('hidden');
    dataFim.classList.add('hidden');
  }
}

function getRangeFromPeriodo() {
  const today = new Date();
  const v = periodoExtrato.value;
  let start, end;
  if (v === 'mes_atual') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (v === 'mes_anterior') {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (v === 'ultimos_30') {
    end = today;
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  } else if (v === 'personalizado') {
    if (!dataInicio.value || !dataFim.value) {
      // fallback to month
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else {
      start = new Date(dataInicio.value + 'T00:00:00');
      end = new Date(dataFim.value + 'T00:00:00');
    }
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }
  return { start, end };
}

# truncated... (file too long to display)