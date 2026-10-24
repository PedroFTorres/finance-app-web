/* Pure presentation: does not query or mutate financial data. */
(() => {
  const wallet = document.getElementById('card-wallet');
  const invoice = document.getElementById('card-invoice');
  const workspace = document.getElementById('invoice-workspace');
  const list = document.getElementById('lista-fatura');
  if (!wallet || !invoice || !list) return;
  const cards = document.getElementById('cards-list');
  const search = document.getElementById('invoice-search');
  const category = document.getElementById('invoice-category');
  const more = document.getElementById('invoice-load-more');
  const back = document.getElementById('invoice-back');
  const count = document.getElementById('invoice-list-count');
  const pageSize = 20;
  let limit = pageSize, lastKey = '', returnCard = null, walletScroll = 0, cardScroll = 0;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function filter() {
    const rows = Array.from(list.querySelectorAll('.fatura-row'));
    const query = normalize(search.value.trim());
    let matches = 0;
    rows.forEach(row => {
      const match = (!query || normalize(row.dataset.search || row.textContent).includes(query)) && (!category.value || row.dataset.category === category.value);
      const visible = match && ++matches <= limit;
      row.classList.toggle('invoice-row-hidden', !visible);
      row.classList.toggle('invoice-row-alternate', visible && matches % 2 === 0);
    });
    const shown = Math.min(limit, matches);
    count.textContent = `${shown} de ${matches} movimentações${matches !== rows.length ? ` · ${rows.length} na fatura` : ''}`;
    more.classList.toggle('hidden', shown >= matches);
    more.textContent = `Carregar mais (${Math.max(0,matches - shown)} restantes)`;
    document.getElementById('invoice-no-results').classList.toggle('hidden', matches > 0 || rows.length === 0);
  }
  function busy(value) {
    workspace.inert = value;
    invoice.setAttribute('aria-busy', String(value));
    document.getElementById('invoice-loading').classList.toggle('hidden', !value);
    document.getElementById('invoice-loading').textContent = 'Carregando fatura…';
    workspace.classList.toggle('hidden', value);
  }
  function open(cardId) {
    returnCard = cardId;
    walletScroll = window.scrollY;
    cardScroll = cards.scrollLeft;
    wallet.classList.add('hidden'); invoice.classList.remove('hidden');
    if (location.hash !== '#fatura') history.pushState({arolixInvoice:true},'', '#fatura');
    window.scrollTo({top:0,behavior:'instant'}); back.focus({preventScroll:true});
  }
  function close() {
    invoice.classList.add('hidden'); wallet.classList.remove('hidden');
    cards.scrollLeft = cardScroll;
    if (location.hash === '#fatura') history.replaceState(null,'',location.pathname + location.search);
    window.scrollTo({top:walletScroll,behavior:'instant'});
    Array.from(cards.querySelectorAll('[data-card-id]')).find(card=>card.dataset.cardId===returnCard)?.focus({preventScroll:true});
  }
  back.addEventListener('click',()=>{if(history.state?.arolixInvoice)history.back();else close();});
  window.addEventListener('popstate',()=>{
    if(location.hash==='#fatura' && returnCard){wallet.classList.add('hidden');invoice.classList.remove('hidden');window.scrollTo({top:0,behavior:'instant'});}
    else close();
  });
  // A reload starts at the wallet instead of exposing an invoice before selection.
  if(location.hash==='#fatura') history.replaceState(null,'',location.pathname + location.search);
  search.addEventListener('input',()=>{limit=pageSize;filter();});
  category.addEventListener('change',()=>{limit=pageSize;filter();});
  more.addEventListener('click',()=>{limit+=pageSize;filter();});
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  for(const [id,direction] of [['wallet-prev',-1],['wallet-next',1]]) document.getElementById(id).addEventListener('click',()=>cards.scrollBy({left:direction * cards.clientWidth * .8,behavior:motion()}));
  function arrows() {
    document.getElementById('wallet-prev').disabled = cards.scrollLeft <= 2;
    document.getElementById('wallet-next').disabled = cards.scrollLeft + cards.clientWidth >= cards.scrollWidth - 2;
  }
  cards.addEventListener('scroll',arrows,{passive:true});
  new ResizeObserver(arrows).observe(cards);
  new MutationObserver(arrows).observe(cards,{childList:true});
  window.ArolixCardWorkspace = {
    open, busy,
    failed() {
      workspace.inert = true;workspace.classList.add('hidden');invoice.setAttribute('aria-busy','false');
      const message = document.getElementById('invoice-loading');message.textContent='Não foi possível carregar esta fatura. Volte aos cartões e tente novamente.';message.classList.remove('hidden');
    },
    loaded({key,categories}) {
      if (lastKey !== key) {search.value='';category.value='';limit=pageSize;lastKey=key;}
      const selected = category.value;
      category.replaceChildren(new Option('Todas as categorias',''));
      for(const item of categories) category.appendChild(new Option(item.name,item.id));
      category.value = Array.from(category.options).some(option=>option.value===selected) ? selected : '';
      filter(); busy(false);
    }
  };
})();
