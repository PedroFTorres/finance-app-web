function formatDate(d){if(!d)return"";const D=new Date(d+"T00:00:00");const dia=String(D.getDate()).padStart(2,"0");const mes=String(D.getMonth()+1).padStart(2,"0");const ano=D.getFullYear();return `${dia}/${mes}/${ano}`;}
function formatReal(v){if(typeof v!=="number")v=Number(v||0);return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

let currentUser=null;let editing={type:null,id:null};

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

let tableExtrato=null;document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("table-extrato");if(t) tableExtrato=t.querySelector("tbody");});

let chartDashboard=null;

supabase.auth.getSession().then(({data})=>{if(!data.session) window.location.href="login.html"; else { currentUser=data.session.user; document.getElementById("user-email").textContent=currentUser.email; initApp(); }});

document.getElementById("btn-logout").onclick=async()=>{await supabase.auth.signOut(); window.location.href="login.html";};

async function initApp(){ await loadContas(); subscribeToChanges(); }

/* ============================================================
   FUNÇÃO RE-CALCULAR SALDO
   ============================================================ */
async function recalcularSaldo(conta_id){
  try{
    const { data: conta, error: errC } = await supabase.from("contas_bancarias").select("saldo_inicial").eq("id",conta_id).single();
    if(errC) throw errC;
    const saldoInicial = Number(conta.saldo_inicial||0);

    const { data: movs, error: errM } = await supabase.from("movimentacoes").select("tipo,valor").eq("conta_id",conta_id);
    if(errM) throw errM;

    let totalCred=0,totalDeb=0;
    (movs||[]).forEach(m=>{
      if(m.tipo==="credito") totalCred+=Number(m.valor||0);
      else totalDeb+=Number(m.valor||0);
    });

    const saldoFinal = saldoInicial + totalCred - totalDeb;

    const { error: errU } = await supabase.from("contas_bancarias").update({saldo_atual: saldoFinal}).eq("id",conta_id);
    if(errU) throw errU;

    return saldoFinal;
  }catch(e){
    console.error("Erro ao recalcular saldo:",e);
    alert("Erro ao recalcular saldo: "+(e.message||JSON.stringify(e)));
  }
}

/* ============================================================
   CARREGAR CONTAS
   ============================================================ */
async function loadContas(){
  try{
    const { data, error } = await supabase.from("contas_bancarias")
      .select("*").eq("user_id",currentUser.id).order("created_at");
    if(error) throw error;

    selectContas.innerHTML="";
    (data||[]).forEach(c=>{
      const opt=document.createElement("option");
      opt.value=c.id;
      opt.textContent=`${c.nome} (R$ ${Number(c.saldo_inicial||0).toFixed(2)})`;
      selectContas.appendChild(opt);
    });

    if((data||[]).length>0){
      if(!selectContas.value) selectContas.value=data[0].id;
      await recalcularSaldo(selectContas.value);
      await refreshMovements();
    }
  }catch(e){ console.error("loadContas:",e); }

  await loadContasExtra();
}

/* ============================================================
   CONTAS - ADICIONAR
   ============================================================ */
btnAddConta.onclick=async()=>{
  try{
    const nome=(contaNome.value||"").trim();
    if(!nome) return alert("Nome da conta obrigatório.");

    const saldo=parseFloat(contaSaldo.value||0);

    const { error } = await supabase.from("contas_bancarias")
      .insert([{ nome, saldo_inicial:saldo, saldo_atual:saldo, user_id:currentUser.id }]);

    if(error) return alert(error.message);

    contaNome.value=""; contaSaldo.value="";
    await loadContas();
  }catch(e){ alert("Erro ao criar conta"); }
};

/* ============================================================
   CONTAS - CARREGAR EXTRA
   ============================================================ */
