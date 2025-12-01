function formatDate(d){if(!d)return"";const x=new Date(d+"T00:00:00");return String(x.getDate()).padStart(2,"0")+"/"+String(x.getMonth()+1).padStart(2,"0")+"/"+x.getFullYear();}
function formatReal(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

let currentUser=null;
let editing={type:null,id:null};
let chartDashboard=null;
let chartRecCat=null;
let chartDesCat=null;

const telaDashboard=document.getElementById("tela-dashboard");
const telaContas=document.getElementById("tela-contas");
const telaLanc=document.getElementById("tela-lancamentos");

const btnDash=document.getElementById("menu-dashboard");
const btnContas=document.getElementById("menu-contas");
const btnLanc=document.getElementById("menu-lancamentos");

const selectContas=document.getElementById("select-contas");
const contaNome=document.getElementById("conta-nome");
const contaSaldo=document.getElementById("conta-saldo");
const contaDataSaldo=document.getElementById("conta-data-saldo");
const btnAddConta=document.getElementById("btn-add-conta");

const tipoLanc=document.getElementById("tipo-lancamento");
const valorLanc=document.getElementById("valor-lanc");
const descLanc=document.getElementById("desc-lanc");
const dataLanc=document.getElementById("data-lanc");
const categoriaLanc=document.getElementById("categoria-lanc");
const btnAddLanc=document.getElementById("btn-add-lanc");
const btnCancelEdit=document.getElementById("btn-cancel-edit");
const selectContaLanc=document.getElementById("select-conta-lanc");

const saldoAtualEl=document.getElementById("saldo-atual");
const totalReceitasEl=document.getElementById("total-receitas");
const totalDespesasEl=document.getElementById("total-despesas");

const listReceitas=document.getElementById("list-receitas");
const listDespesas=document.getElementById("list-despesas");

const periodoLanc=document.getElementById("periodo-lanc");
const dataInicioLanc=document.getElementById("data-inicio-lanc");
const dataFimLanc=document.getElementById("data-fim-lanc");
const btnFiltrarLanc=document.getElementById("btn-filtrar-lanc");

const tabCadastro=document.getElementById("tab-cadastro");
const tabExtrato=document.getElementById("tab-extrato");
const selectExtrato=document.getElementById("select-contas-extrato");
const periodoExtrato=document.getElementById("periodo-extrato");
const dataInicio=document.getElementById("data-inicio");
const dataFim=document.getElementById("data-fim");
const btnFiltrarExtrato=document.getElementById("btn-filtrar-extrato");

let tableExtrato=null;
document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("table-extrato");if(t)tableExtrato=t.querySelector("tbody");});

supabase.auth.getSession().then(({data})=>{
 if(!data.session)return window.location.href="login.html";
 currentUser=data.session.user;
 document.getElementById("user-email").textContent=currentUser.email;
 initApp();
});

document.getElementById("btn-logout").onclick=async()=>{
 await supabase.auth.signOut();
 window.location.href="login.html";
};

async function initApp(){
 await loadCategorias();
 await loadContas();
 subscribeToChanges();
 showScreen("contas");
}

/* ------------------------------------------
   CARREGAR CATEGORIAS
------------------------------------------- */

async function loadCategorias(){
 const {data}=await supabase.from("categorias").select("*").order("nome");
 categoriaLanc.innerHTML="";

 (data||[]).forEach(cat=>{
  const opt=document.createElement("option");
  opt.value=cat.id;
  opt.textContent=cat.nome;
  categoriaLanc.appendChild(opt);
 });
}

/* ------------------------------------------
   RECALCULAR SALDO
------------------------------------------- */
async function recalcularSaldo(conta_id){
 const {data:conta}=await supabase.from("contas_bancarias")
   .select("saldo_inicial").eq("id",conta_id).maybeSingle();

 const si=Number(conta?.saldo_inicial||0);

 const {data:movs}=await supabase.from("movimentacoes")
   .select("tipo,valor").eq("conta_id",conta_id);

 let c=0,d=0;
 (movs||[]).forEach(m=>{
  const v=Number(m.valor||0);
  if(m.tipo==="credito")c+=v; else d+=v;
 });

 const sf=si+c-d;

 await supabase.from("contas_bancarias")
   .update({saldo_atual:sf}).eq("id",conta_id);

 return sf;
}

