function formatDate(dateString){if(!dateString) return "";const d=new Date(dateString+"T00:00:00");const dia=String(d.getDate()).padStart(2,"0");const mes=String(d.getMonth()+1).padStart(2,"0");const ano=d.getFullYear();return `${dia}/${mes}/${ano}`;}
function formatReal(v){if(typeof v!=="number") v=Number(v||0);return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

let currentUser=null;
let editing={type:null,id:null};

const telaDashboard=document.getElementById("tela-dashboard");
const telaContas=document.getElementById("tela-contas");
const telaLanc=document.getElementById("tela-lancamentos");

const btnDash=document.getElementById("menu-dashboard");
const btnContas=document.getElementById("menu-contas");
const btnLanc=document.getElementById("menu-lancamentos");

const selectContas=document.getElementById("select-contas");
const contaNome=document.getElementById("conta-nome");
const contaSaldo=document.getElementById("conta-saldo");
const btnAddConta=document.getElementById("btn-add-conta");

const tipoLanc=document.getElementById("tipo-lancamento");
const valorLanc=document.getElementById("valor-lanc");
const descLanc=document.getElementById("desc-lanc");
const dataLanc=document.getElementById("data-lanc");
const btnAddLanc=document.getElementById("btn-add-lanc");
const btnCancelEdit=document.getElementById("btn-cancel-edit");
const selectContaLanc=document.getElementById("select-conta-lanc");

const saldoAtualEl=document.getElementById("saldo-atual");
const totalReceitasEl=document.getElementById("total-receitas");
const totalDespesasEl=document.getElementById("total-despesas");

const listReceitas=document.getElementById("list-receitas");
const listDespesas=document.getElementById("list-despesas");

const tabCadastro=document.getElementById("tab-cadastro");
const tabExtrato=document.getElementById("tab-extrato");

const selectExtrato=document.getElementById("select-contas-extrato");
const periodoExtrato=document.getElementById("periodo-extrato");
const dataInicio=document.getElementById("data-inicio");
const dataFim=document.getElementById("data-fim");
const btnFiltrarExtrato=document.getElementById("btn-filtrar-extrato");

let tableExtrato=null;
document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("table-extrato");if(t) tableExtrato=t.querySelector("tbody");});

let chartDashboard=null;

supabase.auth.getSession().then(({data})=>{if(!data.session) window.location.href="login.html"; else{currentUser=data.session.user;const ue=document.getElementById("user-email");if(ue) ue.textContent=currentUser.email;initApp();}});

const btnLogout=document.getElementById("btn-logout"); if(btnLogout) btnLogout.onclick=async()=>{await supabase.auth.signOut(); window.location.href="login.html";};

async function initApp(){await loadContas(); subscribeToChanges();}

async function loadContas(){
  try{
    const {data,error}=await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(error) throw error;
    selectContas.innerHTML="";
    (data||[]).forEach(c=>{const opt=document.createElement("option");opt.value=c.id;opt.textContent=`${c.nome} (R$ ${Number(c.saldo_inicial||0).toFixed(2)})`;selectContas.appendChild(opt);});
    if((data||[]).length>0){if(!selectContas.value) selectContas.value=data[0].id; await refreshMovements();}
  }catch(e){console.error("loadContas",e);}
}

if(btnAddConta) btnAddConta.onclick=async()=>{
  try{
    const nome=(contaNome.value||"").trim(); if(!nome) return alert("Informe o nome da conta!");
    const saldo=parseFloat(contaSaldo.value||0);
    const {error}=await supabase.from("contas_bancarias").insert([{nome,saldo_inicial:saldo,saldo_atual:saldo,user_id:currentUser.id}]);
    if(error) return alert(error.message);
    contaNome.value=""; contaSaldo.value="";
    await loadContas();
  }catch(e){console.error(e); alert("Erro ao adicionar conta");}
};

async function loadContasExtra(){
  try{
    const {data,error}=await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(error) throw error;
    if(selectExtrato) selectExtrato.innerHTML="";
    if(selectContaLanc) selectContaLanc.innerHTML="";
    (data||[]).forEach(c=>{const o1=document.createElement("option"); o1.value=c.id; o1.textContent=c.nome; const o2=o1.cloneNode(true); if(selectExtrato) selectExtrato.appendChild(o1); if(selectContaLanc) selectContaLanc.appendChild(o2);});
    if(selectContaLanc && !selectContaLanc.value && (data||[]).length>0) selectContaLanc.value=data[0].id;
    if(selectExtrato && !selectExtrato.value && (data||[]).length>0) selectExtrato.value=data[0].id;
  }catch(e){console.error("loadContasExtra",e);}
}

