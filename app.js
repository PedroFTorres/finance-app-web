// =========================
//  Finance App - app.js (Extrato em tabela + recorrência)
// =========================

/* Utilities */
function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  const dia = String(d.getDate()).padStart(2,'0');
  const mes = String(d.getMonth()+1).padStart(2,'0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatReal(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

function genId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

/* Session */
let currentUser = null;
let editing = { type: null, id: null, recId: null };
let sortState = { key: 'data', dir: 'desc' };

supabase.auth.getSession().then(({ data })=>{
  if (!data.session) return window.location.href = 'login.html';
  currentUser = data.session.user;
  document.getElementById('user-email').textContent = currentUser.email;
  initApp();
});

document.getElementById('btn-logout').onclick = async ()=>{
  await supabase.auth.signOut();
  window.location.href = 'login.html';
};

/* DOM references */
const selectContas = document.getElementById('select-contas');
const selectContasExtrato = document.getElementById('select-contas-extrato');
const selectContaLanc = document.getElementById('select-conta-lanc');
const contaNome = document.getElementById('conta-nome');
const contaSaldo = document.getElementById('conta-saldo');
const btnAddConta = document.getElementById('btn-add-conta');

const tipoLanc = document.getElementById('tipo-lancamento');
const valorLanc = document.getElementById('valor-lanc');
const descLanc = document.getElementById('desc-lanc');
const dataLanc = document.getElementById('data-lanc');
const btnAddLanc = document.getElementById('btn-add-lanc');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const recTipo = document.getElementById('recorrencia-tipo');
const recParcelas = document.getElementById('recorrencia-parcelas');

const tableBody = document.querySelector('#table-extrato tbody');
const periodoExtrato = document.getElementById('periodo-extrato');
const dataInicio = document.getElementById('data-inicio');
const dataFim = document.getElementById('data-fim');
const btnFiltrarExtrato = document.getElementById('btn-filtrar-extrato');

const totalReceitasExtrato = document.getElementById('total-receitas-extrato');
const totalDespesasExtrato = document.getElementById('total-despesas-extrato');
const saldoPeriodoExtrato = document.getElementById('saldo-periodo-extrato');
const saldoAtualContaExtrato = document.getElementById('saldo-atual-conta-extrato');

/* Tabs */
document.querySelectorAll('.tab-btn').forEach(b=> b.onclick = (e)=>{
  document.querySelectorAll('.tab-btn').forEach(x=> x.classList.remove('active'));
  e.target.classList.add('active');
  const tab = e.target.getAttribute('data-tab');
  document.querySelectorAll('.tab-content').forEach(c=> c.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
});

/* Menu */
const menuDashboardBtn = document.getElementById('menu-dashboard');
const menuContasBtn = document.getElementById('menu-contas');
const menuLancamentosBtn = document.getElementById('menu-lancamentos');
const telaDashboard = document.getElementById('tela-dashboard');
const telaContas = document.getElementById('tela-contas');
const telaLancamentos = document.getElementById('tela-lancamentos');

menuDashboardBtn.onclick = ()=> { showScreen('dashboard'); };
menuContasBtn.onclick = ()=> { showScreen('contas'); };
menuLancamentosBtn.onclick = ()=> { showScreen('lancamentos'); };

function showScreen(name) {
  telaDashboard.classList.add('hidden');
  telaContas.classList.add('hidden');
  telaLancamentos.classList.add('hidden');
  menuDashboardBtn.classList.remove('active');
  menuContasBtn.classList.remove('active');
  menuLancamentosBtn.classList.remove('active');

  if (name === 'dashboard') {
    telaDashboard.classList.remove('hidden');
    menuDashboardBtn.classList.add('active');
  } else if (name === 'contas') {
    telaContas.classList.remove('hidden');
    menuContasBtn.classList.add('active');
  } else {
    telaLancamentos.classList.remove('hidden');
    menuLancamentosBtn.classList.add('active');
  }
}

/* Initialization */
async function initApp() {
  await loadContas();
  subscribeToChanges();
  showScreen('contas');
  // setup extrato controls
  periodoExtrato.onchange = onPeriodoChange;
  btnFiltrarExtrato.onclick = () => loadExtrato();
  selectContasExtrato.onchange = () => loadExtrato();
  selectContas.onchange = syncSelects;
  selectContaLanc.onchange = ()=>{};
  document.querySelectorAll('#table-extrato thead th[data-key]').forEach(th=>{
    th.onclick = ()=> { toggleSort(th.getAttribute('data-key')); };
  });
}

/* Load contas */
async function loadContas() {
  const { data, error } = await supabase.from('contas_bancarias').select('*').eq('user_id', currentUser.id).order('created_at');
  if (error) return console.error(error);
  selectContas.innerHTML = '';
  selectContasExtrato.innerHTML = '';
  selectContaLanc.innerHTML = '';
  data.forEach(conta=>{
    const opt = document.createElement('option');
    const saldoInicial = Number(conta.saldo_inicial || 0).toFixed(2);
    opt.value = conta.id;
    opt.textContent = `${conta.nome} (R$ ${saldoInicial})`;
    selectContas.appendChild(opt);
    selectContasExtrato.appendChild(opt.cloneNode(true));
    selectContaLanc.appendChild(opt.cloneNode(true));
  });
  if (data.length > 0) {
    selectContas.value = data[0].id;
    selectContasExtrato.value = data[0].id;
    selectContaLanc.value = data[0].id;
    loadExtrato();
    refreshMovements();
  }
}

/* Add conta */
btnAddConta.onclick = async ()=>{
  const nome = contaNome.value.trim();
  const saldo = parseFloat(contaSaldo.value || 0);
  if (!nome) return alert('Informe o nome da conta!');
  const { error } = await supabase.from('contas_bancarias').insert([{ nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id }]);
  if (error) return alert(error.message);
  contaNome.value = '';
  contaSaldo.value = '';
  loadContas();
};

/* Toggle period personalizado */
function onPeriodoChange(){
  const v = periodoExtrato.value;
  if (v === 'personalizado') {
    dataInicio.classList.remove('hidden');
    dataFim.classList.remove('hidden');
  } else {
    dataInicio.classList.add('hidden');
    dataFim.classList.add('hidden');
  }
}

/* Build date range from periodo */
function getRangeFromPeriodo() {
  const today = new Date();
  const v = periodoExtrato.value;
  let start, end;
  if (v === 'mes_atual') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth()+1, 0);
  } else if (v === 'mes_anterior') {
    start = new Date(today.getFullYear(), today.getMonth()-1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (v === 'ultimos_30') {
    end = today;
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate()-30);
  } else if (v === 'personalizado') {
    start = new Date(dataInicio.value + 'T00:00:00');
    end = new Date(dataFim.value + 'T00:00:00');
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth()+1, 0);
  }
  return { start, end };
}