/* ------------------------------------------
   CARREGAR CONTAS
------------------------------------------- */

async function loadContas(){
 const {data}=await supabase.from("contas_bancarias")
   .select("*").eq("user_id",currentUser.id);

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
   .select("*").eq("user_id",currentUser.id);

 selectContaLanc.innerHTML="";
 selectExtrato.innerHTML="";

 (data||[]).forEach(c=>{
  const a=document.createElement("option");
  a.value=c.id; a.textContent=c.nome;
  selectContaLanc.appendChild(a);

  const b=document.createElement("option");
  b.value=c.id; b.textContent=c.nome;
  selectExtrato.appendChild(b);
 });

 if(data?.length){
  selectContaLanc.value=data[0].id;
  selectExtrato.value=data[0].id;
 }
}

/* ------------------------------------------
   ADICIONAR CONTA
------------------------------------------- */

btnAddConta.onclick=async()=>{
 const nome=contaNome.value.trim();
 const saldo=Number(contaSaldo.value||0);
 const data_saldo=contaDataSaldo.value;

 if(!nome)return alert("Informe o nome.");
 if(!data_saldo)return alert("Informe a data do saldo.");

 await supabase.from("contas_bancarias").insert([{
  nome,
  saldo_inicial:saldo,
  saldo_atual:saldo,
  data_saldo,
  user_id:currentUser.id
 }]);

 contaNome.value="";
 contaSaldo.value="";
 contaDataSaldo.value="";

 await loadContas();
};

/* ------------------------------------------
   ADICIONAR / EDITAR LANÇAMENTO
------------------------------------------- */

btnAddLanc.onclick=async()=>{
 const desc=descLanc.value.trim();
 const valor=Number(valorLanc.value||0);
 const data=dataLanc.value;
 const tipo=tipoLanc.value;
 const conta_id=selectContaLanc.value;
 const categoria_id=categoriaLanc.value;

 if(!desc||!valor||!data)return alert("Preencha tudo.");

 if(editing.type){
  const tabela=editing.type==="receita"?"receitas":"despesas";
  await supabase.from(tabela).update({
   descricao:desc,
   valor,
   data,
   conta_id,
   categoria_id
  }).eq("id",editing.id);

  stopEdit();
  await refreshLancamentos();
  await renderExtrato();
  return;
 }

 const tabela=tipo==="receita"?"receitas":"despesas";

 await supabase.from(tabela).insert([{
  descricao:desc,
  valor,
  data,
  conta_id,
  categoria_id,
  user_id:currentUser.id,
  baixado:false
 }]);

 descLanc.value="";
 valorLanc.value="";
 dataLanc.value="";

 await refreshLancamentos();
 await renderExtrato();
};

function stopEdit(){
 editing={type:null,id:null};
 descLanc.value="";
 valorLanc.value="";
 dataLanc.value="";
 btnAddLanc.textContent="Adicionar";
 btnCancelEdit.classList.add("hidden");
}
btnCancelEdit.onclick=()=>stopEdit();

function startEdit(type,item){
 editing={type,id:item.id};
 tipoLanc.value=type;
 valorLanc.value=item.valor;
 descLanc.value=item.descricao;
 dataLanc.value=item.data;
 selectContaLanc.value=item.conta_id;
 categoriaLanc.value=item.categoria_id||"";
 btnAddLanc.textContent="Salvar";
 btnCancelEdit.classList.remove("hidden");
}

/* ------------------------------------------
   EXCLUIR LANÇAMENTO
------------------------------------------- */