async function loadContasExtra(){
  try{
    const { data } = await supabase.from("contas_bancarias").select("*")
      .eq("user_id",currentUser.id).order("created_at");

    selectExtrato.innerHTML="";
    selectContaLanc.innerHTML="";

    (data||[]).forEach(c=>{
      const o1=document.createElement("option");
      o1.value=c.id; o1.textContent=c.nome;
      selectExtrato.appendChild(o1);

      const o2=document.createElement("option");
      o2.value=c.id; o2.textContent=c.nome;
      selectContaLanc.appendChild(o2);
    });

    if(!selectContaLanc.value && data.length>0) selectContaLanc.value=data[0].id;
    if(!selectExtrato.value && data.length>0) selectExtrato.value=data[0].id;

  }catch(e){ console.error("loadContasExtra:",e); }
}

/* ============================================================
   RE-CÁLCULO DE DATAS (RECORRÊNCIA)
   ============================================================ */
function addDays(date,days){ const d=new Date(date); d.setDate(d.getDate()+days); return d; }
function addMonths(date,months){ const d=new Date(date); d.setMonth(d.getMonth()+months); return d; }
function addYears(date,years){ const d=new Date(date); d.setFullYear(d.getFullYear()+years); return d; }

/* ============================================================
   ADICIONAR LANÇAMENTO
   ============================================================ */
btnAddLanc.onclick=async()=>{
  try{
    const valor=parseFloat(valorLanc.value);
    const desc=(descLanc.value||"").trim();
    const data=dataLanc.value;
    const tipo=tipoLanc.value;
    const conta_id=selectContaLanc.value;

    const recTipo=document.getElementById("recorrencia-tipo").value;
    const parcelas=parseInt(document.getElementById("recorrencia-parcelas").value||"1",10);

    if(!valor||!desc||!data) return alert("Preencha todos os campos!");

    if(editing.type){
      const table=editing.type==="receita"?"receitas":"despesas";

      const { error } = await supabase.from(table).update({
        descricao: desc,
        valor,
        data,
        conta_id
      }).eq("id", editing.id);

      if(error) return alert(error.message);

      stopEdit();
      refreshMovements();
      renderExtrato();
      return;
    }

    const inserts=[];
    const base=new Date(data+"T00:00:00");

    if(recTipo!=="none" && parcelas>1){
      for(let i=0;i<parcelas;i++){
        let d;
        if(recTipo==="monthly") d=addMonths(base,i);
        else if(recTipo==="fortnight") d=addDays(base,i*15);
        else if(recTipo==="weekly") d=addDays(base,i*7);
        else if(recTipo==="annual") d=addYears(base,i);
        else d=addMonths(base,i);

        const iso=d.toISOString().slice(0,10);

        inserts.push({
          table: tipo==="receita"?"receitas":"despesas",
          payload:{ descricao:desc, valor, data:iso, conta_id, user_id:currentUser.id, baixado:false }
        });
      }
    } else {
      inserts.push({
        table: tipo==="receita"?"receitas":"despesas",
        payload:{ descricao:desc, valor, data, conta_id, user_id:currentUser.id, baixado:false }
      });
    }

    for(const it of inserts){
      await supabase.from(it.table).insert([it.payload]);
    }

    valorLanc.value=""; descLanc.value=""; dataLanc.value="";
    refreshMovements(); renderExtrato();

  }catch(e){ alert("Erro ao adicionar lançamento"); }
};

btnCancelEdit.onclick=()=>stopEdit();
function startEdit(type,item){
  editing.type=type; editing.id=item.id;
  tipoLanc.value=type;
  valorLanc.value=item.valor;
  descLanc.value=item.descricao;
  dataLanc.value=item.data;
  selectContaLanc.value=item.conta_id;
  btnAddLanc.textContent="Salvar";
  btnCancelEdit.classList.remove("hidden");
}
function stopEdit(){
  editing={type:null,id:null};
  valorLanc.value=""; descLanc.value=""; dataLanc.value="";
  btnAddLanc.textContent="Adicionar";
  btnCancelEdit.classList.add("hidden");
}

async function deleteItem(type,id){
  if(!confirm("Excluir lançamento?")) return;
  const table=type==="receita"?"receitas":"despesas";
  await supabase.from(table).delete().eq("id",id);
  refreshMovements(); renderExtrato();
}

