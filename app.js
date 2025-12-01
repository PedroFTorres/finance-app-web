function formatDate(d){ if(!d) return ""; const D=new Date(d+"T00:00:00"); return String(D.getDate()).padStart(2,"0")+"/"+String(D.getMonth()+1).padStart(2,"0")+"/"+D.getFullYear(); }
function formatReal(v){ if(typeof v!=="number") v=Number(v||0); return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

let currentUser = null;
let editing = { type: null, id: null };
let chartDashboard = null;

const telaDashboard = document.getElementById("tela-dashboard");
const telaContas = document.getElementById("tela-contas");
const telaLanc = document.getElementById("tela-lancamentos");

const btnDash = document.getElementById("menu-dashboard");
const btnContas = document.getElementById("menu-contas");
const btnLanc = document.getElementById("menu-lancamentos");

const selectContas = document.getElementById("select-contas");
const contaNome = document.getElementById("conta-nome");
const contaSaldo = document.getElementById("conta-saldo");
const btnAddConta = document.getElementById("btn-add-conta");

const tipoLanc = document.getElementById("tipo-lancamento");
const valorLanc = document.getElementById("valor-lanc");
const descLanc = document.getElementById("desc-lanc");
const dataLanc = document.getElementById("data-lanc");
const btnAddLanc = document.getElementById("btn-add-lanc");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const selectContaLanc = document.getElementById("select-conta-lanc");

const saldoAtualEl = document.getElementById("saldo-atual");
const totalReceitasEl = document.getElementById("total-receitas");
const totalDespesasEl = document.getElementById("total-despesas");

const listReceitas = document.getElementById("list-receitas");
const listDespesas = document.getElementById("list-despesas");

const tabCadastro = document.getElementById("tab-cadastro");
const tabExtrato = document.getElementById("tab-extrato");

const selectExtrato = document.getElementById("select-contas-extrato");
const periodoExtrato = document.getElementById("periodo-extrato");
const dataInicio = document.getElementById("data-inicio");
const dataFim = document.getElementById("data-fim");
const btnFiltrarExtrato = document.getElementById("btn-filtrar-extrato");

const periodoLanc = document.getElementById("periodo-lanc");
const dataInicioLanc = document.getElementById("data-inicio-lanc");
const dataFimLanc = document.getElementById("data-fim-lanc");
const btnFiltrarLanc = document.getElementById("btn-filtrar-lanc");

let tableExtrato = null;
document.addEventListener("DOMContentLoaded", ()=>{ const t = document.getElementById("table-extrato"); if(t) tableExtrato = t.querySelector("tbody"); });

supabase.auth.getSession().then(({data})=>{
  if(!data.session) return window.location.href = "login.html";
  currentUser = data.session.user;
  const ue = document.getElementById("user-email"); if(ue) ue.textContent = currentUser.email;
  initApp();
});
document.getElementById("btn-logout")?.addEventListener("click", async ()=>{ await supabase.auth.signOut(); window.location.href = "login.html"; });

async function initApp(){
  await loadContas();
  subscribeToChanges();
  showScreen("contas");
}

/* recalcularSaldo: considera todas as movimentacoes */
async function recalcularSaldo(conta_id){
  try{
    if(!conta_id) return 0;
    const { data: conta } = await supabase.from("contas_bancarias").select("saldo_inicial").eq("id", conta_id).maybeSingle();
    const saldoInicial = Number(conta?.saldo_inicial || 0);
    const { data: movs } = await supabase.from("movimentacoes").select("id,lancamento_id,tipo,valor").eq("conta_id", conta_id);
    const seen = new Set();
    let cred = 0, deb = 0;
    (movs || []).forEach(m=>{
      const mid = String(m.id || m.lancamento_id || Math.random());
      if(seen.has(mid)) return;
      seen.add(mid);
      const v = Number(m.valor || 0);
      if(!isFinite(v)) return;
      if(String(m.tipo) === "credito") cred += v; else deb += v;
    });
    const saldoFinal = saldoInicial + cred - deb;
    const { data: cur } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id", conta_id).maybeSingle();
    const atual = Number(cur?.saldo_atual || 0);
    if(Number(saldoFinal.toFixed(2)) !== Number(atual.toFixed(2))){
      await supabase.from("contas_bancarias").update({ saldo_atual: saldoFinal }).eq("id", conta_id);
    }
    return saldoFinal;
  }catch(e){ console.error("recalcularSaldo", e); return 0; }
}

async function loadContas(){
  try{
    const { data } = await supabase.from("contas_bancarias").select("*").eq("user_id", currentUser.id).order("created_at");
    if(!selectContas) return;
    selectContas.innerHTML = "";
    (data || []).forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.nome} (${formatReal(Number(c.saldo_inicial||0))})`;
      selectContas.appendChild(opt);
    });
    if(data?.length){
      selectContas.value = data[0].id;
      await recalcularSaldo(selectContas.value);
      await refreshLancamentos();
    }
    await loadContasLancExtrato();
  }catch(e){ console.error("loadContas", e); }
}

async function loadContasLancExtrato(){
  try{
    const { data } = await supabase.from("contas_bancarias").select("*").eq("user_id", currentUser.id).order("created_at");
    if(selectExtrato) selectExtrato.innerHTML = "";
    if(selectContaLanc) selectContaLanc.innerHTML = "";
    (data || []).forEach(c=>{
      if(selectExtrato){ const o = document.createElement("option"); o.value = c.id; o.textContent = c.nome; selectExtrato.appendChild(o); }
      if(selectContaLanc){ const o2 = document.createElement("option"); o2.value = c.id; o2.textContent = c.nome; selectContaLanc.appendChild(o2); }
    });
    if(data?.length){
      if(selectExtrato) selectExtrato.value = data[0].id;
      if(selectContaLanc) selectContaLanc.value = data[0].id;
    }
  }catch(e){ console.error("loadContasLancExtrato", e); }
}

btnAddConta?.addEventListener("click", async ()=>{
  try{
    const nome = (contaNome.value||"").trim();
    if(!nome) return alert("Informe o nome da conta!");
    const saldo = parseFloat(contaSaldo.value||0);
    await supabase.from("contas_bancarias").insert([{ nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id }]);
    contaNome.value = ""; contaSaldo.value = "";
    await loadContas();
  }catch(e){ console.error("btnAddConta", e); alert("Erro ao criar conta"); }
});

btnAddLanc?.addEventListener("click", async ()=>{
  try{
    const desc = (descLanc.value||"").trim();
    const valor = parseFloat(valorLanc.value||0);
    const data = dataLanc.value;
    const tipo = tipoLanc.value;
    const conta_id = selectContaLanc?.value;
    if(!desc || !valor || !data) return alert("Preencha todos os campos!");
    if(editing.type){
      const table = editing.type === "receita" ? "receitas" : "despesas";
      await supabase.from(table).update({ descricao: desc, valor, data, conta_id }).eq("id", editing.id);
      stopEdit();
      await refreshLancamentos();
      await renderExtrato();
      return;
    }
    const table = tipo === "receita" ? "receitas" : "despesas";
    await supabase.from(table).insert([{ descricao: desc, valor, data, conta_id, user_id: currentUser.id, baixado: false }]);
    descLanc.value = ""; valorLanc.value = ""; dataLanc.value = "";
    await refreshLancamentos();
    await renderExtrato();
  }catch(e){ console.error("btnAddLanc", e); alert("Erro ao adicionar lançamento"); }
});

btnCancelEdit?.addEventListener("click", ()=> stopEdit());
function stopEdit(){ editing = { type: null, id: null }; descLanc.value = ""; valorLanc.value = ""; dataLanc.value = ""; btnAddLanc.textContent = "Adicionar"; btnCancelEdit.classList.add("hidden"); }
function startEdit(type, item){ editing.type = type; editing.id = item.id; tipoLanc.value = type; valorLanc.value = item.valor; descLanc.value = item.descricao; dataLanc.value = item.data; if(selectContaLanc) selectContaLanc.value = item.conta_id; btnCancelEdit.classList.remove("hidden"); btnAddLanc.textContent = "Salvar"; }

async function deleteItem(type, id){
  try{
    if(!confirm("Excluir?")) return;
    const table = type === "receita" ? "receitas" : "despesas";
    await supabase.from(table).delete().eq("id", id);
    // também remove movimentacao vinculada, se houver
    const { data: mv } = await supabase.from("movimentacoes").select("id,conta_id").eq("lancamento_id", id).maybeSingle();
    if(mv) { await supabase.from("movimentacoes").delete().eq("id", mv.id); await recalcularSaldo(mv.conta_id); }
    await refreshLancamentos();
    await renderExtrato();
  }catch(e){ console.error("deleteItem", e); }
}

btnFiltrarLanc?.addEventListener("click", ()=> refreshLancamentos());

async function refreshLancamentos(){
  try{
    const conta_id = selectContas?.value;
    if(!conta_id) return;
    const now = new Date();
    let inicio = null, fim = null;
    const p = periodoLanc?.value || "mes_atual";
    if(p === "mes_atual"){
      inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if(p === "mes_anterior"){
      const ano = now.getFullYear(), mes = now.getMonth();
      inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
      const last = new Date(ano, mes, 0).getDate();
      fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if(p === "ultimos_30"){
      const past = new Date(now.getTime() - 30*24*60*60*1000);
      inicio = past.toISOString().slice(0,10);
      fim = now.toISOString().slice(0,10);
    } else { // personalizado
      inicio = dataInicioLanc?.value || dataInicio?.value;
      fim = dataFimLanc?.value || dataFim?.value;
    }

    const [r1, r2] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim).order("data"),
      supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim).order("data")
    ]);

    const [rLate, dLate] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).lt("data", inicio).eq("baixado", false).order("data"),
      supabase.from("despesas").select("*").eq("conta_id", conta_id).eq("user_id", currentUser.id).lt("data", inicio).eq("baixado", false).order("data")
    ]);

    listReceitas.innerHTML = ""; listDespesas.innerHTML = "";

    if((rLate?.data?.length || 0) > 0 || (dLate?.data?.length || 0) > 0){
      const tag = document.createElement("li");
      tag.textContent = "Lançamentos Atrasados:";
      tag.style.fontWeight = "700";
      listReceitas.appendChild(tag.cloneNode(true));
      listDespesas.appendChild(tag.cloneNode(true));
    }

    (rLate?.data || []).forEach(i => listReceitas.appendChild(buildLancItem(i, "receita", true)));
    (dLate?.data || []).forEach(i => listDespesas.appendChild(buildLancItem(i, "despesa", true)));

    let totalR = 0, totalD = 0;
    (r1?.data || []).forEach(i => { totalR += Number(i.valor||0); listReceitas.appendChild(buildLancItem(i, "receita", false)); });
    (r2?.data || []).forEach(i => { totalD += Number(i.valor||0); listDespesas.appendChild(buildLancItem(i, "despesa", false)); });

    if(totalReceitasEl) totalReceitasEl.textContent = formatReal(totalR);
    if(totalDespesasEl) totalDespesasEl.textContent = formatReal(totalD);

    const { data: conta } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id", conta_id).maybeSingle();
    if(saldoAtualEl) saldoAtualEl.textContent = formatReal(Number(conta?.saldo_atual || 0));

    await recalcularSaldo(conta_id);
  }catch(e){ console.error("refreshLancamentos", e); }
}

function buildLancItem(item, type, late){
  const li = document.createElement("li");
  li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.alignItems = "center";
  li.style.marginBottom = "8px";
  const left = document.createElement("div");
  const right = document.createElement("div");
  left.textContent = `${formatDate(item.data)} — ${item.descricao} — ${formatReal(Number(item.valor||0))}`;
  if(item.baixado) left.textContent += " — (BAIXADO)";
  if(late && !item.baixado){
    left.textContent += " — (ATRASADO)";
    left.style.borderLeft = "4px solid orange"; left.style.paddingLeft = "6px";
  }
  const btnEdit = document.createElement("button"); btnEdit.textContent = "Editar"; btnEdit.onclick = ()=> startEdit(type, item);
  const btnDel = document.createElement("button"); btnDel.textContent = "Excluir"; btnDel.onclick = ()=> deleteItem(type, item.id);
  right.appendChild(btnEdit); right.appendChild(btnDel);
  if(!item.baixado){
    const btnBaixa = document.createElement("button"); btnBaixa.textContent = "Baixar";
    btnBaixa.onclick = async function(){
      btnBaixa.disabled = true;
      try{ await baixarLancamento(type, item); }catch(e){ console.error(e); }
      btnBaixa.disabled = false;
    };
    right.appendChild(btnBaixa);
  }
  li.appendChild(left); li.appendChild(right);
  return li;
}

async function baixarLancamento(type, item){
  try{
    const { data: contas } = await supabase.from("contas_bancarias").select("*").eq("user_id", currentUser.id);
    if(!contas || !contas.length) return alert("Crie uma conta primeiro.");
    let contaEscolhida = item.conta_id;
    let msg = "Escolha a conta (número) ou deixe vazio para usar a conta original:\n";
    contas.forEach((c,i)=> msg += `${i+1}) ${c.nome} — ${formatReal(c.saldo_atual||0)}\n`);
    const r = prompt(msg, "");
    if(r && r.trim() !== ""){
      const n = parseInt(r, 10);
      if(!isNaN(n) && n >= 1 && n <= contas.length) contaEscolhida = contas[n-1].id;
      else {
        const found = contas.find(c => String(c.id) === r.trim());
        if(found) contaEscolhida = found.id;
        else return alert("Entrada inválida.");
      }
    }
    const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id", contaEscolhida).maybeSingle();
    let novoSaldo = Number(conta?.saldo_atual || 0);
    if(type === "receita") novoSaldo += Number(item.valor); else novoSaldo -= Number(item.valor);
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", contaEscolhida);
    const tabela = type === "receita" ? "receitas" : "despesas";
    const hoje = new Date().toISOString().slice(0,10);
    await supabase.from(tabela).update({ baixado: true, data_baixa: hoje }).eq("id", item.id);
    const { data: existe } = await supabase.from("movimentacoes").select("id").eq("lancamento_id", item.id).maybeSingle();
    if(!existe){
      await supabase.from("movimentacoes").insert([{
        user_id: currentUser.id,
        conta_id: contaEscolhida,
        tipo: type === "receita" ? "credito" : "debito",
        valor: Number(item.valor),
        descricao: item.descricao,
        data: hoje,
        lancamento_id: item.id
      }]);
    }
    await recalcularSaldo(contaEscolhida);
    await refreshLancamentos();
    await renderExtrato();
  }catch(e){ console.error("baixarLancamento", e); alert("Erro ao baixar"); }
}

async function cancelarBaixaMovimentacao(mov){
  try{
    if(!confirm("Cancelar baixa?")) return;
    const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id", mov.conta_id).maybeSingle();
    let novoSaldo = Number(conta?.saldo_atual || 0);
    if(mov.tipo === "credito") novoSaldo -= Number(mov.valor); else novoSaldo += Number(mov.valor);
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id", mov.conta_id);
    await supabase.from("movimentacoes").delete().eq("id", mov.id);
    if(mov.lancamento_id){
      await supabase.from("receitas").update({ baixado:false, data_baixa: null }).eq("id", mov.lancamento_id);
      await supabase.from("despesas").update({ baixado:false, data_baixa: null }).eq("id", mov.lancamento_id);
    }
    await recalcularSaldo(mov.conta_id);
    await refreshLancamentos();
    await renderExtrato();
  }catch(e){ console.error("cancelarBaixaMovimentacao", e); alert("Erro ao cancelar baixa"); }
}

btnFiltrarExtrato?.addEventListener("click", ()=> renderExtrato());

async function renderExtrato(){
  try{
    const conta_id = selectExtrato?.value;
    if(!conta_id || !tableExtrato) return;
    await recalcularSaldo(conta_id);
    const now = new Date();
    const p = periodoExtrato?.value || "mes_atual";
    let inicio, fim;
    if(p === "mes_atual"){
      inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if(p === "mes_anterior"){
      const ano = now.getFullYear(), mes = now.getMonth();
      inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
      const last = new Date(ano, mes, 0).getDate();
      fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    } else if(p === "ultimos_30"){
      const past = new Date(now.getTime() - 30*24*60*60*1000);
      inicio = past.toISOString().slice(0,10); fim = now.toISOString().slice(0,10);
    } else {
      inicio = dataInicio?.value; fim = dataFim?.value;
    }

    const { data: conta } = await supabase.from("contas_bancarias").select("saldo_inicial,created_at,saldo_atual").eq("id", conta_id).maybeSingle();
    const saldoInicial = Number(conta?.saldo_inicial || 0);
    const dataCriacao = conta?.created_at ? (new Date(conta.created_at)).toISOString().slice(0,10) : null;

    const { data: movs } = await supabase.from("movimentacoes").select("*").eq("conta_id", conta_id).gte("data", inicio).lte("data", fim).order("data");

    const linhas = [];
    if(saldoInicial !== 0 && dataCriacao) linhas.push({ tipo: "inicial", data: dataCriacao, descricao: "SALDO INICIAL", valor: saldoInicial });

    (movs || []).forEach(m => linhas.push({ tipo: "mov", data: m.data, descricao: m.descricao, valor: Number(m.valor||0), mov: m }));
    linhas.sort((a,b)=> new Date(a.data+"T00:00:00") - new Date(b.data+"T00:00:00"));

    tableExtrato.innerHTML = "";
    let cred = 0, deb = 0;

    linhas.forEach(l=>{
      const tr = document.createElement("tr");
      const tdA = document.createElement("td");
      if(l.tipo === "inicial"){
        tr.innerHTML = `<td>${formatDate(l.data)}</td><td>${l.descricao}</td><td>Crédito</td><td>${formatReal(l.valor)}</td>`;
        cred += l.valor;
      } else {
        tr.innerHTML = `<td>${formatDate(l.data)}</td><td>${l.descricao}</td><td>${l.mov.tipo==="credito"?"Crédito":"Débito"}</td><td>${formatReal(l.valor)}</td>`;
        if(l.mov.tipo === "credito") cred += l.valor; else deb += l.valor;
        if(l.mov.lancamento_id){
          const btn = document.createElement("button"); btn.textContent = "Cancelar Baixa"; btn.onclick = ()=> cancelarBaixaMovimentacao(l.mov); tdA.appendChild(btn);
        }
      }
      tr.appendChild(tdA);
      tableExtrato.appendChild(tr);
    });

    document.getElementById("total-receitas-extrato")?.textContent = formatReal(cred);
    document.getElementById("total-despesas-extrato")?.textContent = formatReal(deb);
    document.getElementById("saldo-periodo-extrato")?.textContent = formatReal(cred-deb);
    document.getElementById("saldo-atual-conta-extrato")?.textContent = formatReal(Number(conta?.saldo_atual || 0));
    document.getElementById("total-valor")?.textContent = formatReal(cred-deb);
  }catch(e){ console.error("renderExtrato", e); }
}

/* loadDashboard: gera dados do mês atual e plota gráfico */
async function loadDashboard(){
  try{
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth()+1;
    const inicio = `${ano}-${String(mes).padStart(2,"0")}-01`;
    const last = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;

    const rec = await supabase.from("receitas").select("*").eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim);
    const desp = await supabase.from("despesas").select("*").eq("user_id", currentUser.id).gte("data", inicio).lte("data", fim);

    const totalR = (rec.data || []).reduce((s,x)=> s + Number(x.valor||0), 0);
    const totalD = (desp.data || []).reduce((s,x)=> s + Number(x.valor||0), 0);

    document.getElementById("dash-period")?.textContent = `${mes}/${ano}`;
    document.getElementById("dash-receber")?.textContent = formatReal(totalR);
    document.getElementById("dash-pagar")?.textContent = formatReal(totalD);
    document.getElementById("dash-saldo-atual")?.textContent = formatReal(totalR - totalD);
    document.getElementById("dash-saldo-previsto")?.textContent = formatReal(totalR - totalD);

    const ctx = document.getElementById("chart-dashboard");
    if(!ctx) return;
    if(chartDashboard) chartDashboard.destroy();
    chartDashboard = new Chart(ctx, {
      type: "bar",
      data: { labels: ["Receitas","Despesas"], datasets:[{ label: "Resumo do mês", data: [totalR, totalD], backgroundColor: ["green","red"] }] },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }catch(e){ console.error("loadDashboard", e); }
}

function subscribeToChanges(){
  try{
    supabase.channel("listen_rec").on("postgres_changes", { event: "*", schema: "public", table: "receitas" }, payload => { if(payload.record?.user_id === currentUser.id) refreshLancamentos(); }).subscribe();
    supabase.channel("listen_des").on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, payload => { if(payload.record?.user_id === currentUser.id) refreshLancamentos(); }).subscribe();
    supabase.channel("listen_mov").on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, ()=> renderExtrato()).subscribe();
  }catch(e){ console.error("subscribeToChanges", e); }
}

function showScreen(s){
  telaDashboard?.classList.add("hidden");
  telaContas?.classList.add("hidden");
  telaLanc?.classList.add("hidden");
  btnDash?.classList.remove("active");
  btnContas?.classList.remove("active");
  btnLanc?.classList.remove("active");

  if(s === "dashboard"){ telaDashboard?.classList.remove("hidden"); btnDash?.classList.add("active"); loadDashboard(); }
  else if(s === "contas"){ telaContas?.classList.remove("hidden"); btnContas?.classList.add("active"); }
  else { telaLanc?.classList.remove("hidden"); btnLanc?.classList.add("active"); }
}

btnDash?.addEventListener("click", ()=> showScreen("dashboard"));
btnContas?.addEventListener("click", ()=> showScreen("contas"));
btnLanc?.addEventListener("click", ()=> showScreen("lanc"));

periodoLanc?.addEventListener("change", ()=> {
  if(periodoLanc.value === "personalizado"){ dataInicioLanc?.classList.remove("hidden"); dataFimLanc?.classList.remove("hidden"); }
  else { dataInicioLanc?.classList.add("hidden"); dataFimLanc?.classList.add("hidden"); }
});
periodoExtrato?.addEventListener("change", ()=> {
  if(periodoExtrato.value === "personalizado"){ dataInicio?.classList.remove("hidden"); dataFim?.classList.remove("hidden"); }
  else { dataInicio?.classList.add("hidden"); dataFim?.classList.add("hidden"); }
});
