function formatDate(d){if(!d)return"";const D=new Date(d+"T00:00:00");const dia=String(D.getDate()).padStart(2,"0");const mes=String(D.getMonth()+1).padStart(2,"0");const ano=D.getFullYear();return `${dia}/${mes}/${ano}`;}
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

const periodoLancControl=document.getElementById("periodo-lanc");
const dataInicioLanc=document.getElementById("data-inicio-lanc");
const dataFimLanc=document.getElementById("data-fim-lanc");
const btnFiltrarLanc=document.getElementById("btn-filtrar-lanc");

let tableExtrato=null;
document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("table-extrato"); if(t) tableExtrato=t.querySelector("tbody");});
let chartDashboard=null;

supabase.auth.getSession().then(({data})=>{ if(!data.session) window.location.href="login.html"; currentUser=data.session.user; const ue=document.getElementById("user-email"); if(ue) ue.textContent=currentUser.email; initApp(); });
document.getElementById("btn-logout")?.addEventListener("click",async()=>{ await supabase.auth.signOut(); window.location.href="login.html"; });

async function initApp(){ await loadContas(); subscribeToChanges(); showScreen("contas"); }

async function recalcularSaldo(conta_id){
  try{
    if(!conta_id) return 0;
    const { data: conta } = await supabase.from("contas_bancarias").select("saldo_inicial").eq("id",conta_id).maybeSingle();
    const saldoInicial = Number((conta && conta.saldo_inicial) || 0);
    const { data: movs } = await supabase.from("movimentacoes").select("id,lancamento_id,tipo,valor").eq("conta_id",conta_id);
    let seen=new Set(), totalCred=0, totalDeb=0;
    (movs||[]).forEach(m=>{
      const mid = String(m.id||m.lancamento_id||Math.random());
      if(seen.has(mid)) return;
      seen.add(mid);
      const v = Number(m.valor||0);
      if(!isFinite(v)) return;
      if(String(m.tipo)==="credito") totalCred+=v; else totalDeb+=v;
    });
    const saldoFinal = saldoInicial + totalCred - totalDeb;
    const { data: cur } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id",conta_id).maybeSingle();
    const atual = Number((cur && cur.saldo_atual) || 0);
    if(Number(saldoFinal.toFixed(2)) !== Number(atual.toFixed(2))){
      await supabase.from("contas_bancarias").update({ saldo_atual: saldoFinal }).eq("id",conta_id);
    }
    return saldoFinal;
  }catch(e){ console.error("recalcularSaldo",e); return 0; }
}

async function loadContas(){
  try{
    const { data, error } = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(error) throw error;
    if(selectContas) selectContas.innerHTML="";
    (data||[]).forEach(c=>{ if(selectContas){ const opt=document.createElement("option"); opt.value=c.id; opt.textContent=`${c.nome} (R$ ${Number(c.saldo_inicial||0).toFixed(2)})`; selectContas.appendChild(opt); } });
    if((data||[]).length>0){ if(selectContas && !selectContas.value) selectContas.value=data[0].id; await recalcularSaldo(selectContas.value); await refreshMovements(); }
  }catch(e){ console.error("loadContas",e); }
  await loadContasExtra();
}

if(btnAddConta) btnAddConta.addEventListener("click",async()=>{
  try{
    const nome=(contaNome.value||"").trim(); if(!nome) return alert("Informe o nome da conta!");
    const saldo=parseFloat(contaSaldo.value||0);
    const { error } = await supabase.from("contas_bancarias").insert([{ nome, saldo_inicial: saldo, saldo_atual: saldo, user_id: currentUser.id }]);
    if(error) return alert(error.message);
    contaNome.value=""; contaSaldo.value="";
    await loadContas();
  }catch(e){ console.error(e); alert("Erro ao criar conta"); }
});

async function loadContasExtra(){
  try{
    const { data, error } = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(error) throw error;
    if(selectExtrato) selectExtrato.innerHTML="";
    if(selectContaLanc) selectContaLanc.innerHTML="";
    (data||[]).forEach(c=>{ if(selectExtrato){ const o1=document.createElement("option"); o1.value=c.id; o1.textContent=c.nome; selectExtrato.appendChild(o1); } if(selectContaLanc){ const o2=document.createElement("option"); o2.value=c.id; o2.textContent=c.nome; selectContaLanc.appendChild(o2); } });
    if(selectContaLanc && !selectContaLanc.value && (data||[]).length>0) selectContaLanc.value=data[0].id;
    if(selectExtrato && !selectExtrato.value && (data||[]).length>0) selectExtrato.value=data[0].id;
  }catch(e){ console.error("loadContasExtra",e); }
}

