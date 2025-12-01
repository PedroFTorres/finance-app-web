// cartao.js - módulo de cartões (independente do app.js principal)
// Requer supabase.js carregado antes
(async ()=>{

if(typeof supabase==='undefined'){
  alert("supabase.js não encontrado. Importe supabase.js antes de cartao.js");
  return;
}

const state = {
  user: null,
  cards: [],
  categories: []
};

// elementos
const btnBack = document.getElementById("btn-back");
const btnLogout = document.getElementById("btn-logout");
const userEmail = document.getElementById("user-email");

const cardsList = document.getElementById("cards-list");
const btnNewCard = document.getElementById("btn-new-card");
const viewNewCard = document.getElementById("view-new-card");
const viewFaturas = document.getElementById("view-faturas");
const viewLancamento = document.getElementById("view-lancamento");
const viewHistorico = document.getElementById("view-historico");

const btnSaveCard = document.getElementById("btn-save-card");
const btnCancelCard = document.getElementById("btn-cancel-card");
const cardNome = document.getElementById("card-nome");
const cardLimite = document.getElementById("card-limite");
const cardDiaFechamento = document.getElementById("card-dia-fechamento");
const cardDiaVencimento = document.getElementById("card-dia-vencimento");

const selectCartaoFaturas = document.getElementById("select-cartao-faturas");
const selectMesFaturas = document.getElementById("select-mes-faturas");
const btnRefreshFaturas = document.getElementById("btn-refresh-faturas");
const faturaSummary = document.getElementById("fatura-summary");
const listaComprasFatura = document.getElementById("lista-compras-fatura");
const selectContaPagamento = document.getElementById("select-conta-pagamento");
const dataVencimentoFatura = document.getElementById("data-vencimento-fatura");
const btnFecharFatura = document.getElementById("btn-fechar-fatura");
const btnPagarFatura = document.getElementById("btn-pagar-fatura");

const selectCartaoLanc = document.getElementById("select-cartao-lanc");
const selectCategoriaLancCartao = document.getElementById("select-categoria-lanc-cartao");
const cartDesc = document.getElementById("cart-desc");
const cartValor = document.getElementById("cart-valor");
const cartData = document.getElementById("cart-data");
const cartParcelas = document.getElementById("cart-parcelas");
const btnAddPurchase = document.getElementById("btn-add-purchase");
const btnCancelPurchase = document.getElementById("btn-cancel-purchase");

const listaFaturasHistorico = document.getElementById("lista-faturas-historico");

// helpers de UI
function hideAllViews(){
  viewNewCard.classList.add("hidden");
  viewFaturas.classList.add("hidden");
  viewLancamento.classList.add("hidden");
  viewHistorico.classList.add("hidden");
}
function showView(v){
  hideAllViews();
  v.classList.remove("hidden");
}
function formatReal(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function formatDateISO(date){ // yyyy-mm-dd
  const d = new Date(date+"T00:00:00");
  return d.toISOString().slice(0,10);
}
function todayISO(){ return new Date().toISOString().slice(0,10); }

// sessão e inicialização
const sessionResp = await supabase.auth.getSession();
if(!sessionResp.data.session){
  window.location.href = "login.html";
  return;
}
state.user = sessionResp.data.session.user;
userEmail.textContent = state.user.email;

// back + logout
btnBack.onclick = () => window.location.href = "app.html";
btnLogout.onclick = async ()=>{
  await supabase.auth.signOut();
  window.location.href = "login.html";
};

// navegação atalhos
document.getElementById("nav-fatura").onclick = ()=>{ showView(viewFaturas); loadFaturasSelect(); };
document.getElementById("nav-lancamento").onclick = ()=>{ showView(viewLancamento); loadSelectsForLanc(); };
document.getElementById("nav-historico").onclick = ()=>{ showView(viewHistorico); loadHistoricoFaturas(); };

// new card UI
btnNewCard.onclick = ()=>{
  showView(viewNewCard);
  cardNome.value=''; cardLimite.value='0'; cardDiaFechamento.value='5'; cardDiaVencimento.value='25';
};
btnCancelCard.onclick = ()=>showView(viewFaturas);

// salvar cartão
btnSaveCard.onclick = async ()=>{
  const nome = cardNome.value.trim();
  const limite = Number(cardLimite.value||0);
  const diaFech = Number(cardDiaFechamento.value||0);
  const diaVenc = Number(cardDiaVencimento.value||0);
  if(!nome) return alert("Preencha o nome do cartão.");
  if(!(diaFech>=1 && diaFech<=28)) return alert("Dia do fechamento deve ser entre 1 e 28.");
  if(!(diaVenc>=1 && diaVenc<=31)) return alert("Dia de vencimento inválido.");

  await supabase.from("cartoes_credito").insert([{
    user_id: state.user.id,
    nome, limite, dia_fechamento:diaFech, dia_vencimento:diaVenc
  }]);

  await loadCards();
  showView(viewFaturas);
};

// carregamentos
async function loadCards(){
  const {data} = await supabase.from("cartoes_credito").select("*").eq("user_id", state.user.id).order("created_at", {ascending:false});
  state.cards = data||[];
  renderCards();
  populateCardSelects();
}

function renderCards(){
  cardsList.innerHTML='';
  state.cards.forEach(c=>{
    const el = document.createElement("div");
    el.className='card-item';
    el.innerHTML = `
      <div class="card-meta">
        <div class="card-name">${c.nome}</div>
        <div class="card-balance">Limite: ${formatReal(c.limite)}</div>
        <div class="card-balance">Fecha dia: ${c.dia_fechamento} • Venc: ${c.dia_vencimento}</div>
      </div>
      <div class="card-actions">
        <button data-id="${c.id}" class="btn-view-faturas">Faturas</button>
        <button data-id="${c.id}" class="btn-lancar">Lançar</button>
        <button data-id="${c.id}" class="btn-delete">Excluir</button>
      </div>
    `;
    cardsList.appendChild(el);
  });

  // listeners locais
  document.querySelectorAll(".btn-view-faturas").forEach(b=>{
    b.onclick = (e)=>{
      const id = b.dataset.id;
      selectCartaoFaturas.value = id;
      selectCartaoLanc.value = id;
      loadFaturaForSelected();
      showView(viewFaturas);
    };
  });
  document.querySelectorAll(".btn-lancar").forEach(b=>{
    b.onclick = (e)=>{
      const id = b.dataset.id;
      selectCartaoLanc.value = id;
      showView(viewLancamento);
      loadSelectsForLanc();
    };
  });
  document.querySelectorAll(".btn-delete").forEach(b=>{
    b.onclick = async ()=>{
      const id = b.dataset.id;
      if(!confirm("Excluir cartão e todas as compras?")) return;
      await supabase.from("cartao_lancamentos").delete().eq("cartao_id",id);
      await supabase.from("cartoes_credito").delete().eq("id",id);
      await loadCards();
    };
  });
}

// popular selects
async function populateCardSelects(){
  // selects: select-cartao-faturas, select-cartao-lanc
  selectCartaoFaturas.innerHTML='';
  selectCartaoLanc.innerHTML='';
  state.cards.forEach(c=>{
    const o1 = document.createElement("option"); o1.value=c.id; o1.textContent=c.nome;
    const o2 = document.createElement("option"); o2.value=c.id; o2.textContent=c.nome;
    selectCartaoFaturas.appendChild(o1);
    selectCartaoLanc.appendChild(o2);
  });
}

// carregar categorias (reusa tabela categorias)
async function loadCategorias(){
  const {data} = await supabase.from("categorias").select("*").order("nome");
  state.categories = data || [];
  selectCategoriaLancCartao.innerHTML = '';
  (state.categories||[]).forEach(cat=>{
    const opt = document.createElement("option");
    opt.value = cat.id; opt.textContent = cat.nome;
    selectCategoriaLancCartao.appendChild(opt);
  });
}

// selects para lançamento (contas também para pagamento)
async function loadSelectsForLanc(){
  await loadCategorias();
  // contas para pagamento - também usadas para fechar fatura
  const {data:contas} = await supabase.from("contas_bancarias").select("*").eq("user_id", state.user.id);
  selectContaPagamento.innerHTML = '';
  contas.forEach(c=>{
    const opt = document.createElement("option"); opt.value=c.id; opt.textContent = c.nome + " ("+formatReal(c.saldo_atual||c.saldo_inicial)+")";
    selectContaPagamento.appendChild(opt);
  });
}

// adicionar compra (parcelada)
btnAddPurchase.onclick = async ()=>{
  const cartao_id = selectCartaoLanc.value;
  const descricao = (cartDesc.value || "").trim();
  const valor = Number(cartValor.value||0);
  const dataCompra = cartData.value;
  const parcelas = Number(cartParcelas.value||1);
  const categoria_id = selectCategoriaLancCartao.value || null;

  if(!cartao_id) return alert("Selecione o cartão");
  if(!descricao||!valor||!dataCompra) return alert("Preencha descrição, valor e data.");

  // se parcelas > 1, gera parcelas com mesma data (apenas registra compras, parcela_atual usado)
  // Aqui nós registramos cada parcela como um lançamento próprio com parcela_atual incremental
  // data_compra da parcela será a mesma data original para rastreio; se quiser ajustar data por mês,
  // podemos iterar e alterar a data — porém normalmente parcela de cartão aparece na fatura, não muda data_compra.
  for(let p=1;p<=parcelas;p++){
    await supabase.from("cartao_lancamentos").insert([{
      user_id: state.user.id,
      cartao_id,
      descricao: `${descricao} (${p}/${parcelas})`,
      valor: (valor / parcelas).toFixed(2),
      data_compra: dataCompra,
      parcelas,
      parcela_atual: p
    }]);
  }

  cartDesc.value=''; cartValor.value=''; cartData.value=''; cartParcelas.value=1;
  alert("Compra adicionada com sucesso.");
  await loadCards();
  if(viewLancamento.classList.contains("hidden")===false) showView(viewLancamento);
};

// Cancelar compra
btnCancelPurchase.onclick = ()=>{ cartDesc.value=''; cartValor.value=''; cartData.value=''; cartParcelas.value=1; };

// Faturas: popula select de meses (ultimos 12 meses)
function populateMonthsSelect(){
  selectMesFaturas.innerHTML='';
  const now = new Date();
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const opt = document.createElement("option");
    opt.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opt.textContent = `${d.toLocaleString('pt-BR', { month:'long' })} ${d.getFullYear()}`;
    selectMesFaturas.appendChild(opt);
  }
}

// carregar fatura selecionada (cards + mês)
async function loadFaturaForSelected(){
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value; // YYYY-MM
  if(!cartao_id || !mesAno) return;

  const [ano,mes] = mesAno.split('-').map(x=>Number(x));

  // periodo: primeiro dia até ultimo dia
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;

  // buscar compras não faturadas ou faturadas para essa fatura
  const {data:compras} = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .order("data_compra");

  // calcular total
  let total = 0;
  (compras||[]).forEach(c => total += Number(c.valor || 0));

  // render summary
  const card = state.cards.find(x=>x.id===cartao_id);
  faturaSummary.innerHTML = `
    <div class="big">${card?.nome || 'Cartão'}</div>
    <div>Período: ${mesAno}</div>
    <div class="big">Total: ${formatReal(total)}</div>
  `;

  // lista compras
  listaComprasFatura.innerHTML = '';
  (compras||[]).forEach(c=>{
    const li = document.createElement("li");
    li.innerHTML = `<strong>${formatDateShort(c.data_compra)}</strong> — ${c.descricao} — ${formatReal(c.valor)}`;
    listaComprasFatura.appendChild(li);
  });

  // preencher data de vencimento padrão com mes/ano + dia do cartão
  if(card){
    const vencDay = card.dia_vencimento || 25;
    const vencDate = new Date(ano, mes-1, vencDay);
    dataVencimentoFatura.value = formatDateISOForInput(vencDate);
  }
}

// util
function formatDateShort(d){
  const dt = new Date(d+"T00:00:00");
  return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear();
}
function formatDateISOForInput(dateObj){
  return dateObj.toISOString().slice(0,10);
}

// carregar selects e faturas
async function loadFaturasSelect(){
  await loadCards();
  populateMonthsSelect();
  await loadCategorias();
  await loadSelectsForLanc();
  // default selects set inside loadCards/populateCardSelects
  if(selectCartaoFaturas.options.length>0){
    selectCartaoFaturas.selectedIndex = 0;
    selectMesFaturas.selectedIndex = 0;
    loadFaturaForSelected();
    showView(viewFaturas);
  } else {
    showView(viewNewCard);
  }
}

// atualizar faturas (botão)
btnRefreshFaturas.onclick = ()=>loadFaturaForSelected();

// fechar fatura: criar registro em cartao_faturas, marcar lançamentos como billed=true e fatura_id
btnFecharFatura.onclick = async ()=>{
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  if(!cartao_id||!mesAno) return alert("Selecione cartão e mês.");
  const [ano,mes] = mesAno.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(last).padStart(2,'0')}`;

  // buscar compras não faturadas (billed false or null)
  const {data:compras} = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .is("billed", false);

  let total = 0;
  (compras||[]).forEach(c=> total += Number(c.valor||0));

  if(compras.length===0) return alert("Não há compras abertas para esse período.");

  // inserir fatura
  const {data: fdata} = await supabase.from("cartao_faturas").insert([{
    cartao_id, user_id: state.user.id, mes, ano, valor_total: total, status:'fechada'
  }]).select().single();

  const fatura_id = fdata.id;

  // atualizar lançamentos com fatura_id e billed true
  await supabase.from("cartao_lancamentos").update({fatura_id, billed:true}).eq("cartao_id",cartao_id)
    .gte("data_compra", inicio).lte("data_compra", fim).is("billed", false);

  alert("Fatura fechada com sucesso. Valor: " + formatReal(total));
  await loadFaturasSelect();
};

// pagar fatura: cria despesa no app principal (tabela 'despesas') usando conta selecionada
btnPagarFatura.onclick = async ()=>{
  const cartao_id = selectCartaoFaturas.value;
  const mesAno = selectMesFaturas.value;
  const conta_id = selectContaPagamento.value;
  const data_venc = dataVencimentoFatura.value;
  if(!cartao_id||!mesAno||!conta_id||!data_venc) return alert("Selecione cartão, mês, conta e data de vencimento.");

  const [ano,mes] = mesAno.split('-').map(Number);
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const last = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(last).padStart(2,'0')}`;

  const {data: f} = await supabase.from("cartao_faturas")
    .select("*").eq("cartao_id", cartao_id).eq("mes",mes).eq("ano",ano).maybeSingle();

  if(!f) return alert("Nenhuma fatura fechada para esse período. Feche a fatura antes de pagar.");

  // calcular total novamente por segurança
  const {data:compras} = await supabase.from("cartao_lancamentos")
    .select("*")
    .eq("cartao_id", cartao_id)
    .gte("data_compra", inicio)
    .lte("data_compra", fim)
    .eq("fatura_id", f.id);

  let total = 0; (compras||[]).forEach(c=> total += Number(c.valor||0));

  // criar despesa no app principal (tabela 'despesas')
  const descricao = `Fatura - ${ (state.cards.find(x=>x.id===cartao_id)||{}).nome || 'Cartão' } ${mesAno}`;
  await supabase.from("despesas").insert([{
    descricao,
    valor: total,
    data: data_venc,
    conta_id,
    user_id: state.user.id,
    baixado: false
  }]);

  // marcar fatura como paga? aqui só cria despesa; se quiser marcar fatura.pago=true basta atualizar
  await supabase.from("cartao_faturas").update({pago:true}).eq("id", f.id);

  alert("Despesa criada nas Despesas. Vá ao app principal para processar o pagamento da despesa na conta.");
  await loadFaturasSelect();
};

// histórico de faturas
async function loadHistoricoFaturas(){
  const {data} = await supabase.from("cartao_faturas").select("*,cartoes_credito(nome)").eq("user_id", state.user.id).order("created_at",{ascending:false});
  listaFaturasHistorico.innerHTML='';
  (data||[]).forEach(f=>{
    const li = document.createElement("li");
    li.innerHTML = `<strong>${f.cartoes_credito?.nome||'Cart'}</strong> • ${f.mes}/${f.ano} — ${formatReal(f.valor_total||0)} — ${f.status||'aberta'}`;
    listaFaturasHistorico.appendChild(li);
  });
  showView(viewHistorico);
}

// inicial
await loadCards();
await loadCategorias();
populateMonthsSelect();
showView(viewFaturas);

})(); // IIFE end