async function deleteItem(type,id){
 if(!confirm("Excluir?"))return;

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

/* ------------------------------------------
   FILTRO DE LANÇAMENTOS
------------------------------------------- */

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
 }
 else if(p==="mes_anterior"){
  const ano=now.getFullYear(),mes=now.getMonth();
  inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
  const last=new Date(ano,mes,0).getDate();
  fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;
 }
 else if(p==="ultimos_30"){
  const past=new Date(now.getTime()-30*86400000);
  inicio=past.toISOString().slice(0,10);
  fim=now.toISOString().slice(0,10);
 }
 else{
  inicio=dataInicioLanc.value;
  fim=dataFimLanc.value;
 }

 const [R,D]=await Promise.all([
  supabase.from("receitas").select("*").eq("user_id",currentUser.id)
    .eq("conta_id",conta_id).gte("data",inicio).lte("data",fim).order("data"),

  supabase.from("despesas").select("*").eq("user_id",currentUser.id)
    .eq("conta_id",conta_id).gte("data",inicio).lte("data",fim).order("data")
 ]);

 listReceitas.innerHTML="";
 listDespesas.innerHTML="";

 let tr=0,td=0;

 (R.data||[]).forEach(i=>{
  tr+=Number(i.valor||0);
  listReceitas.appendChild(buildLancItem(i,"receita"));
 });

 (D.data||[]).forEach(i=>{
  td+=Number(i.valor||0);
  listDespesas.appendChild(buildLancItem(i,"despesa"));
 });

 totalReceitasEl.textContent=formatReal(tr);
 totalDespesasEl.textContent=formatReal(td);

 const {data:conta}=await supabase.from("contas_bancarias")
   .select("saldo_atual").eq("id",conta_id).maybeSingle();

 saldoAtualEl.textContent=formatReal(conta?.saldo_atual||0);

 await recalcularSaldo(conta_id);
}

/* ------------------------------------------
   ITEM DA LISTA
------------------------------------------- */

