/* Public marketing pages only. No Google request before explicit acceptance. */
(() => {
  'use strict';
  const id = 'G-YCEFKJH08Z';
  const key = 'arolix-public-analytics-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const pages = {
    '/': ['/', 'Arolix — controle financeiro pessoal'],
    '/index.html': ['/', 'Arolix — controle financeiro pessoal'],
    '/vendas.html': ['/', 'Arolix — controle financeiro pessoal'],
    '/controle-cartao-credito.html': ['/controle-cartao-credito.html', 'Controle de cartão de crédito | Arolix'],
    '/como-controlar-compras-parceladas.html': ['/como-controlar-compras-parceladas.html', 'Como controlar compras parceladas | Arolix'],
    '/como-organizar-contas-do-mes.html': ['/como-organizar-contas-do-mes.html', 'Como organizar as contas do mês | Arolix']
  };
  const page = pages[location.pathname];
  if (!page || !['arolix.com.br', 'www.arolix.com.br'].includes(location.hostname) || location.protocol !== 'https:') return;
  if (window.arolixPublicAnalytics) return;
  window.arolixPublicAnalytics = true;
  let loaded = false;
  let accepted = false;
  const readChoice = () => {
    try {
      const choice = JSON.parse(localStorage.getItem(key));
      return choice && ['accepted', 'rejected'].includes(choice.value) &&
        Number.isFinite(choice.at) && choice.at <= Date.now() && Date.now() - choice.at < lifetime ? choice.value : null;
    } catch { return null; }
  };
  function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', '; domain=arolix.com.br', '; domain=.arolix.com.br', '; domain=' + location.hostname]) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax; Secure' + domain;
      }
    }
  }
  function start() {
    if (loaded) return;
    loaded = true;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    let referrer = '';
    try {
      const url = new URL(document.referrer);
      if (['https:', 'http:'].includes(url.protocol) && !['arolix.com.br', 'www.arolix.com.br'].includes(url.hostname)) referrer = url.origin + '/';
    } catch { /* No referrer. Never forward private paths or query strings. */ }
    window.gtag('set', {
      page_location: 'https://arolix.com.br' + page[0], page_referrer: referrer, page_title: page[1],
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: false, cookie_expires: lifetime / 1000, cookie_update: false,
      cookie_flags: 'SameSite=Lax;Secure', allow_google_signals: false, allow_ad_personalization_signals: false
    });
    window.gtag('event', 'page_view');
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(script);
  }
  const panel = document.createElement('section');
  panel.className = 'analytics-consent';
  panel.setAttribute('aria-label', 'Preferências de estatísticas');
  panel.innerHTML = '<div><strong>Você escolhe o que compartilhar.</strong><p>Podemos usar o Google Analytics para medir visitas e cliques nas páginas públicas? A área financeira não é rastreada por esta integração. Você pode recusar sem perder acesso ao site.</p><a href="privacidade-estatisticas.html">Como usamos estas estatísticas</a></div><div class="analytics-consent-actions"><button type="button" data-choice="rejected">Recusar</button><button type="button" data-choice="accepted">Aceitar estatísticas</button></div>';
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'analytics-settings';
  settings.textContent = 'Preferências de privacidade';
  settings.addEventListener('click', () => { panel.hidden = false; panel.querySelector('button').focus(); });
  (document.querySelector('.site-footer') || document.body).append(settings);
  document.body.append(panel);
  function choose(value) {
    try { localStorage.setItem(key, JSON.stringify({ value, at: Date.now() })); } catch { /* This visit only when storage is unavailable. */ }
    accepted = value === 'accepted';
    panel.hidden = true;
    if (accepted) start();
    else {
      window['ga-disable-' + id] = true;
      clearCookies();
      // Unload an already running third-party library after withdrawal.
      if (loaded) location.reload();
    }
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-choice]');
    if (button) choose(button.dataset.choice);
  });
  const previous = readChoice();
  panel.hidden = previous !== null;
  accepted = previous === 'accepted';
  if (accepted) start();
  else { window['ga-disable-' + id] = true; clearCookies(); }
  document.addEventListener('click', event => {
    if (!accepted || readChoice() === 'rejected' || !window.gtag) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const action = { '/login.html': 'open_login', '/upgrade.html': 'view_plans' }[url.pathname];
    // Fixed values only: no link text, user IDs, form fields or destination URLs.
    if (action) window.gtag('event', 'public_cta_click', { action, transport_type: 'beacon' });
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    const value = readChoice();
    if (loaded && value !== 'accepted') {
      window['ga-disable-' + id] = true;
      clearCookies();
      location.reload();
    } else if (!loaded && value === 'accepted') { accepted = true; panel.hidden = true; start(); }
    else { accepted = false; panel.hidden = value !== null; }
  });
})();