function addDays(date,days){ const d=new Date(date); d.setDate(d.getDate()+days); return d; }
function addMonths(date,months){ const d=new Date(date); d.setMonth(d.getMonth()+months); return d; }
function addYears(date,years){ const d=new Date(date); d.setFullYear(d.getFullYear()+years); return d; }

if(btnAddLanc) btnAddLanc.addEventListener("click",async()=>{
  try{
    const valor=parseFloat(valorLanc.value); const desc=(descLanc.value||"").trim(); const data=dataLanc.value; const tipo=tipoLanc.value; const conta_id=selectContaLanc?selectContaLanc.value:null;
    const recTipo=document.getElementById("recorrencia-tipo")?document.getElementById("recorrencia-tipo").value:"none";
    const recParcelas=document.getElementById("recorrencia-parcelas")?parseInt(document.getElementById("recorrencia-parcelas").value||"1",10):1;
    if(!valor||!desc||!data) return alert("Preencha todos os campos!");
    if(editing.type){
      const table=editing.type==="receita"?"receitas":"despesas";
      const { error } = await supabase.from(table).update({ descricao: desc, valor, data, conta_id }).eq("id", editing.id);
      if(error) return alert(error.message);
      stopEdit(); await refreshMovements(); await renderExtrato(); return;
    }
    const inserts=[];
    if(recTipo && recTipo!=="none" && recParcelas>1){
      let base=new Date(data+"T00:00:00");
      for(let i=0;i<recParcelas;i++){
        let d;
        if(recTipo==="monthly") d=addMonths(base,i);
        else if(recTipo==="fortnight") d=addDays(base,i*15);
        else if(recTipo==="weekly") d=addDays(base,i*7);
        else if(recTipo==="annual") d=addYears(base,i);
        else d=addMonths(base,i);
        const iso=d.toISOString().slice(0,10);
        inserts.push({ table: tipo==="receita"?"receitas":"despesas", payload:{ descricao: desc, valor, data: iso, conta_id, user_id: currentUser.id, baixado:false } });
      }
    } else {
      inserts.push({ table: tipo==="receita"?"receitas":"despesas", payload:{ descricao: desc, valor, data, conta_id, user_id: currentUser.id, baixado:false } });
    }
    for(const it of inserts){ const { error } = await supabase.from(it.table).insert([it.payload]); if(error) console.error("insert parcela",error); }
    valorLanc.value=""; descLanc.value=""; dataLanc.value="";
    await refreshMovements(); await renderExtrato();
  }catch(e){ console.error("btnAddLanc",e); alert("Erro ao adicionar lançamento"); }
});

if(btnCancelEdit) btnCancelEdit.addEventListener("click",()=>stopEdit());
function startEdit(type,item){ editing.type=type; editing.id=item.id; tipoLanc.value=type; valorLanc.value=item.valor; descLanc.value=item.descricao; dataLanc.value=item.data; if(selectContaLanc) selectContaLanc.value=item.conta_id; btnAddLanc.textContent="Salvar"; if(btnCancelEdit) btnCancelEdit.classList.remove("hidden"); }
function stopEdit(){ editing={type:null,id:null}; valorLanc.value=""; descLanc.value=""; dataLanc.value=""; if(btnAddLanc) btnAddLanc.textContent="Adicionar"; if(btnCancelEdit) btnCancelEdit.classList.add("hidden"); }

async function deleteItem(type,id){
  try{
    if(!confirm("Deseja excluir este lançamento?")) return;
    const table=type==="receita"?"receitas":"despesas";
    await supabase.from(table).delete().eq("id",id);
    const { data: mov } = await supabase.from("movimentacoes").select("id,conta_id").eq("lancamento_id",id).maybeSingle();
    if(mov) await supabase.from("movimentacoes").delete().eq("id",mov.id);
    if(mov) await recalcularSaldo(mov.conta_id);
    await refreshMovements(); await renderExtrato();
  }catch(e){ console.error("deleteItem",e); }
}