const originalLoadContas=loadContas;
loadContas=async()=>{await originalLoadContas(); await loadContasExtra();};

function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d;}
function addMonths(date,months){const d=new Date(date);const m=d.getMonth()+months;d.setMonth(m);return d;}
function addYears(date,years){const d=new Date(date);d.setFullYear(d.getFullYear()+years);return d;}

if(btnAddLanc) btnAddLanc.onclick=async()=>{
  try{
    const valor=parseFloat(valorLanc.value); const desc=(descLanc.value||"").trim(); const data=dataLanc.value; const tipo=tipoLanc.value; const conta_id=selectContaLanc.value;
    const recorrenciaTipo = document.getElementById("recorrencia-tipo") ? document.getElementById("recorrencia-tipo").value : "none";
    const recorrenciaParcelas = document.getElementById("recorrencia-parcelas") ? parseInt(document.getElementById("recorrencia-parcelas").value||"1",10) : 1;
    if(!valor || !desc || !data) return alert("Preencha todos os campos!");
    if(editing.type){
      const table=editing.type==="receita"?"receitas":"despesas";
      const {error}=await supabase.from(table).update({descricao:desc,valor,data,conta_id}).eq("id",editing.id);
      if(error) return alert(error.message);
      stopEdit(); refreshMovements(); return;
    }
    const created = [];
    if(recorrenciaTipo && recorrenciaTipo!=="none" && recorrenciaParcelas>1){
      let base=new Date(data+"T00:00:00");
      for(let i=0;i<recorrenciaParcelas;i++){
        let d;
        if(recorrenciaTipo==="monthly") d=addMonths(base,i);
        else if(recorrenciaTipo==="fortnight") d=addDays(base,i*15);
        else if(recorrenciaTipo==="weekly") d=addDays(base,i*7);
        else if(recorrenciaTipo==="annual") d=addYears(base,i);
        else d=addMonths(base,i);
        const iso=d.toISOString().slice(0,10);
        const payload={descricao:desc,valor,data:iso,conta_id,user_id:currentUser.id,baixado:false};
        const table=tipo==="receita"?"receitas":"despesas";
        created.push({table,payload});
      }
    } else {
      const payload={descricao:desc,valor,data,conta_id,user_id:currentUser.id,baixado:false};
      const table=tipo==="receita"?"receitas":"despesas";
      created.push({table,payload});
    }
    for(const c of created){
      const { error } = await supabase.from(c.table).insert([c.payload]);
      if(error) console.error("erro insert parcela",error);
    }
    valorLanc.value=""; descLanc.value=""; dataLanc.value="";
    refreshMovements(); renderExtrato();
  }catch(e){console.error("btnAddLanc",e); alert("Erro ao adicionar lançamento");}
};

if(btnCancelEdit) btnCancelEdit.onclick=()=>stopEdit();

function startEdit(type,item){editing.type=type; editing.id=item.id; tipoLanc.value=type; valorLanc.value=item.valor; descLanc.value=item.descricao; dataLanc.value=item.data; if(selectContaLanc) selectContaLanc.value=item.conta_id; btnAddLanc.textContent="Salvar"; btnCancelEdit.classList.remove("hidden");}
function stopEdit(){editing={type:null,id:null}; valorLanc.value=""; descLanc.value=""; dataLanc.value=""; if(btnAddLanc) btnAddLanc.textContent="Adicionar"; if(btnCancelEdit) btnCancelEdit.classList.add("hidden");}

async function deleteItem(type,id){ if(!confirm("Deseja excluir este lançamento?")) return; const table=type==="receita"?"receitas":"despesas"; const {error}=await supabase.from(table).delete().eq("id",id); if(error) return alert(error.message); refreshMovements(); renderExtrato(); }

async function refreshMovements(){
  try{
    const conta_id=selectContas.value;
    const [rRes,dRes]=await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).order("data"),
      supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).order("data")
    ]);
    const rec=rRes.data||[]; const desp=dRes.data||[];
    listReceitas.innerHTML=""; listDespesas.innerHTML="";
    let totalR=0,totalD=0;
    rec.forEach(i=>{ totalR+=Number(i.valor||0); listReceitas.appendChild(createLancamentoItem(i,"receita"));});
    desp.forEach(i=>{ totalD+=Number(i.valor||0); listDespesas.appendChild(createLancamentoItem(i,"despesa"));});
    totalReceitasEl.textContent=formatReal(totalR); totalDespesasEl.textContent=formatReal(totalD);
    const opt=selectContas.selectedOptions[0]; const saldoInicial=opt?parseFloat(opt.textContent.match(/\(R\$ ([0-9.,]+)\)/)[1].replace(",",".")):0;
    saldoAtualEl.textContent=formatReal(saldoInicial+totalR-totalD);
  }catch(e){console.error("refreshMovements",e);}
}