function buildLancItem(item,type){
 const li=document.createElement("li");
 li.style.display="flex";
 li.style.justifyContent="space-between";

 const left=document.createElement("div");
 const right=document.createElement("div");

 left.textContent=
  `${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;

 if(item.baixado){
  left.textContent+=" — (BAIXADO)";
 }

 const b1=document.createElement("button");
 b1.textContent="Editar";
 b1.onclick=()=>startEdit(type,item);

 const b2=document.createElement("button");
 b2.textContent="Excluir";
 b2.onclick=()=>deleteItem(type,item.id);

 right.appendChild(b1);
 right.appendChild(b2);

 if(!item.baixado){
  const b3=document.createElement("button");
  b3.textContent="Baixar";
  b3.onclick=()=>baixarLancamento(type,item);
  right.appendChild(b3);
 }

 li.appendChild(left);
 li.appendChild(right);

 return li;
}

/* ------------------------------------------
   BAIXAR LANÇAMENTO
------------------------------------------- */

async function baixarLancamento(type,item){
 const {data:contas}=await supabase.from("contas_bancarias")
   .select("*").eq("user_id",currentUser.id);

 let contaDest=item.conta_id;

 let msg="Escolha conta:\n";
 contas.forEach((c,i)=>{
  msg+=`${i+1}) ${c.nome}\n`;
 });

 const r=prompt(msg,"");
 if(r){
  const n=parseInt(r);
  if(!isNaN(n)&&n>=1&&n<=contas.length){
   contaDest=contas[n-1].id;
  }
 }

 const {data:conta}=await supabase.from("contas_bancarias")
   .select("*").eq("id",contaDest).single();

 let ns=Number(conta.saldo_atual||0);
 if(type==="receita")ns+=Number(item.valor);
 else ns-=Number(item.valor);

 await supabase.from("contas_bancarias")
   .update({saldo_atual:ns}).eq("id",contaDest);

 const tabela=type==="receita"?"receitas":"despesas";
 const hoje=new Date().toISOString().slice(0,10);

 await supabase.from(tabela)
   .update({baixado:true,data_baixa:hoje})
   .eq("id",item.id);

 const {data:ex}=await supabase.from("movimentacoes")
   .select("id")
   .eq("lancamento_id",item.id)
   .maybeSingle();

 if(!ex){
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

/* ------------------------------------------
   CANCELAR BAIXA
------------------------------------------- */

async function cancelarBaixaMovimentacao(mov){
 if(!confirm("Cancelar baixa?"))return;

 const {data:conta}=await supabase.from("contas_bancarias")
   .select("*").eq("id",mov.conta_id).single();

 let ns=Number(conta.saldo_atual||0);

 if(mov.tipo==="credito")ns-=Number(mov.valor);
 else ns+=Number(mov.valor);

 await supabase.from("contas_bancarias")
   .update({saldo_atual:ns}).eq("id",mov.conta_id);

 await supabase.from("movimentacoes")
   .delete().eq("id",mov.id);

 await supabase.from("receitas")
   .update({baixado:false,data_baixa:null})
   .eq("id",mov.lancamento_id);

 await supabase.from("despesas")
   .update({baixado:false,data_baixa:null})
   .eq("id",mov.lancamento_id);

 await recalcularSaldo(mov.conta_id);
 await refreshLancamentos();
 await renderExtrato();
}

/* ------------------------------------------
   EXTRATO
------------------------------------------- */

btnFiltrarExtrato.onclick=()=>renderExtrato();

async function renderExtrato(){
 const conta_id=selectExtrato.value;
 if(!conta_id||!tableExtrato)return;

 await recalcularSaldo(conta_id);

 const now=new Date();
 let inicio,fim;
 const p=periodoExtrato.value;

 if(p==="mes_atual"){
  inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${last}`;
 }
 else if(p==="mes_anterior"){
  const ano=now.getFullYear(),mes=now.getMonth();
  inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
  const last=new Date(ano,mes,0).getDate();
  fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;
 }
 else if(p==="ultimos_30"){
  const past=new Date(now.getTime()-30*86400000);
  inicio=past.toISOString().slice(0,10);
  fim=now.toISOString().slice(0,10);
 }
 else{
  inicio=dataInicio.value;
  fim=dataFim.value;
 }

 const {data:conta}=await supabase.from("contas_bancarias")
   .select("saldo_inicial,data_saldo,saldo_atual")
   .eq("id",conta_id)
   .single();

 const si=Number(conta.saldo_inicial||0);
 const dataInicial=conta.data_saldo;

 const {data:movs}=await supabase.from("movimentacoes")
   .select("*")
   .eq("conta_id",conta_id)
   .gte("data",inicio)
   .lte("data",fim)
   .order("data");

 const linhas=[];

 if(si!==0 && dataInicial)
  linhas.push({tipo:"inicial",data:dataInicial,descricao:"SALDO INICIAL",valor:si});

 (movs||[]).forEach(m=>{
  linhas.push({
   tipo:"mov",
   data:m.data,
   descricao:m.descricao,
   valor:m.valor,
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
   tr.innerHTML=
     `<td>${formatDate(l.data)}</td><td>${l.descricao}</td>
     <td>Crédito</td><td>${formatReal(l.valor)}</td>`;
   cred+=l.valor;
  } else {
   tr.innerHTML=
     `<td>${formatDate(l.data)}</td><td>${l.descricao}</td>
     <td>${l.mov.tipo==="credito"?"Crédito":"Débito"}</td>
     <td>${formatReal(l.valor)}</td>`;

   if(l.mov.tipo==="credito")cred+=l.valor;
   else deb+=l.valor;

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

/* ------------------------------------------
   DASHBOARD
------------------------------------------- */

async function loadDashboard(){
 const now=new Date();
 const ano=now.getFullYear();
 const mes=now.getMonth()+1;

 const inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
 const last=new Date(ano,mes,0).getDate();
 const fim=`${ano}-${String(mes).padStart(2,"0")}-${last}`;

 /* GRÁFICO PRINCIPAL */
 const rec=await supabase.from("receitas")
   .select("*").eq("user_id",currentUser.id)
   .gte("data",inicio).lte("data",fim);

 const des=await supabase.from("despesas")
   .select("*").eq("user_id",currentUser.id)
   .gte("data",inicio).lte("data",fim);

 const totalR=(rec.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);
 const totalD=(des.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);

 document.getElementById("dash-period").textContent=`${mes}/${ano}`;
 document.getElementById("dash-receber").textContent=formatReal(totalR);
 document.getElementById("dash-pagar").textContent=formatReal(totalD);
 document.getElementById("dash-saldo-atual").textContent=formatReal(totalR-totalD);
 document.getElementById("dash-saldo-previsto").textContent=formatReal(totalR-totalD);

 const ctx=document.getElementById("chart-dashboard");

 if(chartDashboard)chartDashboard.destroy();
 chartDashboard=new Chart(ctx,{
  type:"bar",
  data:{
   labels:["Receitas","Despesas"],
   datasets:[{
    label:"Resumo do mês",
    data:[totalR,totalD],
    backgroundColor:["green","red"]
   }]
  },
  options:{responsive:true,scales:{y:{beginAtZero:true}}}
 });

 /* GRÁFICO RECEITAS POR CATEGORIA */
 await renderGraficoReceitasPorCategoria(inicio,fim);

 /* GRÁFICO DESPESAS POR CATEGORIA */
 await renderGraficoDespesasPorCategoria(inicio,fim);
}

/* ------------------------------------------
   GRÁFICO DE RECEITAS POR CATEGORIA
------------------------------------------- */

async function renderGraficoReceitasPorCategoria(inicio,fim){
 const {data}=await supabase.from("receitas")
   .select("valor,categoria_id,categorias(nome)")
   .eq("user_id",currentUser.id)
   .gte("data",inicio)
   .lte("data",fim);

 const grupos={};

 (data||[]).forEach(r=>{
  const nome=r.categorias?.nome||"Sem categoria";
  grupos[nome]=(grupos[nome]||0)+Number(r.valor||0);
 });

 const labels=Object.keys(grupos);
 const valores=Object.values(grupos);

 const ctx=document.getElementById("chart-receitas-categorias");

 if(chartRecCat)chartRecCat.destroy();

 chartRecCat=new Chart(ctx,{
  type:"bar",
  data:{
   labels,
   datasets:[{
    label:"Receitas por Categoria",
    data:valores,
    backgroundColor:"green"
   }]
  },
  options:{responsive:true}
 });
}

/* ------------------------------------------
   GRÁFICO DE DESPESAS POR CATEGORIA
------------------------------------------- */

async function renderGraficoDespesasPorCategoria(inicio,fim){
 const {data}=await supabase.from("despesas")
   .select("valor,categoria_id,categorias(nome)")
   .eq("user_id",currentUser.id)
   .gte("data",inicio)
   .lte("data",fim);

 const grupos={};

 (data||[]).forEach(r=>{
  const nome=r.categorias?.nome||"Sem categoria";
  grupos[nome]=(grupos[nome]||0)+Number(r.valor||0);
 });

 const labels=Object.keys(grupos);
 const valores=Object.values(grupos);

 const ctx=document.getElementById("chart-despesas-categorias");

 if(chartDesCat)chartDesCat.destroy();

 chartDesCat=new Chart(ctx,{
  type:"bar",
  data:{
   labels,
   datasets:[{
    label:"Despesas por Categoria",
    data:valores,
    backgroundColor:"red"
   }]
  },
  options:{responsive:true}
 });
}

/* ------------------------------------------
   LISTENERS E TROCA DE TELA
------------------------------------------- */

function subscribeToChanges(){
 supabase.channel("rec")
   .on("postgres_changes",{event:"*",schema:"public",table:"receitas"},()=>refreshLancamentos())
   .subscribe();

 supabase.channel("des")
   .on("postgres_changes",{event:"*",schema:"public",table:"despesas"},()=>refreshLancamentos())
   .subscribe();

 supabase.channel("mov")
   .on("postgres_changes",{event:"*",schema:"public",table:"movimentacoes"},()=>renderExtrato())
   .subscribe();
}

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
 }
 else if(s==="contas"){
  telaContas.classList.remove("hidden");
  btnContas.classList.add("active");
 }
 else{
  telaLanc.classList.remove("hidden");
  btnLanc.classList.add("active");
 }
}

btnDash.onclick=()=>showScreen("dashboard");
btnContas.onclick=()=>showScreen("contas");
btnLanc.onclick=()=>showScreen("lanc");

document.querySelectorAll(".tab-btn").forEach(b=>{
 b.onclick=()=>{
  document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");

  if(b.dataset.tab==="cadastro"){
   tabCadastro.classList.remove("hidden");
   tabExtrato.classList.add("hidden");
  } else {
   tabCadastro.classList.add("hidden");
   tabExtrato.classList.remove("hidden");
   renderExtrato();
  }
 };
});

periodoLanc.onchange=()=>{
 if(periodoLanc.value==="personalizado"){
  dataInicioLanc.classList.remove("hidden");
  dataFimLanc.classList.remove("hidden");
 } else {
  dataInicioLanc.classList.add("hidden");
  dataFimLanc.classList.add("hidden");
 }
};

periodoExtrato.onchange=()=>{
 if(periodoExtrato.value==="personalizado"){
  dataInicio.classList.remove("hidden");
  dataFim.classList.remove("hidden");
 } else {
  dataInicio.classList.add("hidden");
  dataFim.classList.add("hidden");
 }
};