async function refreshMovements(){
  try{
    const conta_id = selectContas ? selectContas.value : null;
    if(!conta_id) return;

    let periodo="mes_atual", inicio=null, fim=null;
    const now=new Date();
    if(periodoLancControl && periodoLancControl.value) periodo=periodoLancControl.value;
    if(periodo==="mes_atual"){ inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="mes_anterior"){ const ano=now.getFullYear(), mes=now.getMonth(); inicio=`${ano}-${String(mes).padStart(2,"0")}-01`; const last=new Date(ano,mes,0).getDate(); fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="ultimos_30"){ const past=new Date(now.getTime()-30*24*60*60*1000); inicio=`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,"0")}-${String(past.getDate()).padStart(2,"0")}`; fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
    else if(periodo==="personalizado"){ inicio = dataInicioLanc && dataInicioLanc.value ? dataInicioLanc.value : dataInicio.value; fim = dataFimLanc && dataFimLanc.value ? dataFimLanc.value : dataFim.value; }
    else { inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }

    const [rRes,dRes] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim).order("data"),
      supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim).order("data")
    ]);

    const [rOver,dOver] = await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).lt("data",inicio).eq("baixado",false).order("data"),
      supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).lt("data",inicio).eq("baixado",false).order("data")
    ]);

    const rec = rRes.data||[]; const desp = dRes.data||[]; const recOver = rOver.data||[]; const despOver = dOver.data||[];

    if(listReceitas) listReceitas.innerHTML="";
    if(listDespesas) listDespesas.innerHTML="";

    if((recOver.length>0 || despOver.length>0)){
      const overHeader=document.createElement("li"); overHeader.style.fontWeight="700"; overHeader.style.margin="6px 0"; overHeader.textContent="Lançamentos Atrasados:";
      listReceitas?.appendChild(overHeader.cloneNode(true));
      listDespesas?.appendChild(overHeader.cloneNode(true));
    }

    if(recOver.length>0) recOver.forEach(i=>{ listReceitas?.appendChild(createLancamentoItem(i,"receita",true)); });
    if(despOver.length>0) despOver.forEach(i=>{ listDespesas?.appendChild(createLancamentoItem(i,"despesa",true)); });

    let totalR=0,totalD=0;
    rec.forEach(i=>{ totalR+=Number(i.valor||0); listReceitas?.appendChild(createLancamentoItem(i,"receita",false)); });
    desp.forEach(i=>{ totalD+=Number(i.valor||0); listDespesas?.appendChild(createLancamentoItem(i,"despesa",false)); });

    if(totalReceitasEl) totalReceitasEl.textContent=formatReal(totalR);
    if(totalDespesasEl) totalDespesasEl.textContent=formatReal(totalD);

    await recalcularSaldo(conta_id);
    const { data: acc } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id",conta_id).maybeSingle();
    if(saldoAtualEl) saldoAtualEl.textContent=formatReal(Number((acc && acc.saldo_atual)||0));
  }catch(e){ console.error("refreshMovements",e); }
}

function createLancamentoItem(item,type,overdue){
  const li=document.createElement("li");
  li.style.fontFamily=`"Courier New",monospace`;
  li.style.fontWeight="700";
  li.style.marginBottom="8px";
  li.style.display="flex";
  li.style.justifyContent="space-between";
  li.style.alignItems="center";
  const left=document.createElement("div");
  const right=document.createElement("div");
  left.style.flex="1";
  right.style.marginLeft="10px";
  left.textContent=`${formatDate(item.data)} — ${item.descricao} — ${formatReal(Number(item.valor||0))}`;
  if(item.baixado){ left.textContent += " — (BAIXADO)"; li.style.opacity="0.6"; }
  if(overdue && !item.baixado){ left.textContent += " — (ATRASADO)"; left.style.borderLeft="4px solid orange"; left.style.paddingLeft="6px"; }
  if(!item.baixado){
    const baixarBtn=document.createElement("button");
    baixarBtn.textContent="Baixar";
    baixarBtn.style.marginLeft="6px";
    baixarBtn.onclick=async function(){
      if(baixarBtn.disabled) return;
      baixarBtn.disabled=true;
      try{ await baixarLancamento(type,item); }catch(e){ console.error(e); }
      baixarBtn.disabled=false;
    };
    right.appendChild(baixarBtn);
  }
  const editBtn=document.createElement("button");
  editBtn.textContent="Editar";
  editBtn.style.marginLeft="6px";
  editBtn.onclick=()=>startEdit(type,item);
  const delBtn=document.createElement("button");
  delBtn.textContent="Excluir";
  delBtn.style.marginLeft="6px";
  delBtn.onclick=()=>deleteItem(type,item.id);
  right.appendChild(editBtn); right.appendChild(delBtn);
  li.appendChild(left); li.appendChild(right);
  return li;
}