/* ============================================================
   REFRESH MOVIMENTOS (lista de lançamentos)
   ============================================================ */
async function refreshMovements(){
  try{
    const conta_id=selectContas.value;

    const [rRes,dRes]=await Promise.all([
      supabase.from("receitas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).order("data"),
      supabase.from("despesas").select("*").eq("conta_id",conta_id).eq("user_id",currentUser.id).order("data")
    ]);

    const rec=rRes.data||[]; const desp=dRes.data||[];

    listReceitas.innerHTML="";
    listDespesas.innerHTML="";

    let totalR=0,totalD=0;

    rec.forEach(i=>{
      totalR+=Number(i.valor||0);
      listReceitas.appendChild(createLancamentoItem(i,"receita"));
    });
    desp.forEach(i=>{
      totalD+=Number(i.valor||0);
      listDespesas.appendChild(createLancamentoItem(i,"despesa"));
    });

    totalReceitasEl.textContent=formatReal(totalR);
    totalDespesasEl.textContent=formatReal(totalD);

    await recalcularSaldo(conta_id);

    const { data:acc } = await supabase.from("contas_bancarias")
      .select("saldo_atual").eq("id",conta_id).single();

    saldoAtualEl.textContent=formatReal(acc.saldo_atual||0);

  }catch(e){ console.error("refreshMovements:",e); }
}

/* ============================================================
   ITEM DE LANÇAMENTO
   ============================================================ */
function createLancamentoItem(item,type){
  const li=document.createElement("li");
  li.style.fontFamily=`"Courier New",monospace`;
  li.style.fontWeight="bold";
  li.style.marginBottom="10px";
  li.style.color=type==="receita"?"green":"red";

  const span=document.createElement("span");
  span.textContent=`${formatDate(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;
  li.appendChild(span);

  const actions=document.createElement("span");
  actions.style.float="right";

  if(!item.baixado){
    const baixar=document.createElement("button");
    baixar.textContent="Baixar";
    baixar.style.marginLeft="5px";
    baixar.onclick=()=>baixarLancamento(type,item);
    actions.appendChild(baixar);
  }

  const edit=document.createElement("button");
  edit.textContent="Editar";
  edit.style.marginLeft="5px";
  edit.onclick=()=>startEdit(type,item);

  const del=document.createElement("button");
  del.textContent="Excluir";
  del.style.marginLeft="5px";
  del.onclick=()=>deleteItem(type,item.id);

  actions.appendChild(edit);
  actions.appendChild(del);
  li.appendChild(actions);

  return li;
}

/* ============================================================
   BAIXAR LANÇAMENTO
   ============================================================ */
async function baixarLancamento(type,item){
  try{
    const { data:contas } = await supabase.from("contas_bancarias")
      .select("*").eq("user_id",currentUser.id).order("created_at");

    let msg="Escolha conta:\n";
    contas.forEach((c,i)=> msg+=`${i+1}) ${c.nome} — ${formatReal(c.saldo_atual||0)}\n`);
    msg+="\nOu deixe vazio para usar a conta do lançamento.";

    const resp=prompt(msg,"");
    let contaEscolhidaId=item.conta_id;

    if(resp&&resp.trim()!==""){
      const n=parseInt(resp);
      if(!isNaN(n)&&n>=1&&n<=contas.length)
        contaEscolhidaId=contas[n-1].id;
    }

    const { data:conta } = await supabase.from("contas_bancarias")
      .select("*").eq("id",contaEscolhidaId).single();

    let novoSaldo=Number(conta.saldo_atual||0);
    if(type==="receita") novoSaldo+=Number(item.valor);
    else novoSaldo-=Number(item.valor);

    await supabase.from("contas_bancarias")
      .update({saldo_atual:novoSaldo}).eq("id",contaEscolhidaId);

    const table=type==="receita"?"receitas":"despesas";

    await supabase.from(table).update({
      baixado:true,
      data_baixa:new Date().toISOString().slice(0,10)
    }).eq("id",item.id);

    const { data:existing } = await supabase.from("movimentacoes")
      .select("id").eq("lancamento_id",item.id).maybeSingle();

    if(!existing){
      await supabase.from("movimentacoes").insert([{
        user_id:currentUser.id,
        conta_id:contaEscolhidaId,
        tipo:type==="receita"?"credito":"debito",
        valor:item.valor,
        descricao:item.descricao,
        data:new Date().toISOString().slice(0,10),
        lancamento_id:item.id
      }]);
    }

    await recalcularSaldo(contaEscolhidaId);

    alert("Baixado com sucesso!");
    refreshMovements(); renderExtrato();

  }catch(e){ alert("Erro ao baixar: "+e.message); }
}

/* ============================================================
   CANCELAR BAIXA
   ============================================================ */
async function cancelarBaixaMovimentacao(mov){
  try{
    if(!confirm("Cancelar baixa?")) return;

    const { data:conta } = await supabase.from("contas_bancarias")
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

    alert("Baixa cancelada!");
    refreshMovements(); renderExtrato();

  }catch(e){ alert("Erro cancelar baixa:"+e.message); }
}

/* ============================================================
   SUBSCRIBE REALTIME
   ============================================================ */
function subscribeToChanges(){
  supabase.channel("rt_rec").on("postgres_changes",
    {event:"*",schema:"public",table:"receitas"},
    ()=>refreshMovements()
  ).subscribe();

  supabase.channel("rt_desp").on("postgres_changes",
    {event:"*",schema:"public",table:"despesas"},
    ()=>refreshMovements()
  ).subscribe();

  supabase.channel("rt_contas").on("postgres_changes",
    {event:"*",schema:"public",table:"contas_bancarias"},
    ()=>{refreshMovements(); renderExtrato();}
  ).subscribe();

  supabase.channel("rt_movs").on("postgres_changes",
    {event:"*",schema:"public",table:"movimentacoes"},
    ()=>renderExtrato()
  ).subscribe();
}

/* ============================================================
   TROCAR TELAS
   ============================================================ */
function showScreen(t){
  telaDashboard.classList.add("hidden");
  telaContas.classList.add("hidden");
  telaLanc.classList.add("hidden");
  btnDash.classList.remove("active");
  btnContas.classList.remove("active");
  btnLanc.classList.remove("active");

  if(t==="dashboard"){
    telaDashboard.classList.remove("hidden");
    btnDash.classList.add("active");
    loadDashboard();
  }
  else if(t==="contas"){
    telaContas.classList.remove("hidden");
    btnContas.classList.add("active");
  }
  else {
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

btnFiltrarExtrato.onclick=()=>renderExtrato();

/* ============================================================
   EXTRATO - ESTILO BANCÁRIO REAL
   ============================================================ */
async function renderExtrato(){
  try{
    if(!tableExtrato) return;

    const conta_id=selectExtrato.value;
    await recalcularSaldo(conta_id);

    const now=new Date();
    let inicio,fim;
    const periodo=periodoExtrato.value;

    if(periodo==="mes_atual"){
      inicio=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
      fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    }
    else if(periodo==="mes_anterior"){
      const ano=now.getFullYear(), mes=now.getMonth();
      inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
      const last=new Date(ano,mes,0).getDate();
      fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    }
    else if(periodo==="ultimos_30"){
      const past=new Date(now.getTime()-30*24*60*60*1000);
      inicio=`${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,"0")}-${String(past.getDate()).padStart(2,"0")}`;
      fim=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    }
    else{
      inicio=dataInicio.value;
      fim=dataFim.value;
    }

    const { data:acc } = await supabase.from("contas_bancarias")
      .select("saldo_inicial,created_at,saldo_atual").eq("id",conta_id).single();

    const saldoInicial=Number(acc.saldo_inicial||0);
    const dataCriacao=(new Date(acc.created_at)).toISOString().slice(0,10);

    const { data:movs } = await supabase.from("movimentacoes")
      .select("*").eq("conta_id",conta_id)
      .gte("data",inicio).lte("data",fim).order("data");

    const lines=[];
    if(saldoInicial!==0){
      lines.push({tipo:"saldo_inicial",data:dataCriacao,descricao:"SALDO INICIAL",valor:saldoInicial});
    }

    (movs||[]).forEach(m=>{
      lines.push({
        tipo:"mov",
        data:m.data,
        descricao:m.descricao,
        valor:Number(m.valor||0),
        mov:m
      });
    });

    lines.sort((a,b)=> new Date(a.data)-new Date(b.data));

    tableExtrato.innerHTML="";
    let somaCred=0, somaDeb=0;

    lines.forEach(row=>{
      const tr=document.createElement("tr");
      const tdA=document.createElement("td");

      if(row.tipo==="saldo_inicial"){
        tr.innerHTML=`<td>${formatDate(row.data)}</td><td>SALDO INICIAL</td><td>Crédito</td><td>${formatReal(row.valor)}</td>`;
        somaCred+=row.valor;
      } else {
        const tipoDisplay=row.mov.tipo==="credito"?"Crédito":"Débito";
        tr.innerHTML=`<td>${formatDate(row.data)}</td><td>${row.descricao}</td><td>${tipoDisplay}</td><td>${formatReal(row.valor)}</td>`;
        if(row.mov.tipo==="credito") somaCred+=row.valor;
        else somaDeb+=row.valor;

        if(row.mov.lancamento_id){
          const btn=document.createElement("button");
          btn.textContent="Cancelar Baixa";
          btn.onclick=()=>cancelarBaixaMovimentacao(row.mov);
          tdA.appendChild(btn);
        }
      }

      tr.appendChild(tdA);
      tableExtrato.appendChild(tr);
    });

    const saldoPeriodo=somaCred-somaDeb;

    document.getElementById("total-receitas-extrato").textContent=formatReal(somaCred);
    document.getElementById("total-despesas-extrato").textContent=formatReal(somaDeb);
    document.getElementById("total-valor").textContent=formatReal(saldoPeriodo);
    document.getElementById("saldo-periodo-extrato").textContent=formatReal(saldoPeriodo);
    document.getElementById("saldo-atual-conta-extrato").textContent=formatReal(acc.saldo_atual);

  }catch(e){ console.error("renderExtrato:",e); }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function loadDashboard(){
  try{
    const now=new Date();
    const ano=now.getFullYear(), mes=now.getMonth()+1;

    const inicio=`${ano}-${String(mes).padStart(2,"0")}-01`;
    const last=new Date(ano,mes,0).getDate();
    const fim=`${ano}-${String(mes).padStart(2,"0")}-${String(last).padStart(2,"0")}`;

    const rec=await supabase.from("receitas").select("*")
      .eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);

    const desp=await supabase.from("despesas").select("*")
      .eq("user_id",currentUser.id).gte("data",inicio).lte("data",fim);

    const totalR=(rec.data||[]).reduce((a,b)=>a+Number(b.valor||0),0);
    const totalD=(desp.data||[]).reduce((a,b)=>a+Number(b.valor||0),0);

    document.getElementById("dash-period").textContent=`${mes}/${ano}`;
    document.getElementById("dash-receber").textContent=formatReal(totalR);
    document.getElementById("dash-pagar").textContent=formatReal(totalD);
    document.getElementById("dash-saldo-atual").textContent=formatReal(totalR-totalD);
    document.getElementById("dash-saldo-previsto").textContent=formatReal(totalR-totalD);

    const ctx=document.getElementById("chart-dashboard");
    if(chartDashboard) chartDashboard.destroy();

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
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });

  }catch(e){ console.error("loadDashboard:",e); }
}

/* ============================================================
   EVENTOS FINAIS
   ============================================================ */
showScreen("contas");

selectContas.onchange=()=>{
  recalcularSaldo(selectContas.value);
  refreshMovements();
};

selectExtrato.onchange=()=>{
  recalcularSaldo(selectExtrato.value);
  renderExtrato();
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
