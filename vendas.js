/* Marketing examples only. No authentication, payments, tracking or database access. */
(() => {
  const examples = {
    lancamentos: {kicker:'SUA AGENDA FINANCEIRA',title:'Tudo o que falta resolver.',subtitle:'Pendências, em uma leitura simples.',caption:'Encontre seus lançamentos, acompanhe pendências e registre pagamentos com seus comprovantes.',rows:[['Aluguel','Moradia · A pagar','R$ 1.200,00'],['Salário','Receita · A receber','R$ 4.200,00'],['Internet','Serviços · Pago','R$ 99,90']]},
    cartoes: {kicker:'UMA FATURA MAIS CLARA',title:'Cada compra, no seu lugar.',subtitle:'Descrição, categoria e parcela à vista.',caption:'Escolha seu cartão e abra a fatura. Busque compras, filtre por categoria e acompanhe suas parcelas.',rows:[['Academia','Saúde · À vista','R$ 240,00'],['Notebook','Eletrônicos · Parcela 3/10','R$ 480,00'],['Mercado','Alimentação · À vista','R$ 100,00']]},
    balanco: {kicker:'ENTENDA O SEU PERÍODO',title:'Olhe além do saldo.',subtitle:'Despesas do dia a dia e do cartão, por categoria.',caption:'Escolha um mês, ano ou período personalizado. Veja o que foi recebido e pago e o que ainda falta receber e pagar.',rows:[['Moradia','Pago no período','R$ 1.200,00'],['Alimentação','Pago + previsto a pagar','R$ 650,00'],['Saúde','Lançamentos + cartão','R$ 272,00']]}
  };
  const tabs = Array.from(document.querySelectorAll('[data-preview]'));
  function select(tab) {
    const example = examples[tab.dataset.preview];
    tabs.forEach(button=>{const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    for(const key of ['kicker','title','subtitle','caption'])document.getElementById(`preview-${key}`).textContent=example[key];
    const rows = document.getElementById('preview-rows');rows.replaceChildren();
    example.rows.forEach(([name,detail,value],i)=>{
      const row=document.createElement('div');row.className='preview-line';
      const dot=document.createElement('span');dot.className='preview-dot'+(i===1?' green-dot':'');dot.setAttribute('aria-hidden','true');
      const info=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),amount=document.createElement('b');
      title.textContent=name;meta.textContent=detail;amount.textContent=value;info.append(title,meta);row.append(dot,info,amount);rows.appendChild(row);
    });
    document.getElementById('preview-panel').setAttribute('aria-labelledby',tab.id);
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();select(tabs[next]);tabs[next].focus();}
    });
  });
})();
