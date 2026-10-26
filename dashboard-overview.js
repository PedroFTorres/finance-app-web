/* Presentation of the existing dashboard result. No queries, writes or total calculations. */
(function (root) {
  'use strict';
  const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  function agenda(dados = {}, {today = '', categoryName = () => '', limit = 5} = {}) {
    const groups = [
      ['receita', dados.pendentesReceita], ['despesa', dados.pendentesDespesa],
      ['cartao', dados.previsoesCartao], ['cartao', dados.cartoesTransportados]
    ];
    const seen = new Set(), items = [];
    for (const [type, rows] of groups) for (const item of rows || []) {
      if (item.baixado === true || item.pago === true || Number(item.valor) <= 0 || !Number.isFinite(Number(item.valor))) continue;
      const date = String(item.data || item.data_fatura || '').slice(0,10);
      const reference = type === 'cartao' || item.provisorio_cartao === true;
      const kind = reference ? 'cartao' : type;
      const key = item.id ? `${kind}:${item.id}` : item;
      if (seen.has(key)) continue;
      seen.add(key);
      const validDate = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date);
      const month = validDate ? months[Number(date.slice(5,7))-1] : '—';
      const overdue = !reference && validDate && Boolean(today) && date < today;
      items.push({key, type:kind, date:validDate ? date : '', reference, overdue,
        day:reference ? month : validDate ? date.slice(8,10) : '—', month:reference ? 'FATURA' : month,
        title:String(item.descricao || item.nome || (reference ? 'Fatura aberta' : 'Sem descrição')),
        category:reference ? 'Cartão de crédito' : String(item.categoria_nome || categoryName(item.categoria_id) || 'Sem categoria'),
        status:reference ? 'Fatura aberta' : overdue ? 'Vencido' : type === 'receita' ? 'A receber' : 'A pagar',
        value:Number(item.valor),
        dateLabel:reference ? `Mês de referência: ${date.slice(5,7)}/${date.slice(0,4)}` : validDate ? `Vencimento: ${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}` : 'Data não informada'
      });
    }
    items.sort((a,b)=>(a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title,'pt-BR'));
    return {items:items.slice(0,limit), count:items.length};
  }
  function render(dados, options = {}) {
    const document = root.document;
    const list = document?.getElementById('dashboard-agenda-list');
    if (!list) return;
    const result = agenda(dados,options);
    const text = (tag, value, className) => {const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
    list.replaceChildren();
    result.items.forEach(item=>{
      const row=document.createElement('li');row.className=`overview-agenda-row overview-${item.type}`;
      const date=text('span','', 'overview-date');date.setAttribute('aria-label',item.dateLabel);
      date.append(text('strong',item.day),text('small',item.month));
      const info=text('div','','overview-agenda-info');
      const meta=text('div','','overview-agenda-meta');
      meta.append(text('span',item.category),text('span',item.status,`overview-status${item.overdue?' is-overdue':''}`));
      info.append(text('strong',item.title),meta);
      const value=text('strong',item.value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),'overview-agenda-value');
      row.append(date,info,value);list.appendChild(row);
    });
    if (!result.count) {
      const empty=text('li','','overview-agenda-empty');
      empty.append(text('strong','Nenhuma pendência neste período.'),text('span','Os lançamentos pagos e recebidos continuam disponíveis na sua agenda.'));
      list.appendChild(empty);
    }
    document.getElementById('dashboard-agenda-count').textContent=result.count ? `Mostrando ${result.items.length} de ${result.count} compromisso${result.count===1?'':'s'} pendente${result.count===1?'':'s'}.` : 'Período sem compromissos pendentes cadastrados.';
    const button=document.getElementById('dashboard-agenda-all');
    button.onclick=()=>options.onOpen?.();
  }
  const api={agenda,render};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.ArolixOverview=api;
})(typeof window !== 'undefined' ? window : globalThis);