/* Load extrato for selected account and period */
async def_placeholder = None
async function loadExtrato() {
  const conta_id = selectContasExtrato.value;
  if (!conta_id) return;
  const { start, end } = getRangeFromPeriodo();
  const startStr = start.toISOString().slice(0,10);
  const endStr = end.toISOString().slice(0,10);

  // fetch receitas and despesas for account within range
  const [r1, r2] = await Promise.all([
    supabase.from('receitas').select('*').eq('conta_id', conta_id).eq('user_id', currentUser.id).gte('data', startStr).lte('data', endStr).order('data', {ascending:false}),
    supabase.from('despesas').select('*').eq('conta_id', conta_id).eq('user_id', currentUser.id).gte('data', startStr).lte('data', endStr).order('data', {ascending:false})
  ]);
  const receitas = r1.data || [];
  const despesas = r2.data || [];
  // merge and sort by date desc default
  let items = [];
  receitas.forEach(it=> items.push({...it, tipo:'receita'}));
  despesas.forEach(it=> items.push({...it, tipo:'despesa'}));

  // apply sort
  items.sort((a,b)=>{
    if (sortState.key === 'data') {
      const da = new Date(a.data), db = new Date(b.data);
      return sortState.dir === 'asc' ? da - db : db - da;
    } else if (sortState.key === 'valor') {
      return sortState.dir === 'asc' ? (a.valor - b.valor) : (b.valor - a.valor);
    } else {
      const va = (a[sortState.key]||'').toString().toLowerCase();
      const vb = (b[sortState.key]||'').toString().toLowerCase();
      if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
      if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
      return 0;
    }
  });

  renderExtratoTable(items);

  // totals
  const totalReceitas = receitas.reduce((s,it)=> s + (it.valor||0), 0);
  const totalDespesas = despesas.reduce((s,it)=> s + (it.valor||0), 0);
  totalReceitasExtrato.textContent = formatReal(totalReceitas);
  totalDespesasExtrato.textContent = formatReal(totalDespesas);
  saldoPeriodoExtrato.textContent = formatReal(totalReceitas - totalDespesas);

  // saldo atual conta (sum of saldo_inicial + receitas - despesas overall)
  const { data: contas } = await supabase.from('contas_bancarias').select('saldo_inicial').eq('id', conta_id).eq('user_id', currentUser.id);
  const saldoInicial = contas && contas[0] ? parseFloat(contas[0].saldo_inicial || 0) : 0;
  saldoAtualContaExtrato.textContent = formatReal(saldoInicial + totalReceitas - totalDespesas);
}

