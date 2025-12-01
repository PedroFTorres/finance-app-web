function formatDate(d){if(!d)return"";const D=new Date(d+"T00:00:00");return String(D.getDate()).padStart(2,"0")+"/"+String(D.getMonth()+1).padStart(2,"0")+"/"+D.getFullYear();}
function formatReal(v){if(typeof v!=="number")v=Number(v||0);return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

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

const periodoLanc=document.getElementById("periodo-lanc");
const dataInicioLanc=document.getElementById("data-inicio-lanc");
const dataFimLanc=document.getElementById("data-fim-lanc");
const btnFiltrarLanc=document.getElementById("btn-filtrar-lanc");

let tableExtrato=null;
document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("table-extrato");if(t)tableExtrato=t.querySelector("tbody");});
let chartDashboard=null;

supabase.auth.getSession().then(({data})=>{
  if(!data.session) return window.location.href="login.html";
  currentUser=data.session.user;
  document.getElementById("user-email").textContent=currentUser.email;
  initApp();
});
document.getElementById("btn-logout").onclick=async()=>{await supabase.auth.signOut();window.location.href="login.html";};

async function initApp(){await loadContas();subscribeToChanges();showScreen("contas");}

async function recalcularSaldo(conta_id){
  const {data:s} = await supabase.from("contas_bancarias").select("saldo_inicial").eq("id",conta_id).single();
  const saldoInicial = Number(s?.saldo_inicial||0);

  const {data:movs} = await supabase.from("movimentacoes").select("tipo,valor").eq("conta_id",conta_id);

  let cred=0,deb=0;
  (movs||[]).forEach(m=>{
    const v=Number(m.valor||0);
    if(m.tipo==="credito") cred+=v;
    else deb+=v;
  });

  const saldoFinal = saldoInicial + cred - deb;

  await supabase.from("contas_bancarias").update({saldo_atual:saldoFinal}).eq("id",conta_id);

  return saldoFinal;
}