async function baixarLancamento(type,item){
  try{
    const { data:contas } = await supabase.from("contas_bancarias").select("*").eq("user_id",currentUser.id).order("created_at");
    if(!contas||contas.length===0) return alert("Crie uma conta primeiro.");
    let msg="Escolha a conta para baixar:\n"; contas.forEach((c,i)=> msg+=`${i+1}) ${c.nome} — ${formatReal(c.saldo_atual||0)}\n`); msg+="\nDigite o número ou deixe vazio para usar a conta original:";
    const resp=prompt(msg,"");
    let contaEscolhidaId=item.conta_id;
    if(resp&&resp.trim()!==""){
      const n=parseInt(resp,10);
      if(!isNaN(n)&&n>=1&&n<=contas.length) contaEscolhidaId=contas[n-1].id;
      else { const f=contas.find(c=>String(c.id)===resp.trim()); if(f) contaEscolhidaId=f.id; else return alert("Entrada inválida."); }
    }
    const { data: conta } = await supabase.from("contas_bancarias").select("*").eq("id",contaEscolhidaId).maybeSingle();
    let novoSaldo=Number(conta.saldo_atual||0);
    if(type==="receita") novoSaldo+=Number(item.valor); else novoSaldo-=Number(item.valor);
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id",contaEscolhidaId);
    const table = type==="receita"?"receitas":"despesas";
    const dataBaixa = new Date().toISOString().slice(0,10);
    const { error:errLanc } = await supabase.from(table).update({ baixado:true, data_baixa:dataBaixa }).eq("id",item.id);
    if(errLanc) throw errLanc;
    const { data:existing } = await supabase.from("movimentacoes").select("id").eq("lancamento_id",item.id).maybeSingle();
    if(!existing){
      const mov = { user_id: currentUser.id, conta_id:contaEscolhidaId, tipo:type==="receita"?"credito":"debito", valor:Number(item.valor), descricao:item.descricao, data:dataBaixa, lancamento_id:item.id };
      const { error:errMov } = await supabase.from("movimentacoes").insert([mov]);
      if(errMov) throw errMov;
    }
    await recalcularSaldo(contaEscolhidaId);
    await refreshMovements(); await renderExtrato();
  }catch(e){ console.error("baixarLancamento",e); alert("Erro ao baixar"); }
}

async function cancelarBaixaMovimentacao(mov){
  try{
    if(!confirm("Deseja cancelar esta baixa?")) return;
    const { data:conta } = await supabase.from("contas_bancarias").select("*").eq("id",mov.conta_id).maybeSingle();
    let novoSaldo=Number(conta.saldo_atual||0);
    if(mov.tipo==="credito") novoSaldo-=Number(mov.valor); else novoSaldo+=Number(mov.valor);
    await supabase.from("contas_bancarias").update({ saldo_atual: novoSaldo }).eq("id",mov.conta_id);
    await supabase.from("movimentacoes").delete().eq("id",mov.id);
    if(mov.lancamento_id){
      await supabase.from("receitas").update({ baixado:false, data_baixa:null }).eq("id",mov.lancamento_id);
      await supabase.from("despesas").update({ baixado:false, data_baixa:null }).eq("id",mov.lancamento_id);
    }
    await recalcularSaldo(mov.conta_id);
    await refreshMovements(); await renderExtrato();
  }catch(e){ console.error("cancelarBaixa",e); alert("Erro ao cancelar baixa"); }
}