/* render table */
function renderExtratoTable(items) {
  tableBody.innerHTML = '';
  let total = 0;
  items.forEach(it=>{
    const tr = document.createElement('tr');
    const tdData = document.createElement('td');
    tdData.textContent = formatDate(it.data);
    const tdDesc = document.createElement('td');
    tdDesc.textContent = it.descricao || '';
    const tdTipo = document.createElement('td');
    tdTipo.textContent = it.tipo === 'receita' ? 'Receita' : 'Despesa';
    tdTipo.className = it.tipo === 'receita' ? 'tipo-receita' : 'tipo-despesa';
    const tdValor = document.createElement('td');
    tdValor.textContent = formatReal(it.valor);
    tdValor.style.fontWeight = 'bold';
    if (it.tipo === 'despesa') tdValor.style.color = 'red'; else tdValor.style.color = 'green';

    const tdActions = document.createElement('td');
    tdActions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.onclick = ()=> startEditFromExtrato(it);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.onclick = ()=> deleteFromExtrato(it);
    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdData);
    tr.appendChild(tdDesc);
    tr.appendChild(tdTipo);
    tr.appendChild(tdValor);
    tr.appendChild(tdActions);
    tableBody.appendChild(tr);
    total += (it.tipo==='despesa' ? -it.valor : it.valor);
  });
  document.getElementById('total-valor').innerHTML = formatReal(total);
}

/* Sorting */
function toggleSort(key) {
  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.key = key;
    sortState.dir = 'desc';
  }
  loadExtrato();
}

/* Add / Edit lancamentos (with recurrence) */
btnAddLanc.onclick = async ()=>{
  const valor = parseFloat(valorLanc.value);
  const desc = descLanc.value.trim();
  const data = dataLanc.value;
  const tipo = tipoLanc.value;
  const conta_id = selectContaLanc.value;
  const rec = recTipo.value;
  const parcelas = parseInt(recParcelas.value) || 1;
  if (!valor || !desc || !data || !conta_id) return alert('Preencha todos os campos!');

  // editing single
  if (editing.type && editing.id) {
    const table = editing.type === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).update({ descricao: desc, valor, data, conta_id }).eq('id', editing.id).eq('user_id', currentUser.id);
    if (error) return alert(error.message);
    stopEdit();
    refreshMovements();
    loadExtrato();
    return;
  }

  // handle recurrence: generate dates and insert multiple rows with group id marker in descricao
  const recGroup = parcelas > 1 || rec !== 'none' ? genId() : null;
  const dates = generateRecurrenceDates(data, parcelas, rec);

  if (dates.length === 1) {
    const payload = { descricao: desc + (recGroup ? ` ||rec=${recGroup}` : ''), valor, data: dates[0], conta_id, user_id: currentUser.id };
    if (tipo === 'receita') await supabase.from('receitas').insert([payload]); else await supabase.from('despesas').insert([payload]);
  } else {
    const payloads = dates.map((dt, idx)=> {
      const parcelaTag = parcelas>1 ? ` [${idx+1}/${parcelas}]` : '';
      return { descricao: desc + parcelaTag + (recGroup ? ` ||rec=${recGroup}` : ''), valor, data: dt, conta_id, user_id: currentUser.id };
    });
    const table = tipo === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).insert(payloads);
    if (error) return alert(error.message);
  }

  valorLanc.value=''; descLanc.value=''; dataLanc.value=''; recTipo.value='none'; recParcelas.value='1';
  refreshMovements();
  loadExtrato();
};

