/* Shared presentation only: no financial calculations, authentication or database writes. */
(function () {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const url = path => new URL(path, base).href;
  const module = document.body.dataset.module || 'app';
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    lanc: '<path d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01"/>',
    cartao: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
    investimentos: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    relatorios: '<path d="M4 3v17h17M9 15V9M14 15V5M19 15v-4"/>',
    contas: '<path d="m3 9 9-6 9 6H3Zm2 3v7m7-7v7m7-7v7M2 22h20"/>',
    categorias: '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7" cy="7" r="1"/>',
    capitalizacao: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M8 5V3m8 2V3m-8 12h2m4 0h2"/>',
    transferir: '<path d="M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5"/>',
    auditoria: '<path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'
  };
  const names = { dashboard: 'Visão geral', lanc: 'Lançamentos', cartao: 'Cartões', investimentos: 'Investimentos', relatorios: 'Balanço', contas: 'Contas', categorias: 'Categorias', capitalizacao: 'Capitalização', transferir: 'Transferir', auditoria: 'Auditoria', more: 'Mais' };
  function icon(name) {
    const span = document.createElement('span');
    span.className = 'shell-icon';
    span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
    return span;
  }
  function text(tag, value, className) {
    const node = document.createElement(tag); node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function decorate(node, name) {
    node.classList.add('shell-nav-item');
    node.dataset.shellPage = name;
    node.replaceChildren(icon(name), text('span', names[name], 'shell-nav-label'));
    return node;
  }
  const sidebar = document.createElement('aside');
  sidebar.className = 'arolix-sidebar';
  const brand = document.createElement('a');
  brand.className = 'shell-brand'; brand.href = url('app.html'); brand.setAttribute('aria-label', 'Arolix — visão geral');
  const logo = document.createElement('img'); logo.src = url('logo-arolix.png'); logo.alt = 'Arolix'; brand.appendChild(logo);
  sidebar.append(brand, text('span', 'SEU ESPAÇO FINANCEIRO', 'shell-nav-heading'));
  const header = document.querySelector('.top-header, .invest-header');
  if (!header) return;
  const mainNav = document.querySelector('.top-menu') || document.createElement('nav');
  mainNav.className = 'top-menu shell-primary-nav'; mainNav.setAttribute('aria-label', 'Navegação principal');
  const secondary = document.createElement('nav'); secondary.className = 'shell-secondary-nav'; secondary.id = 'shell-secondary-navigation'; secondary.setAttribute('aria-label', 'Organização e ferramentas');
  const oldItems = Array.from(mainNav.children);
  function navItem(name) {
    const original = oldItems.find(node => node.dataset.target === name || node.id === `btn-${name}`);
    if (original) return decorate(original, name);
    const anchor = document.createElement('a');
    anchor.href = name === 'cartao' ? url('cartao.html') : ['investimentos', 'capitalizacao'].includes(name) ? url(`${name}/index.html`) : url(`app.html?tela=${name}`);
    return decorate(anchor, name);
  }
  const primaryItems = ['dashboard', 'lanc', 'cartao', 'investimentos', 'relatorios'].map(navItem);
  const secondaryItems = ['contas', 'categorias', 'capitalizacao'].map(navItem);
  if (module === 'app') secondaryItems.push(...['transferir', 'auditoria'].map(navItem));
  mainNav.replaceChildren(...primaryItems);
  secondary.append(...secondaryItems);
  const more = decorate(document.createElement('button'), 'more');
  more.type = 'button'; more.lastChild.textContent = 'Mais'; more.classList.add('shell-more');
  more.setAttribute('aria-controls', secondary.id); more.setAttribute('aria-expanded', 'false');
  mainNav.appendChild(more);
  sidebar.append(mainNav, text('span', 'ORGANIZAÇÃO', 'shell-nav-heading shell-secondary-heading'), secondary);
  const footer = document.createElement('div'); footer.className = 'shell-sidebar-footer';
  footer.append(text('strong', 'Clareza para decidir.'), text('span', 'Seu dinheiro, em perspectiva.'));
  sidebar.appendChild(footer);
  document.body.prepend(sidebar);
  const backdrop = document.createElement('button'); backdrop.type = 'button'; backdrop.className = 'shell-menu-backdrop'; backdrop.setAttribute('aria-label', 'Fechar menu Mais');
  document.body.appendChild(backdrop);
  function closeMenu() { document.body.classList.remove('shell-menu-open'); more.setAttribute('aria-expanded', 'false'); }
  more.addEventListener('click', () => {
    const open = !document.body.classList.contains('shell-menu-open');
    document.body.classList.toggle('shell-menu-open', open); more.setAttribute('aria-expanded', String(open));
    if (open) secondary.querySelector('a, button')?.focus();
  });
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('shell-menu-open')) { closeMenu(); more.focus(); } });
  sidebar.addEventListener('click', event => { if (event.target.closest('[data-shell-page]:not(.shell-more)')) closeMenu(); });
  const breadcrumb = document.createElement('div'); breadcrumb.className = 'shell-breadcrumb';
  breadcrumb.append(text('span', 'Meu espaço'), text('span', '/', 'shell-breadcrumb-slash'), text('strong', ''));
  header.prepend(breadcrumb);
  const setPage = name => {
    breadcrumb.lastChild.textContent = names[name] || 'Meu espaço';
    sidebar.querySelectorAll('[data-shell-page]').forEach(node => {
      const selected = node.dataset.shellPage === name;
      node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
  };
  window.addEventListener('arolix:screen-change', event => setPage(event.detail));
  setPage(module === 'app' ? 'dashboard' : module);

  if (module === 'app') {
    const layout = document.querySelector('.lanc-layout');
    const menu = document.querySelector('.lanc-menu');
    const totals = document.querySelector('.card-totais');
    if (layout && menu && totals) {
      const tools = document.createElement('div'); tools.className = 'shell-ledger-tools';
      const label = document.createElement('label'); label.className = 'shell-ledger-search';
      const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Buscar lançamento'; input.setAttribute('aria-label', 'Buscar na lista de lançamentos');
      label.append(icon('search'), input); tools.append(menu, label);
      layout.prepend(tools); layout.appendChild(totals);
      document.querySelector('.lanc-left')?.remove();
      const help = text('p', 'A busca filtra a lista; os totais continuam sendo do período.', 'shell-search-note hidden');
      tools.after(help);
      const lists = Array.from(document.querySelectorAll('.listas ul'));
      const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const filter = () => {
        const query = normalize(input.value.trim());
        help.classList.toggle('hidden', !query);
        lists.forEach(list => Array.from(list.children).forEach(row => {
          row.classList.toggle('shell-search-hidden', Boolean(query && !normalize(row.textContent).includes(query)));
        }));
      };
      input.addEventListener('input', filter);
      const observer = new MutationObserver(filter);
      lists.forEach(list => observer.observe(list, { childList: true }));
    }
  }
  if (module === 'cartao') {
    const heading = document.createElement('div'); heading.className = 'shell-page-heading';
    heading.append(text('span', 'COMPRAS E COMPROMISSOS', 'shell-eyebrow'), text('h1', 'Cartões'), text('p', 'Uma fatura clara, do primeiro gasto ao pagamento.'));
    document.querySelector('main')?.prepend(heading);
  }
})();