function subscribeToChanges(){
  try{
    supabase.channel("rt_receitas").on("postgres_changes",{event:"*",schema:"public",table:"receitas"},payload=>{ if(payload.record?.user_id===currentUser.id) refreshMovements(); }).subscribe();
    supabase.channel("rt_despesas").on("postgres_changes",{event:"*",schema:"public",table:"despesas"},payload=>{ if(payload.record?.user_id===currentUser.id) refreshMovements(); }).subscribe();
    supabase.channel("rt_contas").on("postgres_changes",{event:"*",schema:"public",table:"contas_bancarias"},()=>{ refreshMovements(); renderExtrato(); }).subscribe();
    supabase.channel("rt_movimentacoes").on("postgres_changes",{event:"*",schema:"public",table:"movimentacoes"},()=>renderExtrato()).subscribe();
  }catch(e){ console.error("subscribe",e); }
}

function showScreen(target){
  telaDashboard?.classList.add("hidden");
  telaContas?.classList.add("hidden");
  telaLanc?.classList.add("hidden");
  btnDash?.classList.remove("active");
  btnContas?.classList.remove("active");
  btnLanc?.classList.remove("active");
  if(target==="dashboard"){ telaDashboard?.classList.remove("hidden"); btnDash?.classList.add("active"); loadDashboard(); }
  else if(target==="contas"){ telaContas?.classList.remove("hidden"); btnContas?.classList.add("active"); }
  else { telaLanc?.classList.remove("hidden"); btnLanc?.classList.add("active"); }
}

btnDash?.addEventListener("click",()=>showScreen("dashboard"));
btnContas?.addEventListener("click",()=>showScreen("contas"));
btnLanc?.addEventListener("click",()=>showScreen("lanc"));

document.querySelectorAll(".tab-btn").forEach(b=>{ b.addEventListener("click",()=>{ document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); const tab=b.dataset.tab; if(tab==="cadastro"){ tabCadastro?.classList.remove("hidden"); tabExtrato?.classList.add("hidden"); } else { tabCadastro?.classList.add("hidden"); tabExtrato?.classList.remove("hidden"); renderExtrato(); } }); });

btnFiltrarExtrato?.addEventListener("click",()=>{ renderExtrato(); });
btnFiltrarLanc?.addEventListener("click",()=>{ refreshMovements(); });

async function renderExtrato(){
  try{
    if(!tableExtrato) return;
    const conta_id = selectExtrato ? selectExtrato.value : null;
    if(!conta_id) return;
    await recalcularSaldo(conta_id);
    const now=new Date(); let inicio,fim;
    const periodo = periodoExtrato ? periodoExtrato.value : "mes_atual";
    if(periodo==="mes_atual"){ inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="mes_anterior"){ const ano=now.getFullYear(); const mes=now.getMonth(); inicio=`${ano}-${String(mes).padStart(2,"0")}-01`; const last=new Date(ano,mes,0).getDate(); fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }
    else if(periodo==="ultimos_30"){ const past=new Date(now.getTime()-30*24*60*60*1000); inicio=`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,"0")}-${String(past.getDate()).padStart(2,"0")}`; fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }
    else if(periodo==="personalizado"){ inicio = dataInicio ? dataInicio.value : null; fim = dataFim ? dataFim.value : null; }
    else { inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`; const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`; }

    const { data: acc } = await supabase.from("contas_bancarias").select("saldo_inicial,created_at,saldo_atual").eq("id",conta_id).maybeSingle();
    const saldoInicial=Number((acc && acc.saldo_inicial)||0);
    const dataCriacao=acc && acc.created_at ? (new Date(acc.created_at)).toISOString().slice(0,10) : null;

    const { data: movs } = await supabase.from("movimentacoes").select("*").eq("conta_id",conta_id).gte("data",inicio).lte("data",fim).order("data");

    const lines=[];
    if(saldoInicial!==0 && dataCriacao) lines.push({ tipo:"saldo_inicial", data:dataCriacao, descricao:"SALDO INICIAL", valor:saldoInicial });
    (movs||[]).forEach(m=>lines.push({ tipo:"mov", data:m.data, descricao:m.descricao, valor:Number(m.valor||0), mov:m }));

    lines.sort((a,b)=> new Date(a.data+"T00:00:00") - new Date(b.data+"T00:00:00"));

    tableExtrato.innerHTML="";
    let somaCred=0, somaDeb=0;
    lines.forEach(row=>{
      const tr=document.createElement("tr"); const tdA=document.createElement("td");
      if(row.tipo==="saldo_inicial"){ tr.innerHTML=`<td>${formatDate(row.data)}</td><td>SALDO INICIAL</td><td>Crédito</td><td>${formatReal(row.valor)}</td>`; somaCred+=row.valor; }
      else{ const tipoText = row.mov.tipo==="credito"?"Crédito":"Débito"; tr.innerHTML=`<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td>${tipoText}</td><td>${formatReal(row.valor)}</td>`; if(row.mov.tipo==="credito") somaCred+=row.valor; else somaDeb+=row.valor; if(row.mov.lancamento_id){ const btn=document.createElement("button"); btn.textContent="Cancelar Baixa"; btn.onclick=()=>cancelarBaixaMovimentacao(row.mov); tdA.appendChild(btn); } }
      tr.appendChild(tdA); tableExtrato.appendChild(tr);
    });

    const saldoPeriodo = somaCred - somaDeb;
    const { data:contaAtual } = await supabase.from("contas_bancarias").select("saldo_atual").eq("id",conta_id).maybeSingle();
    const saldoAtual = contaAtual ? Number(contaAtual.saldo_atual||0) : 0;

    document.getElementById("total-receitas-extrato")?.textContent=formatReal(somaCred);
    document.getElementById("total-despesas-extrato")?.textContent=formatReal(somaDeb);
    document.getElementById("total-valor")?.textContent=formatReal(saldoPeriodo);
    document.getElementById("saldo-periodo-extrato")?.textContent=formatReal(saldoPeriodo);
    document.getElementById("saldo-atual-conta-extrato")?.textContent=formatReal(saldoAtual);

  }catch(e){ console.error("renderExtrato",e); }
}