/* generate recurrence dates based on type and parcelas */
function generateRecurrenceDates(startDateStr, parcelas, tipo) {
  const arr = [];
  const start = new Date(startDateStr + 'T00:00:00');
  if (parcelas <= 1 && tipo === 'none') return [startDateStr];
  for (let i=0;i<parcelas;i++) {
    let d = new Date(start.getTime());
    if (tipo === 'monthly') {
      d.setMonth(d.getMonth() + i);
    } else if (tipo === 'fortnight') {
      d.setDate(d.getDate() + i*15);
    } else if (tipo === 'weekly') {
      d.setDate(d.getDate() + i*7);
    } else if (tipo === 'annual') {
      d.setFullYear(d.getFullYear() + i);
    } else {
      // non-recurring but multiple parcels => monthly by default
      d.setMonth(d.getMonth() + i);
    }
    arr.push(d.toISOString().slice(0,10));
  }
  return arr;
}

/* start editing from extrato: respect recurrence marker */
function startEditFromExtrato(item) {
  editing.type = item.tipo;
  editing.id = item.id;
  // populate form in Lançamentos screen for editing convenience
  showScreen('lancamentos');
  tipoLanc.value = item.tipo;
  valorLanc.value = item.valor;
  // remove recurrence tag when filling form
  descLanc.value = (item.descricao || '').replace(/ \|\|rec=[^\s]+/,'').replace(/ \[\d+\/\d+\]/,'');
  dataLanc.value = item.data;
  selectContaLanc.value = item.conta_id;
  btnAddLanc.textContent = 'Salvar';
  btnCancelEdit.classList.remove('hidden');
}

/* delete from extrato (with recurrence handling) */
async function deleteFromExtrato(item) {
  const recId = extractRecId(item.descricao);
  if (!recId) {
    if (!confirm('Deseja excluir este lançamento?')) return;
    const table = item.tipo === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).delete().eq('id', item.id).eq('user_id', currentUser.id);
    if (error) return alert(error.message);
    loadExtrato(); refreshMovements(); return;
  }

  // has recurrence marker
  const choice = prompt('Este lançamento faz parte de uma recorrência. Digite 1 para apagar apenas este, 2 para apagar este e os posteriores.');
  if (choice === '1') {
    const table = item.tipo === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).delete().eq('id', item.id).eq('user_id', currentUser.id);
    if (error) return alert(error.message);
    loadExtrato(); refreshMovements(); return;
  } else if (choice === '2') {
    // delete where descricao contains same recId and data >= item.data
    const table = item.tipo === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).delete().like('descricao', `%||rec=${recId}%`).gte('data', item.data).eq('user_id', currentUser.id);
    if (error) return alert(error.message);
    loadExtrato(); refreshMovements(); return;
  } else {
    alert('Opção inválida. Ação cancelada.');
    return;
  }
}