function createLancamentoItem(item,type){
  const li=document.createElement("li");
  li.style.fontFamily=`"Courier New",monospace`; li.style.fontWeight="bold"; li.style.marginBottom="10px"; li.style.color=type==="receita"?"green":"red";
  const textSpan=document.createElement("span"); textSpan.textContent=`${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;
  if(item.baixado){ li.style.opacity="0.6"; const t=document.createElement("small"); t.textContent=" (baixado)"; textSpan.appendChild(t); }
  li.appendChild(textSpan);
  const actions=document.createElement("span"); actions.style.float="right";
  if(!item.baixado){ const baixarBtn=document.createElement("button"); baixarBtn.textContent="Baixar"; baixarBtn.style.marginLeft="5px"; baixarBtn.onclick=()=>baixarLancamento(type,item); actions.appendChild(baixarBtn); }
  const editBtn=document.createElement("button"); editBtn.textContent="Editar"; editBtn.style.marginLeft="5px"; editBtn.onclick=()=>startEdit(type,item);
  const delBtn=document.createElement("button"); delBtn.textContent="Excluir"; delBtn.style.marginLeft="5px"; delBtn.onclick=()=>deleteItem(type,item.id);
  actions.appendChild(editBtn); actions.appendChild(delBtn); li.appendChild(actions);
  return li;
}

async function baixarLancamento(type,item){
  try{
    const {data:contas,error:errContas}=await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(errContas) throw errContas;
    if(!contas||contas.length===0) return alert("Crie uma conta antes.");
    let msg="Escolha a conta para baixar:\n"; contas.forEach((c,i)=>{msg+=`${i+1}) ${c.nome} — ${formatReal(c.saldo_atual||0)} — id:${c.id}\n`;}); msg+="\nDigite o número ou deixe vazio para usar a conta original:";
    const resp=prompt(msg,"");
    let contaEscolhidaId=item.conta_id;
    if(resp&&resp.trim()!==""){const n=parseInt(resp,10); if(!isNaN(n)&&n>=1&&n<=contas.length) contaEscolhidaId=contas[n-1].id; else{const f=contas.find(c=>String(c.id)===resp.trim()); if(f) contaEscolhidaId=f.id; else return alert("Entrada inválida.");}}
    const {data:conta, error:errConta}=await supabase.from("contas_bancarias").select("*").eq("id",contaEscolhidaId).single();
    if(errConta) throw errConta;
    let novoSaldo=Number(conta.saldo_atual||0);
    if(type==="receita") novoSaldo+=Number(item.valor); else novoSaldo-=Number(item.valor);
    const {error:errUpdate}=await supabase.from("contas_bancarias").update({saldo_atual:novoSaldo}).eq("id",contaEscolhidaId);
    if(errUpdate) throw errUpdate;
    const table=type==="receita"?"receitas":"despesas";
    const {error:errLanc}=await supabase.from(table).update({baixado:true,data_baixa:new Date().toISOString().slice(0,10)}).eq("id",item.id);
    if(errLanc) throw errLanc;
    const mov={user_id:currentUser.id,conta_id:contaEscolhidaId,tipo:type==="receita"?"credito":"debito",valor:item.valor,descricao:`Baixa de "${item.descricao}"`,data:new Date().toISOString().slice(0,10),lancamento_id:item.id};
    const {error:errMov}=await supabase.from("movimentacoes").insert([mov]);
    if(errMov) throw errMov;
    alert("Lançamento baixado!");
    refreshMovements(); renderExtrato();
  }catch(e){console.error("baixarLancamento",e); alert("Erro ao baixar: "+(e.message||JSON.stringify(e))); }
}

async function cancelarBaixaMovimentacao(mov){
  try{
    if(!confirm("Deseja cancelar esta baixa?")) return;
    const {data:conta,error:errConta}=await supabase.from("contas_bancarias").select("*").eq("id",mov.conta_id).single();
    if(errConta) throw errConta;
    let novoSaldo=Number(conta.saldo_atual||0);
    if(mov.tipo==="credito") novoSaldo-=Number(mov.valor); else novoSaldo+=Number(mov.valor);
    const {error:errSaldo}=await supabase.from("contas_bancarias").update({saldo_atual:novoSaldo}).eq("id",mov.conta_id);
    if(errSaldo) throw errSaldo;
    const {error:errDel}=await supabase.from("movimentacoes").delete().eq("id",mov.id);
    if(errDel) throw errDel;
    await supabase.from("receitas").update({baixado:false,data_baixa:null}).eq("id",mov.lancamento_id);
    await supabase.from("despesas").update({baixado:false,data_baixa:null}).eq("id",mov.lancamento_id);
    alert("Baixa cancelada!");
    refreshMovements(); renderExtrato();
  }catch(e){console.error("cancelarBaixa",e); alert("Erro ao cancelar baixa: "+(e.message||JSON.stringify(e))); }
}

function subscribeToChanges(){
  try{
    supabase.channel("rt_receitas").on("postgres_changes",{event:"*",schema:"public",table:"receitas"},payload=>{ if(payload.record?.user_id===currentUser.id) refreshMovements(); }).subscribe();
    supabase.channel("rt_despesas").on("postgres_changes",{event:"*",schema:"public",table:"despesas"},payload=>{ if(payload.record?.user_id===currentUser.id) refreshMovements(); }).subscribe();
    supabase.channel("rt_contas").on("postgres_changes",{event:"*",schema:"public",table:"contas_bancarias"},payload=>{ refreshMovements(); renderExtrato(); }).subscribe();
    supabase.channel("rt_movimentacoes").on("postgres_changes",{event:"*",schema:"public",table:"movimentacoes"},payload=>{ renderExtrato(); }).subscribe();
  }catch(e){console.error("subscribe",e);}
}

function showScreen(target){
  if(telaDashboard) telaDashboard.classList.add("hidden");
  if(telaContas) telaContas.classList.add("hidden");
  if(telaLanc) telaLanc.classList.add("hidden");
  if(btnDash) btnDash.classList.remove("active");
  if(btnContas) btnContas.classList.remove("active");
  if(btnLanc) btnLanc.classList.remove("active");
  if(target==="dashboard"){ if(telaDashboard) telaDashboard.classList.remove("hidden"); if(btnDash) btnDash.classList.add("active"); loadDashboard(); }
  else if(target==="contas"){ if(telaContas) telaContas.classList.remove("hidden"); if(btnContas) btnContas.classList.add("active"); }
  else if(target==="lanc"){ if(telaLanc) telaLanc.classList.remove("hidden"); if(btnLanc) btnLanc.classList.add("active"); }
}

if(btnDash) btnDash.onclick=()=>showScreen("dashboard");
if(btnContas) btnContas.onclick=()=>showScreen("contas");
if(btnLanc) btnLanc.onclick=()=>showScreen("lanc");

document.querySelectorAll(".tab-btn").forEach(b=>{ b.onclick=()=>{ document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); const tab=b.dataset.tab; if(tab==="cadastro"){ if(tabCadastro) tabCadastro.classList.remove("hidden"); if(tabExtrato) tabExtrato.classList.add("hidden"); } else { if(tabCadastro) tabCadastro.classList.add("hidden"); if(tabExtrato) tabExtrato.classList.remove("hidden"); renderExtrato(); } }; });

if(btnFiltrarExtrato) btnFiltrarExtrato.onclick=()=>renderExtrato();

async function renderExtrato(){
  try{
    if(!tableExtrato) return;
    const conta_id=selectExtrato.value; const now=new Date();
    let inicio,fim; const periodo=periodoExtrato.value;
    if(periodo==="mes_atual"){ inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="mes_anterior"){ const ano=now.getFullYear(); const mes=now.getMonth(); inicio=`${ano}-${String(mes).padStart(2,"0")}-01`; const last=new Date(ano,mes,0).getDate(); fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="ultimos_30"){ const past=new Date(now.getTime()-30*24*60*60*1000); inicio=`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,"0")}-${String(past.getDate()).padStart(2,"0")}`; fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
    else if(periodo==="personalizado"){ inicio=dataInicio.value; fim=dataFim.value; } else { inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    const [recRes,despRes,movRes]=await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id",conta_id).gte("data",inicio).lte("data",fim),
      supabase.from("despesas").select("*").eq("conta_id",conta_id).gte("data",inicio).lte("data",fim),
      supabase.from("movimentacoes").select("*").eq("conta_id",conta_id).gte("data",inicio).lte("data",fim)
    ]);
    const unified=[];
    (recRes.data||[]).forEach(r=>unified.push({categoria:"receita",data:r.data,descricao:r.descricao,valor:Number(r.valor||0),orig:r}));
    (despRes.data||[]).forEach(d=>unified.push({categoria:"despesa",data:d.data,descricao:d.descricao,valor:Number(d.valor||0),orig:d}));
    (movRes.data||[]).forEach(m=>unified.push({categoria:"mov",data:m.data,descricao:m.descricao,valor:Number(m.valor||0),mov:m}));
    unified.sort((a,b)=>new Date(a.data+"T00:00:00")-new Date(b.data+"T00:00:00"));
    tableExtrato.innerHTML="";
    let totalR=0,totalD=0;
    unified.forEach(row=>{ const tr=document.createElement("tr"); const tdA=document.createElement("td"); if(row.categoria==="receita"){ tr.innerHTML=`<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td>Receita</td><td>${formatReal(row.valor)}</td>`; totalR+=row.valor; } else if(row.categoria==="despesa"){ tr.innerHTML=`<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td>Despesa</td><td>${formatReal(row.valor)}</td>`; totalD+=row.valor; } else { tr.innerHTML=`<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td>Movimentação</td><td>${formatReal(row.valor)}</td>`; if(row.mov && row.mov.lancamento_id){ const btn=document.createElement("button"); btn.textContent="Cancelar Baixa"; btn.onclick=()=>cancelarBaixaMovimentacao(row.mov); tdA.appendChild(btn); } } tr.appendChild(tdA); tableExtrato.appendChild(tr); });
    const {data:conta}=await supabase.from("contas_bancarias").select("*").eq("id",conta_id).single();
    if(conta) document.getElementById("saldo-atual-conta-extrato").textContent=formatReal(conta.saldo_atual||0);
    const tre=document.getElementById("total-receitas-extrato"); if(tre) tre.textContent=formatReal(totalR); const tde=document.getElementById("total-despesas-extrato"); if(tde) tde.textContent=formatReal(totalD); const tv=document.getElementById("total-valor"); if(tv) tv.textContent=formatReal(totalR-totalD);
  }catch(e){console.error("renderExtrato",e);}
}

async function loadDashboard(){
  try{
    const now=new Date(); const ano=now.getFullYear(); const mes=now.getMonth()+1;
    const inicio=`${ano}-${String(mes).padStart(2,"0")}-01`; const ultimo=new Date(ano,mes,0).getDate(); const fim=`${ano}-${String(mes).padStart(2,"0")}-${String(ultimo).padStart(2,"0")}`;
    const receitas=await supabase.from("receitas").select("*").eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);
    const despesas=await supabase.from("despesas").select("*").eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);
    const totalR=(receitas.data||[]).reduce((s,r)=>s+Number(r.valor||0),0); const totalD=(despesas.data||[]).reduce((s,d)=>s+Number(d.valor||0),0);
    const dp=document.getElementById("dash-period"); if(dp) dp.textContent=`${mes}/${ano}`; const dr=document.getElementById("dash-receber"); if(dr) dr.textContent=formatReal(totalR); const pd=document.getElementById("dash-pagar"); if(pd) pd.textContent=formatReal(totalD); const sa=document.getElementById("dash-saldo-atual"); if(sa) sa.textContent=formatReal(totalR-totalD); const sp=document.getElementById("dash-saldo-previsto"); if(sp) sp.textContent=formatReal(totalR-totalD);
    try{ const ctx=document.getElementById("chart-dashboard"); if(ctx){ if(chartDashboard) chartDashboard.destroy(); chartDashboard=new Chart(ctx,{type:"bar",data:{labels:["Receitas","Despesas"],datasets:[{label:"Resumo do mês",data:[totalR,totalD],backgroundColor:["green","red"]}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}}); } }catch(e){}
  }catch(e){console.error("loadDashboard",e);}
}

subscribeToChanges();

showScreen("contas");
if(selectContas) selectContas.onchange=()=>refreshMovements();
if(selectContaLanc) selectContaLanc.onchange=()=>{};
if(selectExtrato) selectExtrato.onchange=()=>renderExtrato();
if(periodoExtrato) periodoExtrato.onchange=()=>{ if(periodoExtrato.value==="personalizado"){ if(dataInicio) dataInicio.classList.remove("hidden"); if(dataFim) dataFim.classList.remove("hidden"); } else { if(dataInicio) dataInicio.classList.add("hidden"); if(dataFim) dataFim.classList.add("hidden"); } };
