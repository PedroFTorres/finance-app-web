(() => {
  'use strict';

  /* =====================
     CONFIG & ESTADO
     ===================== */
  const STATE = {
    user: null,
    contas: [],
    categorias: [],
    receitas: [],
    despesas: [],
    movimentacoes: [],
    charts: {},
  };

  // IDs esperados no HTML (ver app.html). Certifique-se de que existem.
  const IDS = {
    userEmail: 'user-email',
    btnLogout: 'btn-logout',
    selectContas: 'select-contas',
    periodoLanc: 'periodo-lanc',
    dataInicioLanc: 'data-inicio-lanc',
    dataFimLanc: 'data-fim-lanc',
    btnFiltrarLanc: 'btn-filtrar-lanc',
    listReceitas: 'list-receitas',
    listDespesas: 'list-despesas',
    totalReceitas: 'total-receitas',
    totalDespesas: 'total-despesas',
    saldoAtual: 'saldo-atual',
    // extrato
    selectExtrato: 'select-contas-extrato',
    periodoExtrato: 'periodo-extrato',
    dataInicio: 'data-inicio',
    dataFim: 'data-fim',
    btnFiltrarExtrato: 'btn-filtrar-extrato',
    tableExtratoBody: 'table-extrato',
    // contas
    btnAddConta: 'btn-add-conta',
    contaNome: 'conta-nome',
    contaSaldo: 'conta-saldo',
    contaDataSaldo: 'conta-data-saldo'
  };

  /* =====================
     HELPERS
     ===================== */
  const $ = (id) => document.getElementById(id);

  function formatReal(v){
    return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  function formatDateISO(d){
    if(!d) return '';
    return new Date(d+'T00:00:00').toISOString().slice(0,10);
  }

  function formatDatePtBR(d){
    if(!d) return '';
    const x = new Date(d+'T00:00:00');
    return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`;
  }

  function uuid(){ return crypto.randomUUID(); }

  function showToast(msg, type='info'){
    // simples: console + alert fallback
    console.log('[TOAST]', type, msg);
    // se existir container de toasts no DOM, usar; caso contrário, não poluir UI
    const c = document.getElementById('toast-container');
    if(c){
      const t = document.createElement('div');
      t.className = 'toast ' + (type||'');
      t.textContent = msg;
      c.appendChild(t);
      setTimeout(()=>t.remove(),3500);
    }
  }

  /* =====================
     AUTH SERVICE
     ===================== */
  const Auth = {
    async ensureSession(){
      try{
        const s = await supabase.auth.getSession();
        if(!s?.data?.session) return false;
        STATE.user = s.data.session.user;
        return true;
      }catch(e){ console.error('Auth.ensureSession', e); return false; }
    }
  };

  /* =====================
     CONTAS SERVICE
     ===================== */
  const ContasService = {
    async load(){
      const userId = STATE.user?.id;
      if(!userId) return [];
      const { data, error } = await supabase.from('contas_bancarias').select('*').eq('user_id', userId).order('nome');
      if(error){ console.error('loadContas', error); return []; }
      STATE.contas = data || [];
      return STATE.contas;
    },

    async add({ nome, saldo, data_saldo }){
      const item = { id: uuid(), nome, saldo_inicial: Number(saldo||0), saldo_atual: Number(saldo||0), data_saldo, user_id: STATE.user.id };
      const { error } = await supabase.from('contas_bancarias').insert([item]);
      if(error) throw error;
      await this.load();
      return item;
    },

    async recalc(conta_id){
      // não recalcula se conta 'all'
      if(!conta_id || conta_id === 'all') return null;
      const { data: conta } = await supabase.from('contas_bancarias').select('saldo_inicial').eq('id', conta_id).maybeSingle();
      const si = Number(conta?.saldo_inicial||0);
      const { data: movs } = await supabase.from('movimentacoes').select('tipo,valor').eq('conta_id', conta_id);
      let cred=0, deb=0;
      (movs||[]).forEach(m=>{ if(m.tipo==='credito') cred+=Number(m.valor||0); else deb+=Number(m.valor||0); });
      const saldo = si + cred - deb;
      await supabase.from('contas_bancarias').update({ saldo_atual: saldo }).eq('id', conta_id);
      // atualizar cache local
      const idx = STATE.contas.findIndex(c=>c.id===conta_id);
      if(idx>=0) STATE.contas[idx].saldo_atual = saldo;
      return saldo;
    }
  };

  /* =====================
     CATEGORIAS SERVICE
     ===================== */
  const CategoriaService = {
    async load(){
      const { data } = await supabase.from('categorias').select('*').order('nome');
      STATE.categorias = data||[]; return STATE.categorias;
    },
    async getOrCreate(nome){
      const r = await supabase.from('categorias').select('*').eq('nome', nome).maybeSingle();
      if(r?.data) return r.data.id;
      const created = await supabase.from('categorias').insert([{ id: uuid(), nome }]).select().maybeSingle();
      return created?.data?.id || created?.id || null;
    }
  };

  /* =====================
     LANCAMENTOS SERVICE (receitas/despesas)
     ===================== */
  const LancService = {
    async fetch({ tipo, conta_id='all', inicio, fim }){
      // tipo: 'receitas' | 'despesas'
      const tabla = tipo === 'receita' ? 'receitas' : 'despesas';

      // sempre garantir que conta_id válido; se 'all' => não filtrar conta
      let q = supabase.from(tabla).select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim).order('data', { ascending: true });
      if(conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
      const { data, error } = await q;
      if(error){ console.error('LancService.fetch', tipo, error); return []; }
      return data || [];
    },

    async insert({ tipo, descricao, valor, data, conta_id, categoria_id }){
      const tabla = tipo === 'receita' ? 'receitas' : 'despesas';
      const item = { id: uuid(), descricao, valor: Number(valor), data, conta_id: conta_id || null, categoria_id: categoria_id || null, user_id: STATE.user.id, baixado: false };
      const { error } = await supabase.from(tabla).insert([item]);
      if(error) throw error;
      return item;
    },

    async delete({ tipo, id }){
      const tabla = tipo === 'receita' ? 'receitas' : 'despesas';
      await supabase.from(tabla).delete().eq('id', id);
    }
  };

  /* =====================
     EXTRATO SERVICE
     ===================== */
  const ExtratoService = {
    async fetchMovs({ conta_id='all', inicio, fim }){
      let q = supabase.from('movimentacoes').select('*').gte('data', inicio).lte('data', fim).order('data');
      if(conta_id && conta_id !== 'all') q = q.eq('conta_id', conta_id);
      const { data } = await q;
      return data || [];
    }
  };

  /* =====================
     UI/DOM BINDINGS
     ===================== */
  const UI = {
    init(){
      // colocar listeners básicos
      const btnLogout = $(IDS.btnLogout);
      if(btnLogout) btnLogout.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'login.html'; };

      // filtragem lançamentos
      const btnFiltrar = $(IDS.btnFiltrarLanc);
      const selContas = $(IDS.selectContas);
      const periodo = $(IDS.periodoLanc);

      if(periodo) periodo.onchange = () => {
        if(periodo.value === 'personalizado'){ $(IDS.dataInicioLanc).classList.remove('hidden'); $(IDS.dataFimLanc).classList.remove('hidden'); }
        else { $(IDS.dataInicioLanc).classList.add('hidden'); $(IDS.dataFimLanc).classList.add('hidden'); }
      };

      if(selContas){
        selContas.addEventListener('change', async ()=>{ await App.refreshLancamentos(); });
      }

      if(btnFiltrar) btnFiltrar.onclick = async (ev)=>{ ev?.preventDefault(); await App.refreshLancamentos(); };

      // extrato filtro
      const btnFilExtr = $(IDS.btnFiltrarExtrato);
      if(btnFilExtr) btnFilExtr.onclick = async ()=>{ await App.renderExtrato(); };

      // adicionar conta
      const btnAddConta = $(IDS.btnAddConta);
      if(btnAddConta) btnAddConta.onclick = async ()=>{
        const nome = $(IDS.contaNome).value.trim();
        const saldo = Number($(IDS.contaSaldo).value || 0);
        const data_saldo = $(IDS.contaDataSaldo).value;
        if(!nome || !data_saldo) return alert('Informe nome e data do saldo.');
        await ContasService.add({ nome, saldo, data_saldo });
        await App.populateContasSelects();
        showToast('Conta criada');
      };

      // montar listeners de tabs/menu — já existente em app.html
      document.querySelectorAll('.menu-btn').forEach(b=>{
        b.onclick = (ev)=>{
          const id = b.getAttribute('data-target');
          if(id) App.showScreen(id);
        };
      });

    },

    async populateContasSelects(){
      // popula select-contas (lançamentos) e select-contas-extrato e select-conta-lanc (se existir)
      const sel = $(IDS.selectContas);
      const selExtr = $(IDS.selectExtrato);
      const selContaLanc = document.getElementById('select-conta-lanc');
      [sel, selExtr, selContaLanc].forEach(s=>{ if(s) s.innerHTML=''; });

      // adicionar opção Todas as Contas
      const addOpt = (s) => s && s.appendChild(new Option('Todas as Contas','all'));
      addOpt(sel); addOpt(selExtr); addOpt(selContaLanc);

      (STATE.contas||[]).forEach(c=>{
        if(sel) sel.appendChild(new Option(`${c.nome} (${formatReal(c.saldo_atual ?? c.saldo_inicial)})`, c.id));
        if(selExtr) selExtr.appendChild(new Option(c.nome, c.id));
        if(selContaLanc) selContaLanc.appendChild(new Option(c.nome, c.id));
      });

      // garantir valor seguro
      if(sel && (!sel.value || sel.value.trim()==='')) sel.value = 'all';
      if(selExtr && (!selExtr.value || selExtr.value.trim()==='')) selExtr.value = 'all';
      if(selContaLanc && (!selContaLanc.value || selContaLanc.value.trim()==='')) selContaLanc.value = 'all';
    },

    renderLancamentos({ receitas, despesas }){
      const listR = $(IDS.listReceitas); const listD = $(IDS.listDespesas);
      if(listR) listR.innerHTML = '';
      if(listD) listD.innerHTML = '';

      let tr = 0, td = 0;
      (receitas||[]).forEach(r=>{ tr += Number(r.valor||0); if(listR) listR.appendChild(this._buildLancItem(r,'receita')); });
      (despesas||[]).forEach(d=>{ td += Number(d.valor||0); if(listD) listD.appendChild(this._buildLancItem(d,'despesa')); });

      if($(IDS.totalReceitas)) $(IDS.totalReceitas).textContent = formatReal(tr);
      if($(IDS.totalDespesas)) $(IDS.totalDespesas).textContent = formatReal(td);
    },

    _buildLancItem(item, tipo){
      const li = document.createElement('li');
      li.style.display = 'flex'; li.style.justifyContent='space-between';
      const left = document.createElement('div'); left.textContent = `${formatDatePtBR(item.data)} — ${item.descricao} — ${formatReal(item.valor)}`;
      if(item.baixado) left.textContent += ' — (BAIXADO)';
      const right = document.createElement('div');

      const btnE = document.createElement('button'); btnE.textContent='Editar'; btnE.onclick = ()=>{ startEdit(tipo, item); };
      const btnX = document.createElement('button'); btnX.textContent='Excluir'; btnX.onclick = async ()=>{ if(confirm('Excluir?')){ await LancService.delete({ tipo: tipo==='receita'?'receita':'despesa', id: item.id }); await App.refreshLancamentos(); } };
      right.appendChild(btnE); right.appendChild(btnX);

      if(!item.baixado){ const btnB=document.createElement('button'); btnB.textContent='Baixar'; btnB.onclick = ()=> baixarLancamento({ tipo, item }); right.appendChild(btnB); }

      li.appendChild(left); li.appendChild(right); return li;
    }
  };

  /* =====================
     APP (coordena tudo)
     ===================== */
  const App = {
    async init(){
      // garantir sessão
      const ok = await Auth.ensureSession();
      if(!ok) return window.location.href = 'login.html';

      // inicializar UI
      UI.init();

      // setar email
      const e = $(IDS.userEmail); if(e) e.textContent = STATE.user.email;

      // carregar dados essenciais
      await Promise.all([CategoriaService.load(), ContasService.load()]);
      await UI.populateContasSelects();

      // inscrever realtime
      this.subscribeRealtime();

      // render inicial
      this.showScreen('dashboard');
      // carregar dashboard async (não bloquear UI)
      this.loadDashboard();

      // refresh lançamentos padrão
      await this.refreshLancamentos();
    },

    async loadDashboard(){
      try{
        const now = new Date();
        const ano = now.getFullYear(); const mes = now.getMonth()+1;
        const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
        const last = new Date(ano, mes, 0).getDate();
        const fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;

        const rec = await supabase.from('receitas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);
        const des = await supabase.from('despesas').select('*').eq('user_id', STATE.user.id).gte('data', inicio).lte('data', fim);

        // calcular totais e, se desejar, renderizar gráficos (Chart.js) — mantemos minimal
        const totalR = (rec.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);
        const totalD = (des.data||[]).reduce((s,x)=>s+Number(x.valor||0),0);
        // atualizar elementos (se existirem)
        const elDashReceber = document.getElementById('dash-receber'); if(elDashReceber) elDashReceber.textContent = formatReal(totalR);
        const elDashPagar = document.getElementById('dash-pagar'); if(elDashPagar) elDashPagar.textContent = formatReal(totalD);

      }catch(e){ console.error('loadDashboard', e); }
    },

    showScreen(screen){
      // s: 'dashboard' | 'contas' | 'lanc'
      const telaDashboard = document.getElementById('tela-dashboard');
      const telaContas = document.getElementById('tela-contas');
      const telaLanc = document.getElementById('tela-lancamentos');
      [telaDashboard, telaContas, telaLanc].forEach(t=> t && t.classList.add('hidden'));
      if(screen === 'dashboard' && telaDashboard) telaDashboard.classList.remove('hidden');
      if(screen === 'contas' && telaContas) telaContas.classList.remove('hidden');
      if(screen === 'lanc' && telaLanc) {
        // garantir select-contas já tem valor
        const sel = $(IDS.selectContas);
        if(sel && (!sel.value || sel.value.trim()==='')) sel.value = 'all';
        telaLanc.classList.remove('hidden');
      }
    },

    async refreshLancamentos(){
      try{
        const sel = $(IDS.selectContas); const conta_id = sel ? sel.value || 'all' : 'all';

        // período
        const periodo = $(IDS.periodoLanc); const now = new Date();
        let inicio, fim;
        const p = periodo ? periodo.value : 'mes_atual';
        if(p === 'mes_atual'){
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if(p === 'mes_anterior'){
          const ano = now.getFullYear(); const mes = now.getMonth();
          inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const last = new Date(ano, mes, 0).getDate();
          fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
        } else if(p === 'ultimos_30'){
          const past = new Date(now.getTime() - 30*86400000);
          inicio = past.toISOString().slice(0,10); fim = now.toISOString().slice(0,10);
        } else {
          inicio = $(IDS.dataInicioLanc) ? $(IDS.dataInicioLanc).value : '';
          fim = $(IDS.dataFimLanc) ? $(IDS.dataFimLanc).value : '';
        }

        // garantir variáveis
        if(!inicio || !fim) { console.warn('Periodo inválido para refreshLancamentos', inicio, fim); }

        const [receitas, despesas] = await Promise.all([
          LancService.fetch({ tipo: 'receita', conta_id, inicio, fim }),
          LancService.fetch({ tipo: 'despesa', conta_id, inicio, fim })
        ]);

        STATE.receitas = receitas; STATE.despesas = despesas;
        UI.renderLancamentos({ receitas, despesas });

        // atualizar saldo da conta selecionada (se não all)
        const salEl = $(IDS.saldoAtual);
        if(conta_id && conta_id !== 'all'){
          const { data } = await supabase.from('contas_bancarias').select('saldo_atual').eq('id', conta_id).maybeSingle();
          if(salEl) salEl.textContent = formatReal(data?.saldo_atual || 0);
          await ContasService.recalc(conta_id);
        }else{ if(salEl) salEl.textContent = '—'; }

      }catch(e){ console.error('refreshLancamentos', e); }
    },

    async renderExtrato(){
      try{
        const sel = $(IDS.selectExtrato); const conta_id = sel ? sel.value || 'all' : 'all';
        const periodo = $(IDS.periodoExtrato); const now = new Date();
        let inicio, fim;
        const p = periodo ? periodo.value : 'mes_atual';
        if(p === 'mes_atual'){
          inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
          const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
          fim = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${last}`;
        } else if(p === 'mes_anterior'){
          const ano = now.getFullYear(); const mes = now.getMonth();
          inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
          const last = new Date(ano, mes, 0).getDate();
          fim = `${ano}-${String(mes).padStart(2,'0')}-${last}`;
        } else if(p === 'ultimos_30'){
          const past = new Date(now.getTime() - 30*86400000);
          inicio = past.toISOString().slice(0,10); fim = now.toISOString().slice(0,10);
        } else {
          inicio = $(IDS.dataInicio) ? $(IDS.dataInicio).value : '';
          fim = $(IDS.dataFim) ? $(IDS.dataFim).value : '';
        }

        // buscar movimentações
        const movs = await ExtratoService.fetchMovs({ conta_id, inicio, fim });

        // montar linhas (tbody) — tabela no app.html, tbody do table-extrato
        const table = $(IDS.tableExtratoBody);
        if(!table) return console.warn('Tabela extrato não encontrada');
        const tbody = table.querySelector('tbody'); if(!tbody) return;
        tbody.innerHTML = '';

        // se conta específica, mostrar saldo inicial
        let conta = null;
        if(conta_id && conta_id !== 'all'){
          const res = await supabase.from('contas_bancarias').select('saldo_inicial,data_saldo,saldo_atual').eq('id', conta_id).maybeSingle();
          conta = res?.data || null;
        }

        const linhas = [];
        if(conta && conta.saldo_inicial && conta.data_saldo){
          linhas.push({ tipo: 'inicial', data: conta.data_saldo, descricao: 'SALDO INICIAL', valor: Number(conta.saldo_inicial) });
        }

        (movs||[]).forEach(m=> linhas.push({ tipo:'mov', data: m.data, mov: m, descricao: m.descricao, valor: Number(m.valor) }));
        linhas.sort((a,b) => new Date(a.data) - new Date(b.data));

        let cred = 0, deb = 0;
        linhas.forEach(l=>{
          const tr = document.createElement('tr');
          const tdData = document.createElement('td'); tdData.textContent = formatDatePtBR(l.data);
          const tdDesc = document.createElement('td'); tdDesc.textContent = l.descricao;
          const tdTipo = document.createElement('td'); tdTipo.textContent = l.tipo === 'inicial' ? 'Crédito' : (l.mov.tipo === 'credito' ? 'Crédito' : 'Débito');
          const tdValor = document.createElement('td'); tdValor.textContent = formatReal(l.valor);

          tr.appendChild(tdData); tr.appendChild(tdDesc); tr.appendChild(tdTipo); tr.appendChild(tdValor);

          // ações se for movimentação
          const tdAcoes = document.createElement('td');
          if(l.tipo === 'mov'){
            const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancelar Baixa'; btnCancel.onclick = ()=> cancelarBaixaMovimentacao(l.mov);
            tdAcoes.appendChild(btnCancel);
            if(l.mov.tipo === 'credito') cred += l.valor; else deb += l.valor;
          } else { cred += l.valor; }

          tr.appendChild(tdAcoes);
          tbody.appendChild(tr);
        });

        // atualizar totais UI (se existirem)
        const elTotalRec = document.getElementById('total-receitas-extrato'); if(elTotalRec) elTotalRec.textContent = formatReal(cred);
        const elTotalDes = document.getElementById('total-despesas-extrato'); if(elTotalDes) elTotalDes.textContent = formatReal(deb);
        const elSaldoPeriodo = document.getElementById('saldo-periodo-extrato'); if(elSaldoPeriodo) elSaldoPeriodo.textContent = formatReal(cred - deb);
        const elSaldoAtual = document.getElementById('saldo-atual-conta-extrato'); if(elSaldoAtual) elSaldoAtual.textContent = conta ? formatReal(conta.saldo_atual) : '—';

      }catch(e){ console.error('renderExtrato', e); }
    },

    subscribeRealtime(){
      try{
        supabase.channel('rec').on('postgres_changes',{event:'*',schema:'public',table:'receitas'},()=> this.refreshLancamentos()).subscribe();
        supabase.channel('des').on('postgres_changes',{event:'*',schema:'public',table:'despesas'},()=> this.refreshLancamentos()).subscribe();
        supabase.channel('mov').on('postgres_changes',{event:'*',schema:'public',table:'movimentacoes'},()=> this.renderExtrato()).subscribe();
        supabase.channel('cats').on('postgres_changes',{event:'*',schema:'public',table:'categorias'},()=> CategoriaService.load()).subscribe();
      }catch(e){ console.warn('Realtime not available', e); }
    }
  };

  /* =====================
     BAIXA e CANCELAR BAIXA
     ===================== */
  async function baixarLancamento({ tipo, item }){
    // abrir modal simplificado ou executar baixa imediata (ex.: usar modal no DOM)
    // aqui assumimos que existe modal-baixa no DOM com inputs esperados (app.html)
    const modal = document.getElementById('modal-baixa');
    if(!modal){
      // execução direta simplificada: marcar baixado + criar movimentação + atualizar saldo
      const contaId = document.getElementById('select-conta-lanc')?.value || null;
      if(!contaId) return alert('Selecione conta para baixar');
      const dataBaixa = new Date().toISOString().slice(0,10);
      // atualizar lançamento
      const tabela = tipo === 'receita' ? 'receitas' : 'despesas';
      await supabase.from(tabela).update({ baixado: true, data_baixa: dataBaixa, conta_id: contaId }).eq('id', item.id);

      // criar movimentacao
      await supabase.from('movimentacoes').insert([{ id: uuid(), user_id: STATE.user.id, conta_id: contaId, tipo: tipo==='receita'?'credito':'debito', valor: item.valor, descricao: item.descricao, data: dataBaixa, lancamento_id: item.id }]);

      // recalcular e atualizar UI
      await ContasService.recalc(contaId);
      await App.refreshLancamentos();
      await App.renderExtrato();
      showToast('Lançamento baixado');
      return;
    }

    // se houver modal no DOM, abrir e preencher opções
    // (implementação completa conforme app.html já disponível no projeto)
    modal.classList.remove('hidden');
  }

  async function cancelarBaixaMovimentacao(mov){
    if(!confirm('Deseja cancelar esta baixa?')) return;
    try{
      const { data: conta } = await supabase.from('contas_bancarias').select('*').eq('id', mov.conta_id).maybeSingle();
      let novoSaldo = Number(conta?.saldo_atual || 0);
      if(mov.tipo === 'credito') novoSaldo -= Number(mov.valor); else novoSaldo += Number(mov.valor);
      await supabase.from('contas_bancarias').update({ saldo_atual: novoSaldo }).eq('id', mov.conta_id);
      await supabase.from('movimentacoes').delete().eq('id', mov.id);
      await supabase.from('receitas').update({ baixado: false, data_baixa: null }).eq('id', mov.lancamento_id);
      await supabase.from('despesas').update({ baixado: false, data_baixa: null }).eq('id', mov.lancamento_id);
      await ContasService.recalc(mov.conta_id);
      await App.refreshLancamentos();
      await App.renderExtrato();
    }catch(e){ console.error('cancelarBaixa', e); }
  }

  /* =====================
     EDIT / START EDIT (aux)
     ===================== */
  let editing = { type:null, id:null };
  function startEdit(type, item){
    editing = { type, id: item.id };
    // preencher campos da UI (desc, valor, data, conta, categoria)
    document.getElementById('desc-lanc').value = item.descricao || '';
    document.getElementById('valor-lanc').value = item.valor || '';
    document.getElementById('data-lanc').value = item.data || '';
    document.getElementById('select-conta-lanc').value = item.conta_id || 'all';
    document.getElementById('categoria-lanc').value = item.categoria_id || '';
    document.getElementById('btn-add-lanc').textContent = 'Salvar';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
  }

  // cancelar edição
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  if(btnCancelEdit) btnCancelEdit.onclick = async ()=>{
    editing = { type:null, id:null };
    document.getElementById('desc-lanc').value = '';
    document.getElementById('valor-lanc').value = '';
    document.getElementById('data-lanc').value = '';
    document.getElementById('btn-add-lanc').textContent = 'Adicionar';
    btnCancelEdit.classList.add('hidden');
  };

  /* =====================
     INICIALIZAÇÃO COMPLETA
     ===================== */
  (async function bootstrap(){
    try{
      // esperar supabase client
      if(!window.supabase) throw new Error('Supabase client (supabase.js) não encontrado');

      const ok = await Auth.ensureSession();
      if(!ok) return window.location.href = 'login.html';

      // preencher usuário
      const el = document.getElementById(IDS.userEmail); if(el) el.textContent = STATE.user.email;

      // inicializar UI listeners
      UI.init();

      // carregar dados
      await CategoriaService.load();
      await ContasService.load();
      await UI.populateContasSelects();

      // finalizar init app
      await App.init?.call(App);

    }catch(e){
      console.error('bootstrap', e);
      showToast('Erro ao inicializar aplicação. Ver console.');
    }
  })();

})();