/* extract rec id from descricao */
function extractRecId(desc) {
  if (!desc) return null;
  const m = desc.match(/\|\|rec=([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/* stop edit */
function stopEdit() {
  editing.type = null; editing.id = null;
  valorLanc.value=''; descLanc.value=''; dataLanc.value=''; btnAddLanc.textContent='Adicionar'; btnCancelEdit.classList.add('hidden');
}

/* refresh movements (for lists and dashboard) */
async function refreshMovements() {
  const conta_id = selectContas.value;
  const [rReceitas, rDespesas] = await Promise.all([
    supabase.from('receitas').select('*').eq('conta_id', conta_id).eq('user_id', currentUser.id).order('data'),
    supabase.from('despesas').select('*').eq('conta_id', conta_id).eq('user_id', currentUser.id).order('data')
  ]);
  const receitas = rReceitas.data || [];
  const despesas = rDespesas.data || [];
  // render lists if on lancamentos screen
  const listReceitas = document.getElementById('list-receitas');
  const listDespesas = document.getElementById('list-despesas');
  if (listReceitas) { listReceitas.innerHTML=''; receitas.forEach(it=> { const li = document.createElement('li'); li.style.color='green'; li.textContent = `${formatDate(it.data)} - ${it.descricao} - ${formatReal(it.valor)}`; listReceitas.appendChild(li); }); }
  if (listDespesas) { listDespesas.innerHTML=''; despesas.forEach(it=> { const li = document.createElement('li'); li.style.color='red'; li.textContent = `${formatDate(it.data)} - ${it.descricao} - ${formatReal(it.valor)}`; listDespesas.appendChild(li); }); }
  // update totals in lancamentos section
  const totalR = receitas.reduce((s,it)=> s + (it.valor||0), 0);
  const totalD = despesas.reduce((s,it)=> s + (it.valor||0), 0);
  document.getElementById('total-receitas').textContent = formatReal(totalR);
  document.getElementById('total-despesas').textContent = formatReal(totalD);
  const opt = selectContas.selectedOptions[0];
  const saldoInicial = opt ? parseFloat(opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(',', '.')) : 0;
  document.getElementById('saldo-atual').textContent = formatReal(saldoInicial + totalR - totalD);
}

/* subscribe realtime */
function subscribeToChanges() {
  supabase.channel('rt_receitas').on('postgres_changes',{event:'*',schema:'public',table:'receitas'}, payload=>{ if (payload.record?.user_id === currentUser.id) { refreshMovements(); loadExtrato(); } }).subscribe();
  supabase.channel('rt_despesas').on('postgres_changes',{event:'*',schema:'public',table:'despesas'}, payload=>{ if (payload.record?.user_id === currentUser.id) { refreshMovements(); loadExtrato(); } }).subscribe();
  supabase.channel('rt_contas').on('postgres_changes',{event:'*',schema:'public',table:'contas_bancarias'}, payload=>{ if (payload.record?.user_id === currentUser.id) { loadContas(); loadExtrato(); } }).subscribe();
}

/* utility to sync selects */
function syncSelects() {
  selectContasExtrato.value = selectContas.value;
  selectContaLanc.value = selectContas.value;
  loadExtrato();
}

/* delete/edit support from lancamentos list (not used heavily) */
async function deleteItem(type, id, descricao) {
  // similar logic to deleteFromExtrato, but simpler
  const recId = extractRecId(descricao);
  if (!recId) {
    if (!confirm('Deseja excluir este lançamento?')) return;
    const table = type === 'receita' ? 'receitas' : 'despesas';
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) return alert(error.message);
    refreshMovements(); loadExtrato(); return;
  }
  const choice = prompt('Lançamento recorrente. Digite 1 para apenas este, 2 para este e posteriores:');
  if (choice === '1') {
    const table = type === 'receita' ? 'receitas' : 'despesas';
    await supabase.from(table).delete().eq('id', id).eq('user_id', currentUser.id);
  } else if (choice === '2') {
    const table = type === 'receita' ? 'receitas' : 'despesas';
    await supabase.from(table).delete().like('descricao', `%||rec=${recId}%`).gte('data', dataLanc.value).eq('user_id', currentUser.id);
  } else { alert('Cancelado'); }
  refreshMovements(); loadExtrato();
}

/* end of file */