async function loadContas(){
  const {data} = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
  selectContas.innerHTML="";
  (data||[]).forEach(c=>{
    const o=document.createElement("option");
    o.value=c.id;
    o.textContent=`${c.nome} (${formatReal(Number(c.saldo_inicial||0))})`;
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
  const {data} = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
  
  selectExtrato.innerHTML="";
  selectContaLanc.innerHTML="";

  (data||[]).forEach(c=>{
    const o1=document.createElement("option");
    o1.value=c.id;o1.textContent=c.nome;
    selectExtrato.appendChild(o1);

    const o2=document.createElement("option");
    o2.value=c.id;o2.textContent=c.nome;
    selectContaLanc.appendChild(o2);
  });

  if(data?.length){
    selectExtrato.value=data[0].id;
    selectContaLanc.value=data[0].id;
  }
}

btnAddConta.onclick=async()=>{
  const nome=(contaNome.value||"").trim();
  if(!nome) return alert("Informe o nome da conta!");
  const saldo=parseFloat(contaSaldo.value||0);
  await supabase.from("contas_bancarias").insert([{nome,saldo_inicial:saldo,saldo_atual:saldo,user_id:currentUser.id}]);
  contaNome.value="";contaSaldo.value="";
  await loadContas();
};

btnAddLanc.onclick=async()=>{
  const desc=(descLanc.value||"").trim();
  const valor=parseFloat(valorLanc.value||0);
  const data=dataLanc.value;
  const tipo=tipoLanc.value;
  const conta_id=selectContaLanc.value;

  if(!desc||!valor||!data) return alert("Preencha todos os campos!");

  if(editing.type){
    const table=editing.type==="receita"?"receitas":"despesas";
    await supabase.from(table).update({descricao:desc,valor,data,conta_id}).eq("id",editing.id);
    stopEdit();
    await refreshLancamentos();
    await renderExtrato();
    return;
  }

  const tipoTabela = tipo==="receita"?"receitas":"despesas";
  await supabase.from(tipoTabela).insert([{descricao:desc,valor,data,conta_id,user_id:currentUser.id,baixado:false}]);

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
  editing.type=type;
  editing.id=item.id;
  tipoLanc.value=type;
  valorLanc.value=item.valor;
  descLanc.value=item.descricao;
  dataLanc.value=item.data;
  selectContaLanc.value=item.conta_id;
  btnCancelEdit.classList.remove("hidden");
  btnAddLanc.textContent="Salvar";
}

async function deleteItem(type,id){
  if(!confirm("Excluir?")) return;
  const table=type==="receita"?"receitas":"despesas";
  await supabase.from(table).delete().eq("id",id);
  await refreshLancamentos();
  await renderExtrato();
}

btnFiltrarLanc.onclick=()=>refreshLancamentos();

async function refreshLancamentos(){
  const conta_id = selectContas.value;
  const now=new Date();
  let inicio,fim;
  const p=periodoLanc.value;

  if(p==="mes_atual"){
    inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${last}`;
  }else if(p==="mes_anterior"){
    const ano=now.getFullYear(), mes=now.getMonth();
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

  const [r1,r2] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim).order("data"),
    supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim).order("data")
  ]);

  const [rLate,dLate] = await Promise.all([
    supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).lt("data",inicio).eq("baixado",false),
    supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).lt("data",inicio).eq("baixado",false)
  ]);

  listReceitas.innerHTML="";
  listDespesas.innerHTML="";

  if(rLate.data.length || dLate.data.length){
    const tag=document.createElement("li");
    tag.textContent="Lançamentos Atrasados:";
    tag.style.fontWeight="bold";
    listReceitas.appendChild(tag.cloneNode(true));
    listDespesas.appendChild(tag.cloneNode(true));
  }

  rLate.data.forEach(i=>listReceitas.appendChild(buildLancItem(i,"receita",true)));
  dLate.data.forEach(i=>listDespesas.appendChild(buildLancItem(i,"despesa",true)));

  let tR=0,tD=0;
  r1.data.forEach(i=>{tR+=Number(i.valor||0);listReceitas.appendChild(buildLancItem(i,"receita",false));});
  d2=r2.data;
  d2.forEach(i=>{tD+=Number(i.valor||0);listDespesas.appendChild(buildLancItem(i,"despesa",false));});

  totalReceitasEl.textContent=formatReal(tR);
  totalDespesasEl.textContent=formatReal(tD);

  const {data:conta} = await supabase.from("contas_bancarias").select("saldo_atual").eq("id",conta_id).single();
  saldoAtualEl.textContent=formatReal(Number(conta?.saldo_atual||0));

  await recalcularSaldo(conta_id);
}

function buildLancItem(item,type,late){
  const li=document.createElement("li");
  li.style.display="flex";
  li.style.justifyContent="space-between";

  const left=document.createElement("div");
  const right=document.createElement("div");

  left.textContent=`${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

  if(item.baixado) left.textContent+=" — (BAIXADO)";
  if(late && !item.baixado){
    left.textContent+=" — (ATRASADO)";
    left.style.borderLeft="4px solid orange";
    left.style.paddingLeft="4px";
  }

  const btnEdit=document.createElement("button");
  btnEdit.textContent="Editar";
  btnEdit.onclick=()=>startEdit(type,item);

  const btnDel=document.createElement("button");
  btnDel.textContent="Excluir";
  btnDel.onclick=()=>deleteItem(type,item.id);

  right.appendChild(btnEdit);
  right.appendChild(btnDel);

  if(!item.baixado){
    const btnBaixa=document.createElement("button");
    btnBaixa.textContent="Baixar";
    btnBaixa.onclick=()=>baixarLancamento(type,item);
    right.appendChild(btnBaixa);
  }

  li.appendChild(left);
  li.appendChild(right);
  return li;
}

async function baixarLancamento(type,item){
  const {data:contas} = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id);
  let contaEscolhida=item.conta_id;

  let msg="Escolha a conta:\n";
  contas.forEach((c,i)=>msg+=`${i+1}) ${c.nome}\n`);
  msg+="\nOu deixe vazio para usar a original.";

  const r=prompt(msg,"");
  if(r){
    const n=parseInt(r);
    if(!isNaN(n)&&n>=1&&n<=contas.length) contaEscolhida=contas[n-1].id;
  }

  const {data:conta} = await supabase.from("contas_bancarias").select("*").eq("id",contaEscolhida).single();
  let novoSaldo=Number(conta.saldo_atual||0);
  if(type==="receita") novoSaldo+=Number(item.valor);
  else novoSaldo-=Number(item.valor);

  await supabase.from("contas_bancarias").update({saldo_atual:novoSaldo}).eq("id",contaEscolhida);

  const table=type==="receita"?"receitas":"despesas";
  const hoje=new Date().toISOString().slice(0,10);
  await supabase.from(table).update({baixado:true,data_baixa:hoje}).eq("id",item.id);

  const {data:existe} = await supabase.from("movimentacoes").select("id").eq("lancamento_id",item.id).maybeSingle();
  if(!existe){
    await supabase.from("movimentacoes").insert([{
      user_id:currentUser.id,
      conta_id:contaEscolhida,
      tipo:type==="receita"?"credito":"debito",
      valor:item.valor,
      descricao:item.descricao,
      data:hoje,
      lancamento_id:item.id
    }]);
  }

  await recalcularSaldo(contaEscolhida);
  await refreshLancamentos();
  await renderExtrato();
}

async function cancelarBaixaMovimentacao(mov){
  if(!confirm("Cancelar baixa?"))return;

  const {data:conta} = await supabase.from("contas_bancarias").select("*").eq("id",mov.conta_id).single();
  let novoSaldo=Number(conta.saldo_atual||0);
  if(mov.tipo==="credito") novoSaldo-=Number(mov.valor);
  else novoSaldo+=Number(mov.valor);

  await supabase.from("contas_bancarias").update({saldo_atual:novoSaldo}).eq("id",mov.conta_id);

  await supabase.from("movimentacoes").delete().eq("id",mov.id);

  await supabase.from("receitas").update({baixado:false,data_baixa:null}).eq("id",mov.lancamento_id);
  await supabase.from("despesas").update({baixado:false,data_baixa:null}).eq("id",mov.lancamento_id);

  await recalcularSaldo(mov.conta_id);
  await refreshLancamentos();
  await renderExtrato();
}

btnFiltrarExtrato.onclick=()=>renderExtrato();

async function renderExtrato(){
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
    const ano=now.getFullYear(), mes=now.getMonth();
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

  const {data:conta} = await supabase.from("contas_bancarias")
    .select("saldo_inicial,created_at,saldo_atual")
    .eq("id",conta_id)
    .single();

  const saldoInicial=Number(conta.saldo_inicial||0);
  const dataCriacao=conta.created_at.slice(0,10);

  const {data:movs} = await supabase.from("movimentacoes")
    .select("*")
    .eq("conta_id",conta_id)
    .gte("data",inicio)
    .lte("data",fim)
    .order("data");

  const linhas=[];
  if(saldoInicial!==0){
    linhas.push({tipo:"inicial",data:dataCriacao,descricao:"SALDO INICIAL",valor:saldoInicial});
  }

  (movs||[]).forEach(m=>{
    linhas.push({
      tipo:"mov",
      data:m.data,
      descricao:m.descricao,
      valor:Number(m.valor||0),
      mov:m
    });
  });

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
      tr.innerHTML+=`<td>${formatDate(l.data)}</td><td>${l.descricao}</td><td>${l.mov.tipo==="credito"?"Crédito":"Débito"}</td><td>${formatReal(l.valor)}</td>`;
      if(l.mov.tipo==="credito") cred+=l.valor; else deb+=l.valor;

      if(l.mov.lancamento_id){
        const btn=document.createElement("button");
        btn.textContent="Cancelar Baixa";
        btn.onclick=()=>cancelarBaixaMovimentacao(l.mov);
        tdA.appendChild(btn);
      }
    }

    tr.appendChild(tdA);
    tableExtrato.appendChild(tr);
  });

  document.getElementById("total-receitas-extrato").textContent=formatReal(cred);
  document.getElementById("total-despesas-extrato").textContent=formatReal(deb);
  document.getElementById("saldo-periodo-extrato").textContent=formatReal(cred-deb);
  document.getElementById("saldo-atual-conta-extrato").textContent=formatReal(Number(conta.saldo_atual||0));
  document.getElementById("total-valor").textContent=formatReal(cred-deb);
}

function subscribeToChanges(){
  supabase.channel("listen_rec").on("postgres_changes",{event:"*",schema:"public",table:"receitas"},()=>refreshLancamentos()).subscribe();
  supabase.channel("listen_des").on("postgres_changes",{event:"*",schema:"public",table:"despesas"},()=>refreshLancamentos()).subscribe();
  supabase.channel("listen_mov").on("postgres_changes",{event:"*",schema:"public",table:"movimentacoes"},()=>renderExtrato()).subscribe();
}

function showScreen(s){
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");

  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  if(s==="dashboard"){telaDashboard.classList.remove("hidden");btnDash.classList.add("active");loadDashboard();}
  else if(s==="contas"){telaContas.classList.remove("hidden");btnContas.classList.add("active");}
  else{telaLanc.classList.remove("hidden");btnLanc.classList.add("active");}
}

btnDash.onclick=()=>showScreen("dashboard");
btnContas.onclick=()=>showScreen("contas");
btnLanc.onclick=()=>showScreen("lanc");

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
