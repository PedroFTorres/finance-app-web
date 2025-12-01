function formatDate(d){ if(!d)return""; const D=new Date(d+"T00:00:00"); return String(D.getDate()).padStart(2,"0")+"/"+String(D.getMonth()+1).padStart(2,"0")+"/"+D.getFullYear(); }
function formatReal(v){ return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

let currentUser=null;
let editing={type:null,id:null};
let chartDashboard=null;

// --- ELEMENTOS ---
const telaDashboard=document.getElementById("tela-dashboard");
const telaContas=document.getElementById("tela-contas");
const telaLanc=document.getElementById("tela-lancamentos");

// menu
const btnDash=document.getElementById("menu-dashboard");
const btnContas=document.getElementById("menu-contas");
const btnLanc=document.getElementById("menu-lancamentos");

// contas
const selectContas=document.getElementById("select-contas");
const contaNome=document.getElementById("conta-nome");
const contaSaldo=document.getElementById("conta-saldo");
const btnAddConta=document.getElementById("btn-add-conta");

// lancamentos
const tipoLanc=document.getElementById("tipo-lancamento");
const valorLanc=document.getElementById("valor-lanc");
const descLanc=document.getElementById("desc-lanc");
const dataLanc=document.getElementById("data-lanc");
const selectContaLanc=document.getElementById("select-conta-lanc");
const btnAddLanc=document.getElementById("btn-add-lanc");
const btnCancelEdit=document.getElementById("btn-cancel-edit");

// totais
const saldoAtualEl=document.getElementById("saldo-atual");
const totalReceitasEl=document.getElementById("total-receitas");
const totalDespesasEl=document.getElementById("total-despesas");

// listas
const listReceitas=document.getElementById("list-receitas");
const listDespesas=document.getElementById("list-despesas");

// filtros lancamentos
const periodoLanc=document.getElementById("periodo-lanc");
const dataInicioLanc=document.getElementById("data-inicio-lanc");
const dataFimLanc=document.getElementById("data-fim-lanc");
const btnFiltrarLanc=document.getElementById("btn-filtrar-lanc");

// extrato
const selectExtrato=document.getElementById("select-contas-extrato");
const periodoExtrato=document.getElementById("periodo-extrato");
const dataInicio=document.getElementById("data-inicio");
const dataFim=document.getElementById("data-fim");
const btnFiltrarExtrato=document.getElementById("btn-filtrar-extrato");
let tableExtrato=null;

document.addEventListener("DOMContentLoaded",()=>{
  const t=document.getElementById("table-extrato");
  if(t) tableExtrato=t.querySelector("tbody");
});

// --- AUTENTICAÇÃO ---
supabase.auth.getSession().then(({data})=>{
  if(!data.session) return window.location.href="login.html";
  currentUser=data.session.user;
  document.getElementById("user-email").textContent=currentUser.email;
  initApp();
});

document.getElementById("btn-logout").onclick=async()=>{ 
  await supabase.auth.signOut(); 
  window.location.href="login.html"; 
};

// --- INICIAL ---
async function initApp(){
  await loadContas();
  subscribeToChanges();
  showScreen("contas");
}

// --- RECALCULAR SALDO ---
async function recalcularSaldo(conta_id){
  const {data:conta}=await supabase.from("contas_bancarias")
      .select("saldo_inicial").eq("id",conta_id).maybeSingle();
  const saldoInicial=Number(conta?.saldo_inicial||0);

  const {data:movs}=await supabase.from("movimentacoes")
      .select("tipo,valor").eq("conta_id",conta_id);

  let cred=0,deb=0;
  (movs||[]).forEach(m=>{
    const v=Number(m.valor||0);
    if(m.tipo==="credito") cred+=v;
    else deb+=v;
  });

  const novoSaldo=saldoInicial+cred-deb;

  await supabase.from("contas_bancarias")
      .update({saldo_atual:novoSaldo})
      .eq("id",conta_id);

  return novoSaldo;
}

// --- CARREGAR CONTAS ---
async function loadContas(){
  const {data}=await supabase.from("contas_bancarias")
        .select("*").eq("user_id",currentUser.id).order("created_at");

  selectContas.innerHTML="";
  (data||[]).forEach(c=>{
    const o=document.createElement("option");
    o.value=c.id;
    o.textContent=`${c.nome} (${formatReal(c.saldo_inicial)})`;
    selectContas.appendChild(o);
  });

  if(data?.length){
    selectContas.value=data[0].id;
    await recalcularSaldo(selectContas.value);
    await refreshLancamentos();
  }
  await loadContasLancExtrato();
}

async function loadContasLancExtrato(){
  const {data}=await supabase.from("contas_bancarias")
        .select("*").eq("user_id",currentUser.id).order("created_at");

  selectContaLanc.innerHTML="";
  selectExtrato.innerHTML="";

  (data||[]).forEach(c=>{
    const o1=document.createElement("option");
    o1.value=c.id;o1.textContent=c.nome;
    selectContaLanc.appendChild(o1);

    const o2=document.createElement("option");
    o2.value=c.id;o2.textContent=c.nome;
    selectExtrato.appendChild(o2);
  });

  if(data?.length){
    selectContaLanc.value=data[0].id;
    selectExtrato.value=data[0].id;
  }
}

// --- ADICIONAR CONTA ---
btnAddConta.onclick=async()=>{
  const nome=(contaNome.value||"").trim();
  if(!nome) return alert("Informe o nome da conta!");
  const saldo=parseFloat(contaSaldo.value||0);

  await supabase.from("contas_bancarias")
    .insert([{nome,saldo_inicial:saldo,saldo_atual:saldo,user_id:currentUser.id}]);

  contaNome.value="";
  contaSaldo.value="";

  await loadContas();
};

// --- ADICIONAR / EDITAR LANÇAMENTO ---
btnAddLanc.onclick=async()=>{
  const desc=descLanc.value.trim();
  const valor=Number(valorLanc.value||0);
  const data=dataLanc.value;
  const type=tipoLanc.value;
  const conta_id=selectContaLanc.value;

  if(!desc||!valor||!data) return alert("Preencha tudo.");

  if(editing.type){
    const table=editing.type==="receita"?"receitas":"despesas";
    await supabase.from(table).update({descricao:desc,valor,data,conta_id}).eq("id",editing.id);
    stopEdit();
    await refreshLancamentos();
    await renderExtrato();
    return;
  }

  const tabela=type==="receita"?"receitas":"despesas";
  await supabase.from(tabela).insert([{
    descricao:desc,valor,data,conta_id,user_id:currentUser.id,baixado:false
  }]);

  descLanc.value="";
  valorLanc.value="";
  dataLanc.value="";

  await refreshLancamentos();
  await renderExtrato();
};

btnCancelEdit.onclick=()=>stopEdit();

function stopEdit(){
  editing={type:null,id:null};
  descLanc.value="";
  valorLanc.value="";
  dataLanc.value="";
  btnAddLanc.textContent="Adicionar";
  btnCancelEdit.classList.add("hidden");
}

function startEdit(type,item){
  editing={type,id:item.id};
  tipoLanc.value=type;
  valorLanc.value=item.valor;
  descLanc.value=item.descricao;
  dataLanc.value=item.data;
  selectContaLanc.value=item.conta_id;
  btnAddLanc.textContent="Salvar";
  btnCancelEdit.classList.remove("hidden");
}

// --- EXCLUIR ---
async function deleteItem(type,id){
  if(!confirm("Excluir?")) return;
  const tabela=type==="receita"?"receitas":"despesas";

  await supabase.from(tabela).delete().eq("id",id);

  const {data:mv}=await supabase.from("movimentacoes")
        .select("id,conta_id").eq("lancamento_id",id).maybeSingle();

  if(mv){
    await supabase.from("movimentacoes").delete().eq("id",mv.id);
    await recalcularSaldo(mv.conta_id);
  }

  await refreshLancamentos();
  await renderExtrato();
}

// --- REFRESH LANÇAMENTOS + FILTROS ---
btnFiltrarLanc.onclick=()=>refreshLancamentos();

async function refreshLancamentos(){
  const conta_id=selectContas.value;
  const now=new Date();
  let inicio,fim;
  const p=periodoLanc.value;

  if(p==="mes_atual"){
    inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${last}`;
  }else if(p==="mes_anterior"){
    const ano=now.getFullYear(),mes=now.getMonth();
    inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
    const last=new Date(ano,mes,0).getDate();
    fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;
  }else if(p==="ultimos_30"){
    const past=new Date(now.getTime()-30*86400000);
    inicio=past.toISOString().slice(0,10);
    fim=now.toISOString().slice(0,10);
  }else{
    inicio=dataInicioLanc.value;
    fim=dataFimLanc.value;
  }

  const [R,D]=await Promise.all([
    supabase.from("receitas")
      .select("*").eq("user_id",currentUser.id)
      .eq("conta_id",conta_id).gte("data",inicio).lte("data",fim).order("data"),
    supabase.from("despesas")
      .select("*").eq("user_id",currentUser.id)
      .eq("conta_id",conta_id).gte("data",inicio).lte("data",fim).order("data")
  ]);

  listReceitas.innerHTML="";
  listDespesas.innerHTML="";

  let totalR=0,totalD=0;

  (R.data||[]).forEach(i=>{
    totalR+=Number(i.valor||0);
    listReceitas.appendChild(buildLancItem(i,"receita",false));
  });

  (D.data||[]).forEach(i=>{
    totalD+=Number(i.valor||0);
    listDespesas.appendChild(buildLancItem(i,"despesa",false));
  });

  totalReceitasEl.textContent=formatReal(totalR);
  totalDespesasEl.textContent=formatReal(totalD);

  const {data:conta}=await supabase.from("contas_bancarias")
        .select("saldo_atual").eq("id",conta_id).maybeSingle();
  saldoAtualEl.textContent=formatReal(conta?.saldo_atual||0);

  await recalcularSaldo(conta_id);
}

// --- ITEM LISTA ---
function buildLancItem(item,type){
  const li=document.createElement("li");
  li.style.display="flex"; li.style.justifyContent="space-between";
  li.style.marginBottom="8px";

  const left=document.createElement("div");
  const right=document.createElement("div");

  left.textContent=`${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  if(item.baixado) left.textContent+=" — (BAIXADO)";

  const b1=document.createElement("button");
  b1.textContent="Editar"; b1.onclick=()=>startEdit(type,item);

  const b2=document.createElement("button");
  b2.textContent="Excluir"; b2.onclick=()=>deleteItem(type,item.id);

  right.appendChild(b1); right.appendChild(b2);

  if(!item.baixado){
    const b3=document.createElement("button");
    b3.textContent="Baixar";
    b3.onclick=()=>baixarLancamento(type,item);
    right.appendChild(b3);
  }

  li.appendChild(left); li.appendChild(right);
  return li;
}

// --- BAIXAR ---
async function baixarLancamento(type,item){
  const {data:contas}=await supabase.from("contas_bancarias")
        .select("*").eq("user_id",currentUser.id);

  let contaDest=item.conta_id;
  let msg="Escolha conta (número) ou deixe vazio para original:\n";
  contas.forEach((c,i)=>msg+=`${i+1}) ${c.nome} — ${formatReal(c.saldo_atual)}\n`);

  const r=prompt(msg,"");
  if(r){
    const n=parseInt(r);
    if(!isNaN(n)&&n>=1&&n<=contas.length) contaDest=contas[n-1].id;
  }

  const {data:conta}=await supabase.from("contas_bancarias")
        .select("*").eq("id",contaDest).single();

  let novoSaldo=Number(conta.saldo_atual||0);
  if(type==="receita") novoSaldo+=Number(item.valor);
  else novoSaldo-=Number(item.valor);

  await supabase.from("contas_bancarias")
        .update({saldo_atual:novoSaldo}).eq("id",contaDest);

  const tabela=type==="receita"?"receitas":"despesas";
  const hoje=new Date().toISOString().slice(0,10);

  await supabase.from(tabela)
        .update({baixado:true,data_baixa:hoje}).eq("id",item.id);

  const {data:exists}=await supabase.from("movimentacoes")
        .select("id").eq("lancamento_id",item.id).maybeSingle();

  if(!exists){
    await supabase.from("movimentacoes").insert([{
      user_id:currentUser.id,
      conta_id:contaDest,
      tipo:type==="receita"?"credito":"debito",
      valor:item.valor,
      descricao:item.descricao,
      data:hoje,
      lancamento_id:item.id
    }]);
  }

  await recalcularSaldo(contaDest);
  await refreshLancamentos();
  await renderExtrato();
}

// --- CANCELAR BAIXA ---
async function cancelarBaixaMovimentacao(mov){
  if(!confirm("Cancelar baixa?"))return;

  const {data:conta}=await supabase.from("contas_bancarias")
        .select("*").eq("id",mov.conta_id).single();

  let novoSaldo=Number(conta.saldo_atual||0);
  if(mov.tipo==="credito") novoSaldo-=Number(mov.valor);
  else novoSaldo+=Number(mov.valor);

  await supabase.from("contas_bancarias")
        .update({saldo_atual:novoSaldo}).eq("id",mov.conta_id);

  await supabase.from("movimentacoes").delete().eq("id",mov.id);

  await supabase.from("receitas").update({baixado:false,data_baixa:null})
        .eq("id",mov.lancamento_id);
  await supabase.from("despesas").update({baixado:false,data_baixa:null})
        .eq("id",mov.lancamento_id);

  await recalcularSaldo(mov.conta_id);
  await refreshLancamentos();
  await renderExtrato();
}

// --- EXTRATO ---
btnFiltrarExtrato.onclick=()=>renderExtrato();

async function renderExtrato(){
  if(!tableExtrato||!selectExtrato.value)return;

  const conta_id=selectExtrato.value;
  await recalcularSaldo(conta_id);

  const now=new Date();
  let inicio,fim;
  const p=periodoExtrato.value;

  if(p==="mes_atual"){
    inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${last}`;
  }else if(p==="mes_anterior"){
    const ano=now.getFullYear(),mes=now.getMonth();
    inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
    const last=new Date(ano,mes,0).getDate();
    fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;
  }else if(p==="ultimos_30"){
    const past=new Date(now.getTime()-30*86400000);
    inicio=past.toISOString().slice(0,10);
    fim=now.toISOString().slice(0,10);
  }else{
    inicio=dataInicio.value;
    fim=dataFim.value;
  }

  const {data:conta}=await supabase.from("contas_bancarias")
        .select("saldo_inicial,created_at,saldo_atual")
        .eq("id",conta_id).single();

  const saldoInicial=Number(conta.saldo_inicial||0);
  const dataCriacao=conta.created_at.slice(0,10);

  const {data:movs}=await supabase.from("movimentacoes")
        .select("*").eq("conta_id",conta_id)
        .gte("data",inicio).lte("data",fim).order("data");

  const linhas=[];
  if(saldoInicial!==0) linhas.push({tipo:"inicial",data:dataCriacao,descricao:"SALDO INICIAL",valor:saldoInicial});
  (movs||[]).forEach(m=>linhas.push({tipo:"mov",data:m.data,descricao:m.descricao,valor:m.valor,mov:m}));

  linhas.sort((a,b)=>new Date(a.data)-new Date(b.data));

  tableExtrato.innerHTML="";
  let cred=0,deb=0;

  linhas.forEach(l=>{
    const tr=document.createElement("tr");
    const tdA=document.createElement("td");
    if(l.tipo==="inicial"){
      tr.innerHTML=`<td>${formatDate(l.data)}</td><td>${l.descricao}</td><td>Crédito</td><td>${formatReal(l.valor)}</td>`;
      cred+=l.valor;
    }else{
      tr.innerHTML=`<td>${formatDate(l.data)}</td><td>${l.descricao}</td><td>${l.mov.tipo==="credito"?"Crédito":"Débito"}</td><td>${formatReal(l.valor)}</td>`;
      if(l.mov.tipo==="credito") cred+=l.valor; else deb+=l.valor;
      const btn=document.createElement("button");
      btn.textContent="Cancelar Baixa";
      btn.onclick=()=>cancelarBaixaMovimentacao(l.mov);
      tdA.appendChild(btn);
    }
    tr.appendChild(tdA);
    tableExtrato.appendChild(tr);
  });

  document.getElementById("total-receitas-extrato").textContent=formatReal(cred);
  document.getElementById("total-despesas-extrato").textContent=formatReal(deb);
  document.getElementById("saldo-periodo-extrato").textContent=formatReal(cred-deb);
  document.getElementById("saldo-atual-conta-extrato").textContent=formatReal(conta.saldo_atual);
  document.getElementById("total-valor").textContent=formatReal(cred-deb);
}

// --- DASHBOARD ---
async function loadDashboard(){
  const now=new Date();
  const ano=now.getFullYear();
  const mes=now.getMonth()+1;
  const inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
  const last=new Date(ano,mes,0).getDate();
  const fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;

  const rec=await supabase.from("receitas")
        .select("*").eq("user_id",currentUser.id)
        .gte("data",inicio).lte("data",fim);

  const desp=await supabase.from("despesas")
        .select("*").eq("user_id",currentUser.id)
        .gte("data",inicio).lte("data",fim);

  const totalR=(rec.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);
  const totalD=(desp.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);

  document.getElementById("dash-period").textContent=`${mes}/${ano}`;
  document.getElementById("dash-receber").textContent=formatReal(totalR);
  document.getElementById("dash-pagar").textContent=formatReal(totalD);
  document.getElementById("dash-saldo-atual").textContent=formatReal(totalR-totalD);
  document.getElementById("dash-saldo-previsto").textContent=formatReal(totalR-totalD);

  const ctx=document.getElementById("chart-dashboard");
  if(!ctx) return;

  if(chartDashboard) chartDashboard.destroy();
  chartDashboard=new Chart(ctx,{
    type:"bar",
    data:{
      labels:["Receitas","Despesas"],
      datasets:[{label:"Resumo do mês",data:[totalR,totalD],backgroundColor:["green","red"]}]
    },
    options:{responsive:true,scales:{y:{beginAtZero:true}}}
  });
}

// --- SUBSCRIBE ---
function subscribeToChanges(){
  supabase.channel("listen_rec")
    .on("postgres_changes",{event:"*",schema:"public",table:"receitas"},()=>refreshLancamentos())
    .subscribe();

  supabase.channel("listen_des")
    .on("postgres_changes",{event:"*",schema:"public",table:"despesas"},()=>refreshLancamentos())
    .subscribe();

  supabase.channel("listen_mov")
    .on("postgres_changes",{event:"*",schema:"public",table:"movimentacoes"},()=>renderExtrato())
    .subscribe();
}

// --- TROCA DE TELAS ---
function showScreen(s){
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  if(s==="dashboard"){
    telaDashboard.classList.remove("hidden");
    btnDash.classList.add("active");
    loadDashboard();
  }else if(s==="contas"){
    telaContas.classList.remove("hidden");
    btnContas.classList.add("active");
  }else{
    telaLanc.classList.remove("hidden");
    btnLanc.classList.add("active");
  }
}

// eventos botoes
btnDash.onclick=()=>showScreen("dashboard");
btnContas.onclick=()=>showScreen("contas");
btnLanc.onclick=()=>showScreen("lanc");

// mostrar campos personalizados
periodoLanc.onchange=()=>{
  if(periodoLanc.value==="personalizado"){
    dataInicioLanc.classList.remove("hidden");
    dataFimLanc.classList.remove("hidden");
  }else{
    dataInicioLanc.classList.add("hidden");
    dataFimLanc.classList.add("hidden");
  }
};

periodoExtrato.onchange=()=>{
  if(periodoExtrato.value==="personalizado"){
    dataInicio.classList.remove("hidden");
    dataFim.classList.remove("hidden");
  }else{
    dataInicio.classList.add("hidden");
    dataFim.classList.add("hidden");
  }
};