async function loadDashboard(){
  try{
    const now=new Date(); const ano=now.getFullYear(); const mes=now.getMonth()+1;
    const inicio=`${ano}-${String(mes).padStart(2,"0")}-01`; const last=new Date(ano,mes,0).getDate(); const fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    const rec=await supabase.from("receitas").select("*").eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);
    const desp=await supabase.from("despesas").select("*").eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);
    const totalR=(rec.data||[]).reduce((a,b)=>a+Number(b.valor||0),0); const totalD=(desp.data||[]).reduce((a,b)=>a+Number(b.valor||0),0);
    document.getElementById("dash-period")?.textContent=`${mes}/${ano}`;
    document.getElementById("dash-receber")?.textContent=formatReal(totalR);
    document.getElementById("dash-pagar")?.textContent=formatReal(totalD);
    document.getElementById("dash-saldo-atual")?.textContent=formatReal(totalR-totalD);
    document.getElementById("dash-saldo-previsto")?.textContent=formatReal(totalR-totalD);
    const ctx=document.getElementById("chart-dashboard"); if(chartDashboard) chartDashboard.destroy();
    chartDashboard=new Chart(ctx,{ type:"bar", data:{ labels:["Receitas","Despesas"], datasets:[{ label:"Resumo do mês", data:[totalR,totalD], backgroundColor:["green","red"] }] }, options:{ responsive:true, scales:{ y:{ beginAtZero:true } } } });
  }catch(e){ console.error("loadDashboard",e); }
}

selectContas?.addEventListener("change",()=>{ recalcularSaldo(selectContas.value); refreshMovements(); });
selectExtrato?.addEventListener("change",()=>{ recalcularSaldo(selectExtrato.value); renderExtrato(); });
periodoExtrato?.addEventListener("change",()=>{ if(periodoExtrato.value==="personalizado"){ dataInicio?.classList.remove("hidden"); dataFim?.classList.remove("hidden"); } else { dataInicio?.classList.add("hidden"); dataFim?.classList.add("hidden"); } });
periodoLancControl?.addEventListener("change",()=>{ if(periodoLancControl.value==="personalizado"){ dataInicioLanc?.classList.remove("hidden"); dataFimLanc?.classList.remove("hidden"); } else { dataInicioLanc?.classList.add("hidden"); dataFimLanc?.classList.add("hidden"); } });

subscribeToChanges();
